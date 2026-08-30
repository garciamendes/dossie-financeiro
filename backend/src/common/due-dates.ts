import {
  addMonths,
  endOfMonth,
  isBefore,
  setDate,
  startOfDay,
} from 'date-fns';

/**
 * Próxima data de vencimento a partir de um "dia do mês" (1-31).
 * Se o dia já passou neste mês, joga pro mês que vem. Dias inexistentes
 * (ex: 31 em fevereiro) caem no último dia do mês.
 */
export function nextDueDateFromDay(dueDay: number, from: Date = new Date()): Date {
  const base = startOfDay(from);
  const clamp = (d: Date) => {
    const last = endOfMonth(d).getDate();
    return setDate(d, Math.min(dueDay, last));
  };

  let candidate = clamp(base);
  if (isBefore(candidate, base)) {
    candidate = clamp(addMonths(base, 1));
  }
  return candidate;
}
