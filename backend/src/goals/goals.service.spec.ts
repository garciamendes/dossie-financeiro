import { GoalsService } from './goals.service';

describe('GoalsService.suggestMonthly (aporte do modo "sonho")', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('sem data-alvo não há sugestão', () => {
    expect(GoalsService.suggestMonthly(15_000_00, 0, null, now)).toBeNull();
  });

  it('divide o que falta pelos meses restantes', () => {
    // alvo 15.000, tem 5.000, faltam 10.000 em 10 meses => 1.000/mês
    const v = GoalsService.suggestMonthly(
      15_000_00,
      5_000_00,
      new Date('2026-11-01T00:00:00Z'),
      now,
    );
    expect(v).toBe(1_000_00);
  });

  it('se atrasou (mais perto da data), a sugestão sobe', () => {
    const relaxed = GoalsService.suggestMonthly(
      10_000_00,
      0,
      new Date('2026-11-01T00:00:00Z'),
      now,
    );
    const tight = GoalsService.suggestMonthly(
      10_000_00,
      0,
      new Date('2026-03-01T00:00:00Z'),
      now,
    );
    expect(tight!).toBeGreaterThan(relaxed!);
  });

  it('meta já batida => sugestão zero, nunca negativa', () => {
    expect(
      GoalsService.suggestMonthly(
        5_000_00,
        6_000_00,
        new Date('2026-06-01T00:00:00Z'),
        now,
      ),
    ).toBe(0);
  });

  it('data no passado/próxima usa piso de 1 mês', () => {
    expect(
      GoalsService.suggestMonthly(
        1_200_00,
        0,
        new Date('2026-01-10T00:00:00Z'),
        now,
      ),
    ).toBe(1_200_00);
  });
});
