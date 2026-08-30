import { buildProjection } from './projection';

describe('buildProjection (fluxo de caixa)', () => {
  const from = new Date('2026-01-01T00:00:00Z');

  it('sem despesas, o saldo fica constante e nunca negativa', () => {
    const r = buildProjection({
      startBalanceCents: 100_00,
      from,
      horizonDays: 30,
      charges: [],
      installments: [],
    });
    expect(r.endBalanceCents).toBe(100_00);
    expect(r.firstNegativeDate).toBeNull();
    expect(r.daily).toHaveLength(31);
  });

  it('detecta a primeira data em que o saldo fica negativo', () => {
    const r = buildProjection({
      startBalanceCents: 50_00,
      from,
      horizonDays: 20,
      charges: [
        {
          description: 'Aluguel',
          amountCents: 80_00,
          dueDay: 10,
          status: 'pending',
          lastPaidAt: null,
        },
      ],
      installments: [],
    });
    // 50,00 - 80,00 no dia 10/01 => negativo a partir de 2026-01-10
    expect(r.firstNegativeDate).toBe('2026-01-10');
    expect(r.lowestBalanceCents).toBe(-30_00);
    expect(r.endBalanceCents).toBe(-30_00);
  });

  it('não conta a recorrência já paga no ciclo atual', () => {
    const r = buildProjection({
      startBalanceCents: 50_00,
      from,
      horizonDays: 20,
      charges: [
        {
          description: 'Aluguel',
          amountCents: 80_00,
          dueDay: 10,
          status: 'paid',
          lastPaidAt: new Date('2026-01-03T00:00:00Z'),
        },
      ],
      installments: [],
    });
    expect(r.events).toHaveLength(0);
    expect(r.firstNegativeDate).toBeNull();
  });

  it('conta a recorrência de novo no mês seguinte, mesmo estando paga neste mês', () => {
    const r = buildProjection({
      startBalanceCents: 200_00,
      from,
      horizonDays: 60,
      charges: [
        {
          description: 'Internet',
          amountCents: 100_00,
          dueDay: 15,
          status: 'paid',
          lastPaidAt: new Date('2026-01-14T00:00:00Z'),
        },
      ],
      installments: [],
    });
    // pula 15/01 (paga), cobra 15/02
    expect(r.events.map((e) => e.date)).toEqual(['2026-02-15']);
  });

  it('gera uma saída por parcela restante da compra parcelada', () => {
    const r = buildProjection({
      startBalanceCents: 1_000_00,
      from,
      horizonDays: 90,
      charges: [],
      installments: [
        {
          description: 'Geladeira',
          installmentAmountCents: 300_00,
          totalInstallments: 10,
          currentInstallment: 7,
          nextDueDate: new Date('2026-01-20T00:00:00Z'),
          status: 'active',
        },
      ],
    });
    // faltam 3 parcelas: 20/01, 20/02, 20/03
    expect(r.events.map((e) => e.date)).toEqual([
      '2026-01-20',
      '2026-02-20',
      '2026-03-20',
    ]);
    expect(r.endBalanceCents).toBe(1_000_00 - 3 * 300_00);
  });

  it('ignora compra parcelada já quitada', () => {
    const r = buildProjection({
      startBalanceCents: 100_00,
      from,
      horizonDays: 60,
      charges: [],
      installments: [
        {
          description: 'TV',
          installmentAmountCents: 50_00,
          totalInstallments: 6,
          currentInstallment: 6,
          nextDueDate: new Date('2026-01-20T00:00:00Z'),
          status: 'settled',
        },
      ],
    });
    expect(r.events).toHaveLength(0);
  });
});
