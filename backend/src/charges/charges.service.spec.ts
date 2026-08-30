import { ChargesService } from './charges.service';
import { ActorContext } from '../common/actor';

const actor: ActorContext = { userId: 'u1', householdId: 'h1', channel: 'web' };

function setup(chargeOverrides: Record<string, unknown> = {}) {
  const charge = {
    id: 'c1',
    householdId: 'h1',
    description: 'Internet',
    amountCents: 100_00,
    dueDay: 15,
    category: 'Moradia',
    status: 'pending',
    lastPaidAt: null,
    ...chargeOverrides,
  };

  const prisma = {
    recurringCharge: {
      findUnique: jest.fn().mockResolvedValue(charge),
      update: jest.fn((args: any) => Promise.resolve({ ...charge, ...args.data })),
    },
    transaction: { create: jest.fn().mockResolvedValue({ id: 't1' }) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const auditLog = { record: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new ChargesService(prisma as any, auditLog as any),
    prisma,
    auditLog,
  };
}

describe('ChargesService.markRecurringChargeAsPaid', () => {
  it('marca como paga, registra transação e loga', async () => {
    const { service, prisma, auditLog } = setup();

    const result: any = await service.markRecurringChargeAsPaid('c1', actor);

    expect(result.status).toBe('paid');
    expect(result.lastPaidAt).toBeInstanceOf(Date);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 100_00, origin: 'manual' }),
      }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'charge.marked_paid' }),
    );
  });

  it('é idempotente no mesmo ciclo (paga neste mês) — não duplica transação', async () => {
    const { service, prisma, auditLog } = setup({
      status: 'paid',
      lastPaidAt: new Date(),
    });

    await service.markRecurringChargeAsPaid('c1', actor);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('paga de novo se o último pagamento foi em um ciclo anterior', async () => {
    const { service, prisma } = setup({
      status: 'paid',
      lastPaidAt: new Date('2020-01-01T00:00:00Z'),
    });

    await service.markRecurringChargeAsPaid('c1', actor);

    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('recusa fatura de outra ficha', async () => {
    const { service } = setup({ householdId: 'OUTRA' });
    await expect(
      service.markRecurringChargeAsPaid('c1', actor),
    ).rejects.toThrow(/não encontrada/);
  });
});
