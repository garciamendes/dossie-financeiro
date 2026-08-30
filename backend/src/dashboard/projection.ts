import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  setDate,
  startOfDay,
} from 'date-fns';

export interface ProjectionChargeInput {
  description: string;
  amountCents: number;
  dueDay: number;
  status: 'pending' | 'paid' | 'overdue';
  lastPaidAt: Date | null;
}

export interface ProjectionInstallmentInput {
  description: string;
  installmentAmountCents: number;
  totalInstallments: number;
  currentInstallment: number;
  nextDueDate: Date;
  status: 'active' | 'settled';
}

export interface ProjectionEvent {
  date: string; // yyyy-MM-dd
  label: string;
  amountCents: number; // negativo = saída
}

export interface ProjectionResult {
  from: string;
  horizonDays: number;
  startBalanceCents: number;
  endBalanceCents: number;
  /** Primeiro dia em que o saldo projetado fica negativo, ou null. */
  firstNegativeDate: string | null;
  lowestBalanceCents: number;
  events: ProjectionEvent[];
  /** Série diária do saldo projetado, pronta pro gráfico. */
  daily: { date: string; balanceCents: number }[];
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

function clampToMonth(day: number, month: Date): Date {
  const last = endOfMonth(month).getDate();
  return startOfDay(setDate(month, Math.min(day, last)));
}

/**
 * Projeção de fluxo de caixa (PRD, Fase 1 dashboard / Fase 3 "no ritmo atual,
 * dia 25 seu saldo fica negativo").
 *
 * Função pura: recebe o estado já lido do banco e devolve a série diária, os
 * eventos que a compõem e a primeira data de saldo negativo. Sem I/O aqui —
 * é o núcleo testado em projection.spec.ts.
 *
 * Ainda não modela entradas (salário): o schema da Fase 1 não tem entidade de
 * receita. Quando entrar, some os créditos no mesmo laço.
 */
export function buildProjection(params: {
  startBalanceCents: number;
  from?: Date;
  horizonDays?: number;
  charges: ProjectionChargeInput[];
  installments: ProjectionInstallmentInput[];
}): ProjectionResult {
  const from = startOfDay(params.from ?? new Date());
  const horizonDays = params.horizonDays ?? 60;
  const end = addDays(from, horizonDays);

  const events: ProjectionEvent[] = [];

  // --- Recorrências: uma ocorrência por mês dentro do horizonte ---
  const monthsToScan = Math.ceil(horizonDays / 28) + 1;
  for (const charge of params.charges) {
    for (let k = 0; k <= monthsToScan; k++) {
      const occ = clampToMonth(charge.dueDay, addMonths(from, k));
      if (isBefore(occ, from) || isAfter(occ, end)) continue;

      // Ciclo atual já quitado: pula só essa ocorrência.
      const paidThisCycle =
        charge.status === 'paid' &&
        charge.lastPaidAt != null &&
        isSameMonth(charge.lastPaidAt, occ);
      if (paidThisCycle) continue;

      events.push({
        date: iso(occ),
        label: `Fatura: ${charge.description}`,
        amountCents: -charge.amountCents,
      });
    }
  }

  // --- Compras parceladas: uma saída por parcela restante ---
  for (const inst of params.installments) {
    if (inst.status === 'settled') continue;
    const remaining = inst.totalInstallments - inst.currentInstallment;
    for (let j = 0; j < remaining; j++) {
      const occ = startOfDay(addMonths(inst.nextDueDate, j));
      if (isBefore(occ, from) || isAfter(occ, end)) continue;
      events.push({
        date: iso(occ),
        label: `Parcela ${inst.currentInstallment + j + 1}/${inst.totalInstallments}: ${inst.description}`,
        amountCents: -inst.installmentAmountCents,
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  // --- Série diária ---
  const byDay = new Map<string, number>();
  for (const e of events) {
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amountCents);
  }

  const daily: { date: string; balanceCents: number }[] = [];
  let balance = params.startBalanceCents;
  let firstNegativeDate: string | null = null;
  let lowest = balance;

  for (let d = 0; d <= horizonDays; d++) {
    const day = iso(addDays(from, d));
    balance += byDay.get(day) ?? 0;
    if (balance < lowest) lowest = balance;
    if (balance < 0 && firstNegativeDate === null) firstNegativeDate = day;
    daily.push({ date: day, balanceCents: balance });
  }

  return {
    from: iso(from),
    horizonDays,
    startBalanceCents: params.startBalanceCents,
    endBalanceCents: balance,
    firstNegativeDate,
    lowestBalanceCents: lowest,
    events,
    daily,
  };
}
