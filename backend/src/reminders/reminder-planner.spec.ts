import {
  interpretReminderReply,
  planReminders,
  PlannerCharge,
  PlannerInstallment,
} from './reminder-planner';

const baseCharge = (over: Partial<PlannerCharge> = {}): PlannerCharge => ({
  id: 'c1',
  householdId: 'h1',
  description: 'Nubank',
  amountCents: 120_00,
  dueDay: 10,
  status: 'pending',
  lastPaidAt: null,
  remindDaysBefore: 3,
  remindViaWhatsapp: true,
  remindViaTelegram: true,
  ...over,
});

const baseInstallment = (
  over: Partial<PlannerInstallment> = {},
): PlannerInstallment => ({
  id: 'i1',
  householdId: 'h1',
  description: 'Notebook',
  installmentAmountCents: 400_00,
  totalInstallments: 12,
  currentInstallment: 4,
  nextDueDate: new Date('2026-01-10T00:00:00Z'),
  status: 'active',
  remindDaysBefore: 3,
  remindViaWhatsapp: true,
  remindViaTelegram: false,
  ...over,
});

describe('planReminders', () => {
  it('gera lembrete "upcoming" dentro da janela de N dias antes', () => {
    const now = new Date('2026-01-08T09:00:00Z'); // vence dia 10 => faltam 2
    const plan = planReminders(now, [baseCharge()], []);
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('upcoming');
    expect(plan[0].dedupeKey).toBe('charge:c1:upcoming:2026-01-10');
    expect(plan[0].channels).toEqual(['console', 'whatsapp', 'telegram']);
  });

  it('não gera nada fora da janela', () => {
    const now = new Date('2026-01-01T09:00:00Z'); // faltam 9 dias, janela é 3
    expect(planReminders(now, [baseCharge()], [])).toHaveLength(0);
  });

  it('gera lembrete "due_day" no dia do vencimento', () => {
    const now = new Date('2026-01-10T09:00:00Z');
    const plan = planReminders(now, [baseCharge()], []);
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('due_day');
    expect(plan[0].dedupeKey).toBe('charge:c1:due_day:2026-01-10');
  });

  it('não lembra recorrência já paga neste ciclo', () => {
    const now = new Date('2026-01-10T09:00:00Z');
    const charge = baseCharge({
      status: 'paid',
      lastPaidAt: new Date('2026-01-05T00:00:00Z'),
    });
    expect(planReminders(now, [charge], [])).toHaveLength(0);
  });

  it('respeita as flags de canal da parcela', () => {
    const now = new Date('2026-01-08T09:00:00Z');
    const plan = planReminders(now, [], [baseInstallment()]);
    expect(plan[0].channels).toEqual(['console', 'whatsapp']);
    expect(plan[0].installmentPurchaseId).toBe('i1');
  });

  it('não lembra parcela de compra já quitada', () => {
    const now = new Date('2026-01-10T09:00:00Z');
    expect(
      planReminders(now, [], [baseInstallment({ status: 'settled' })]),
    ).toHaveLength(0);
  });
});

describe('interpretReminderReply', () => {
  it.each(['sim', 'Paguei', 'já paguei', 'ok', 'quitei'])(
    '"%s" => paid',
    (txt) => {
      expect(interpretReminderReply(txt).intent).toBe('paid');
    },
  );

  it.each(['não', 'nao', 'ainda não', 'negativo'])('"%s" => not_paid', (txt) => {
    expect(interpretReminderReply(txt).intent).toBe('not_paid');
  });

  it('valor "50" => paid com 5000 centavos', () => {
    expect(interpretReminderReply('50')).toEqual({
      intent: 'paid',
      amountCents: 5000,
    });
  });

  it('valor "R$ 1.234,56" => paid com 123456 centavos', () => {
    expect(interpretReminderReply('R$ 1.234,56')).toEqual({
      intent: 'paid',
      amountCents: 123456,
    });
  });

  it('texto solto => unknown', () => {
    expect(interpretReminderReply('talvez amanhã')).toEqual({
      intent: 'unknown',
    });
  });
});
