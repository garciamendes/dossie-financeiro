export function fmtBRL(cents: number): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** BRL sem símbolo, para caber em legendas apertadas. */
export function fmtBRLShort(cents: number): string {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRLToCents(input: string): number {
  const clean = input.trim().replace(/[^0-9.,-]/g, "");
  if (!clean) return NaN;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const value = Number(normalized);
  return Number.isNaN(value) ? NaN : Math.round(value * 100);
}

/**
 * Datas "date-only" da API (yyyy-MM-dd, ex: projeção) devem ser lidas na
 * hora local — `new Date("2026-09-30")` seria interpretada como UTC e
 * "voltaria" um dia em fusos atrás de Greenwich.
 */
export function parseApiDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

export function fmtDate(iso: string | Date): string {
  return parseApiDate(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function fmtDateTime(iso: string | Date): string {
  const d = parseApiDate(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Próxima data de vencimento a partir de um dia do mês (1-31). */
export function nextDueDateFromDay(dueDay: number, from = new Date()): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const clamp = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDay));
  };
  let candidate = clamp(base.getFullYear(), base.getMonth());
  if (candidate < base) {
    candidate = clamp(base.getFullYear(), base.getMonth() + 1);
  }
  return candidate;
}

export function daysUntil(date: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function dueLabel(days: number): string {
  if (days < 0) return `Venceu há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
