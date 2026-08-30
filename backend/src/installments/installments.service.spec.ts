import { addMonths } from 'date-fns';
import { InstallmentsService } from './installments.service';
import { ActorContext } from '../common/actor';

const actor: ActorContext = {
  userId: 'u1',
  householdId: 'h1',
  channel: 'web',
};

function setup(purchaseOverrides: Record<string, unknown> = {}) {
  const purchase = {
    id: 'i1',
    householdId: 'h1',
    description: 'Geladeira',
    installmentAmountCents: 300_00,
    totalInstallments: 10,
    currentInstallment: 4,
    nextDueDate: new Date('2026-01-20T00:00:00Z'),
    category: 'Casa',
    status: 'active',
    ...purchaseOverrides,
  };

  const prisma = {
    installmentPurchase: {
      findUnique: jest.fn().mockResolvedValue(purchase),
      update: jest.fn((args: any) => Promise.resolve({ ...purchase, ...args.data })),
    },
    transaction: { create: jest.fn().mockResolvedValue({ id: 't1' }) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const auditLog = { record: jest.fn().mockResolvedValue(undefined) };

  const service = new InstallmentsService(prisma as any, auditLog as any);
  return { service, prisma, auditLog, purchase };
}

describe('InstallmentsService.registerPayment (transição automática)', () => {
  it('avança a parcela e soma 1 mês no vencimento', async () => {
    const { service, prisma, auditLog } = setup();

    const result: any = await service.registerPayment('i1', actor);

    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(result.currentInstallment).toBe(5);
    expect(result.status).toBe('active');
    expect(result.nextDueDate).toEqual(addMonths(new Date('2026-01-20T00:00:00Z'), 1));
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'installment.payment_registered' }),
    );
  });

  it('quita a compra ao pagar a última parcela', async () => {
    const { service, auditLog } = setup({ currentInstallment: 9 });

    const result: any = await service.registerPayment('i1', actor);

    expect(result.currentInstallment).toBe(10);
    expect(result.status).toBe('settled');
    // vencimento não avança depois de quitada
    expect(result.nextDueDate).toEqual(new Date('2026-01-20T00:00:00Z'));
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'installment.settled' }),
    );
  });

  it('é idempotente: compra já quitada não gera nova transação nem log', async () => {
    const { service, prisma, auditLog } = setup({
      status: 'settled',
      currentInstallment: 10,
    });

    const result: any = await service.registerPayment('i1', actor);

    expect(result.status).toBe('settled');
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('recusa compra de outra ficha (isolamento por household)', async () => {
    const { service } = setup({ householdId: 'OUTRA' });
    await expect(service.registerPayment('i1', actor)).rejects.toThrow(
      /não encontrada/,
    );
  });
});
