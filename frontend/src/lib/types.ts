export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface MfaProvisioning {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  mfaEnabled: boolean;
  hasPin: boolean;
  preferences: { theme: "dark" | "light" | "system"; hideValuesByDefault: boolean } | null;
}

export type Role = "owner" | "member";

export interface Permissions {
  canCreateCharge: boolean;
  canEditCharge: boolean;
  canDeleteCharge: boolean;
  canMarkPaid: boolean;
  canManageGoals: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: Role;
  joinedAt: string;
  permissions: Permissions;
}

export interface HouseholdMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  permissions: Permissions;
}

export interface PendingInvite {
  id: string;
  token: string;
  channel: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface HouseholdDetail {
  id: string;
  name: string;
  members: HouseholdMember[];
  pendingInvites: PendingInvite[];
}

export type ChargeStatus = "pending" | "paid" | "overdue";

export interface RecurringCharge {
  id: string;
  description: string;
  amountCents: number;
  dueDay: number;
  category: string | null;
  status: ChargeStatus;
  lastPaidAt: string | null;
  accountId: string | null;
  remindDaysBefore: number;
  remindViaWhatsapp: boolean;
  remindViaTelegram: boolean;
}

export type InstallmentStatus = "active" | "settled";

export interface InstallmentPurchase {
  id: string;
  description: string;
  installmentAmountCents: number;
  totalInstallments: number;
  currentInstallment: number;
  nextDueDate: string;
  category: string | null;
  status: InstallmentStatus;
}

export interface Goal {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: string | null;
  suggestedMonthlyCents: number | null;
}

export interface Transaction {
  id: string;
  description: string | null;
  amountCents: number;
  occurredAt: string;
  category: string | null;
  origin: "manual" | "whatsapp" | "telegram" | "bank";
  installmentPurchaseId: string | null;
}

export interface DashboardSummary {
  totalBalanceCents: number;
  openCharges: { count: number; totalCents: number };
  activeInstallments: { count: number; remainingCents: number };
  goals: {
    id: string;
    name: string;
    targetAmountCents: number;
    currentAmountCents: number;
    progress: number;
    suggestedMonthlyCents: number | null;
  }[];
  spendingThisMonthByCategory: { category: string; totalCents: number }[];
}

export interface ProjectionEvent {
  date: string;
  label: string;
  amountCents: number;
}

export interface Projection {
  from: string;
  horizonDays: number;
  startBalanceCents: number;
  endBalanceCents: number;
  firstNegativeDate: string | null;
  lowestBalanceCents: number;
  events: ProjectionEvent[];
  daily: { date: string; balanceCents: number }[];
}

export interface ActivityEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  channel: string;
  summary: string;
  createdAt: string;
  user?: { id: string; name: string };
}

export type ReminderKind = "upcoming" | "due_day";

export interface ReminderLog {
  id: string;
  chargeId: string | null;
  installmentPurchaseId: string | null;
  kind: ReminderKind;
  channels: string;
  dueDate: string;
  status: "sent" | "answered" | "failed";
  responseText: string | null;
  respondedAt: string | null;
  createdAt: string;
}
