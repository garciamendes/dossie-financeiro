import { differenceInCalendarDays, format, isSameMonth } from 'date-fns';
import { nextDueDateFromDay } from '../common/due-dates';

export interface PlannerCharge {
  id: string;
  householdId: string;
  description: string;
  amountCents: number;
  dueDay: number;
  status: 'pending' | 'paid' | 'overdue';
  lastPaidAt: Date | null;
  remindDaysBefore: number;
  remindViaWhatsapp: boolean;
  remindViaTelegram: boolean;
}

export interface PlannerInstallment {
  id: string;
  householdId: string;
  description: string;
  installmentAmountCents: number;
  totalInstallments: number;
  currentInstallment: number;
  nextDueDate: Date;
  status: 'active' | 'settled';
  remindDaysBefore: number;
  remindViaWhatsapp: boolean;
  remindViaTelegram: boolean;
}

export interface PlannedReminder {
  dedupeKey: string;
  householdId: string;
  kind: 'upcoming' | 'due_day';
  dueDate: Date;
  chargeId?: string;
  installmentPurchaseId?: string;
  channels: string[]; // sempre inclui "console" na Fase 1
  text: string;
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function channelsFor(item: {
  remindViaWhatsapp: boolean;
  remindViaTelegram: boolean;
}): string[] {
  const chans = ['console'];
  if (item.remindViaWhatsapp) chans.push('whatsapp');
  if (item.remindViaTelegram) chans.push('telegram');
  return chans;
}

/**
 * Decide quais lembretes devem existir "hoje", de forma determinística —
 * função pura, testada em reminder-planner.spec.ts. Quem persiste e envia
 * (com deduplicação pela `dedupeKey`) é o RemindersService.
 *
 * Regras (PRD, Fase 1):
 *  - N dias antes do vencimento (remindDaysBefore) → lembrete `upcoming`.
 *  - No dia do vencimento → lembrete `due_day` ("Você pagou a fatura X?").
 *  - Recorrência já paga no ciclo atual não gera lembrete.
 *  - Compra parcelada quitada não gera lembrete.
 */
export function planReminders(
  now: Date,
  charges: PlannerCharge[],
  installments: PlannerInstallment[],
): PlannedReminder[] {
  const out: PlannedReminder[] = [];

  for (const charge of charges) {
    const due = nextDueDateFromDay(charge.dueDay, now);
    const daysUntil = differenceInCalendarDays(due, now);

    const paidThisCycle =
      charge.status === 'paid' &&
      charge.lastPaidAt != null &&
      isSameMonth(charge.lastPaidAt, due);
    if (paidThisCycle) continue;

    if (daysUntil > 0 && daysUntil <= charge.remindDaysBefore) {
      out.push({
        dedupeKey: `charge:${charge.id}:upcoming:${iso(due)}`,
        householdId: charge.householdId,
        kind: 'upcoming',
        dueDate: due,
        chargeId: charge.id,
        channels: channelsFor(charge),
        text: `Lembrete: "${charge.description}" (${brl(charge.amountCents)}) vence em ${daysUntil} dia(s), no dia ${iso(due)}.`,
      });
    }

    if (daysUntil === 0) {
      out.push({
        dedupeKey: `charge:${charge.id}:due_day:${iso(due)}`,
        householdId: charge.householdId,
        kind: 'due_day',
        dueDate: due,
        chargeId: charge.id,
        channels: channelsFor(charge),
        text: `Vence hoje: você pagou "${charge.description}" (${brl(charge.amountCents)})? Responda "sim", "não" ou o valor pago.`,
      });
    }
  }

  for (const inst of installments) {
    if (inst.status === 'settled') continue;
    const due = inst.nextDueDate;
    const daysUntil = differenceInCalendarDays(due, now);
    const label = `parcela ${inst.currentInstallment + 1}/${inst.totalInstallments} de "${inst.description}"`;

    if (daysUntil > 0 && daysUntil <= inst.remindDaysBefore) {
      out.push({
        dedupeKey: `inst:${inst.id}:upcoming:${iso(due)}`,
        householdId: inst.householdId,
        kind: 'upcoming',
        dueDate: due,
        installmentPurchaseId: inst.id,
        channels: channelsFor(inst),
        text: `Lembrete: ${label} (${brl(inst.installmentAmountCents)}) vence em ${daysUntil} dia(s), no dia ${iso(due)}.`,
      });
    }

    if (daysUntil === 0) {
      out.push({
        dedupeKey: `inst:${inst.id}:due_day:${iso(due)}`,
        householdId: inst.householdId,
        kind: 'due_day',
        dueDate: due,
        installmentPurchaseId: inst.id,
        channels: channelsFor(inst),
        text: `Vence hoje: você pagou a ${label} (${brl(inst.installmentAmountCents)})? Responda "sim", "não" ou o valor pago.`,
      });
    }
  }

  return out;
}

/** Interpreta a resposta do usuário a um lembrete `due_day`. */
export function interpretReminderReply(raw: string): {
  intent: 'paid' | 'not_paid' | 'unknown';
  amountCents?: number;
} {
  const text = raw.trim().toLowerCase();

  if (/^(sim|paguei|pago|ok|quitei|já paguei)\b/.test(text)) {
    return { intent: 'paid' };
  }
  if (/^(n[ãa]o|nao|ainda n[ãa]o|negativo)\b/.test(text)) {
    return { intent: 'not_paid' };
  }

  // "50", "50,00", "R$ 50.00", "1.234,56"
  const money = text.replace(/[^0-9.,]/g, '');
  if (money) {
    const normalized = money.includes(',')
      ? money.replace(/\./g, '').replace(',', '.')
      : money;
    const value = Number(normalized);
    if (!Number.isNaN(value) && value > 0) {
      return { intent: 'paid', amountCents: Math.round(value * 100) };
    }
  }

  return { intent: 'unknown' };
}
