import { session } from "./session";
import type {
  ActivityEntry,
  DashboardSummary,
  Goal,
  HouseholdDetail,
  HouseholdSummary,
  InstallmentPurchase,
  Me,
  MfaProvisioning,
  Projection,
  RecurringCharge,
  ReminderLog,
  Tokens,
  Transaction,
} from "./types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3333";

// Deploy sem NEXT_PUBLIC_API_URL cairia silenciosamente no localhost — avisa alto.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_API_URL &&
  typeof window !== "undefined"
) {
  // eslint-disable-next-line no-console
  console.error(
    "NEXT_PUBLIC_API_URL não foi definido no build — a API está apontando para localhost.",
  );
}

export class ApiError extends Error {
  status: number;
  unauthorized: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.unauthorized = status === 401;
  }
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(" · ");
    if (typeof m === "string") return m;
  }
  return fallback;
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let refreshInFlight: Promise<Tokens | null> | null = null;

async function doRefresh(): Promise<Tokens | null> {
  const current = session.getTokens();
  if (!current?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return null;
        const tokens = (await parse(res)) as Tokens;
        if (!tokens?.accessToken) return null;
        session.setTokens(tokens);
        return tokens;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  auth?: boolean; // default true
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const send = async (accessToken?: string): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth && accessToken) headers["authorization"] = `Bearer ${accessToken}`;
    return fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await send(auth ? session.getTokens()?.accessToken : undefined);
  } catch {
    throw new ApiError(0, "Não consegui falar com o servidor. Ele está no ar?");
  }

  if (res.status === 401 && auth) {
    const refreshed = await doRefresh();
    if (refreshed) {
      res = await send(refreshed.accessToken);
    }
    if (res.status === 401) {
      session.clear();
      throw new ApiError(401, "Sessão expirada. Entre de novo.");
    }
  }

  const parsed = await parse(res);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      messageFromBody(parsed, `Erro ${res.status}.`),
    );
  }
  return parsed as T;
}

/* ---------------------------------------------------------------- *
 * Endpoints                                                        *
 * ---------------------------------------------------------------- */

type LoginResult =
  | { mfaRequired: true; mfaToken: string }
  | { mfaSetupRequired: true; userId: string; mfa: MfaProvisioning }
  | Tokens;

export const api = {
  // auth (sem token)
  register: (email: string, name: string, password: string) =>
    request<{ userId: string; mfa: MfaProvisioning }>("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, name, password },
    }),

  activateMfa: (userId: string, code: string) =>
    request<Tokens>("/auth/mfa/activate", {
      method: "POST",
      auth: false,
      body: { userId, code },
    }),

  login: (email: string, password: string) =>
    request<LoginResult>("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    }),

  loginMfa: (mfaToken: string, code: string) =>
    request<Tokens>("/auth/login/mfa", {
      method: "POST",
      auth: false,
      body: { mfaToken, code },
    }),

  // auth (com token)
  me: () => request<Me>("/auth/me"),
  setPin: (pin: string) =>
    request<{ ok: true }>("/auth/pin", { method: "POST", body: { pin } }),
  revokeAll: () => request<{ revoked: true }>("/auth/revoke-all", { method: "POST" }),

  // households
  myHouseholds: () => request<HouseholdSummary[]>("/households"),
  createHousehold: (name: string) =>
    request<{ id: string; name: string }>("/households", {
      method: "POST",
      body: { name },
    }),
  householdDetail: (id: string) => request<HouseholdDetail>(`/households/${id}`),
  createInvite: (id: string, channel = "link") =>
    request<{ id: string; token: string; expiresAt: string }>(
      `/households/${id}/invites`,
      { method: "POST", body: { channel } },
    ),
  acceptInvite: (token: string) =>
    request<unknown>(`/households/invites/${token}/accept`, { method: "POST" }),
  revokeInvite: (id: string, inviteId: string) =>
    request<unknown>(`/households/${id}/invites/${inviteId}`, {
      method: "DELETE",
    }),

  // dashboard
  summary: (h: string) =>
    request<DashboardSummary>(`/households/${h}/dashboard/summary`),
  projection: (h: string, days = 90) =>
    request<Projection>(`/households/${h}/dashboard/projection?days=${days}`),

  // charges
  charges: (h: string) => request<RecurringCharge[]>(`/households/${h}/charges`),
  createCharge: (
    h: string,
    body: {
      description: string;
      amountCents: number;
      dueDay: number;
      category?: string;
      remindViaWhatsapp?: boolean;
      remindViaTelegram?: boolean;
    },
  ) => request<RecurringCharge>(`/households/${h}/charges`, { method: "POST", body }),
  markChargePaid: (h: string, chargeId: string) =>
    request<RecurringCharge>(`/households/${h}/charges/${chargeId}/mark-paid`, {
      method: "POST",
    }),

  // installments
  installments: (h: string) =>
    request<InstallmentPurchase[]>(`/households/${h}/installments`),
  createInstallment: (
    h: string,
    body: {
      description: string;
      installmentAmountCents: number;
      totalInstallments: number;
      currentInstallment?: number;
      nextDueDate: string;
      category?: string;
    },
  ) =>
    request<InstallmentPurchase>(`/households/${h}/installments`, {
      method: "POST",
      body,
    }),
  registerInstallmentPayment: (h: string, purchaseId: string) =>
    request<InstallmentPurchase>(
      `/households/${h}/installments/${purchaseId}/register-payment`,
      { method: "POST" },
    ),

  // goals
  goals: (h: string) => request<Goal[]>(`/households/${h}/goals`),
  createGoal: (
    h: string,
    body: {
      name: string;
      targetAmountCents: number;
      currentAmountCents?: number;
      targetDate?: string;
    },
  ) => request<Goal>(`/households/${h}/goals`, { method: "POST", body }),
  contributeGoal: (h: string, goalId: string, amountCents: number) =>
    request<Goal>(`/households/${h}/goals/${goalId}/contribute`, {
      method: "POST",
      body: { amountCents },
    }),

  // transactions
  transactions: (h: string) =>
    request<Transaction[]>(`/households/${h}/transactions`),

  // reminders
  reminders: (h: string) => request<ReminderLog[]>(`/households/${h}/reminders`),
  scanReminders: (h: string) =>
    request<{ planned: number; created: number }>(
      `/households/${h}/reminders/scan-now`,
      { method: "POST" },
    ),
  replyReminder: (h: string, reminderId: string, reply: string) =>
    request<unknown>(`/households/${h}/reminders/${reminderId}/reply`, {
      method: "POST",
      body: { reply },
    }),

  // activity
  activity: (h: string, take = 60) =>
    request<ActivityEntry[]>(`/households/${h}/activity?take=${take}`),
};
