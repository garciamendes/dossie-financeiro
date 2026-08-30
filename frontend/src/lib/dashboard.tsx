"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "./api";
import type {
  ActivityEntry,
  DashboardSummary,
  Goal,
  HouseholdDetail,
  InstallmentPurchase,
  Projection,
  RecurringCharge,
  ReminderLog,
} from "./types";

interface DashboardData {
  summary: DashboardSummary | null;
  projection: Projection | null;
  charges: RecurringCharge[];
  installments: InstallmentPurchase[];
  goals: Goal[];
  activity: ActivityEntry[];
  reminders: ReminderLog[];
  detail: HouseholdDetail | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<DashboardData | null>(null);

export function DashboardProvider({
  householdId,
  children,
}: {
  householdId: string;
  children: React.ReactNode;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [installments, setInstallments] = useState<InstallmentPurchase[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [detail, setDetail] = useState<HouseholdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [s, p, c, i, g, a, r, d] = await Promise.all([
        api.summary(householdId),
        api.projection(householdId),
        api.charges(householdId),
        api.installments(householdId),
        api.goals(householdId),
        api.activity(householdId),
        api.reminders(householdId),
        api.householdDetail(householdId),
      ]);
      setSummary(s);
      setProjection(p);
      setCharges(c);
      setInstallments(i);
      setGoals(g);
      setActivity(a);
      setReminders(r);
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a ficha.");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const value = useMemo<DashboardData>(
    () => ({
      summary,
      projection,
      charges,
      installments,
      goals,
      activity,
      reminders,
      detail,
      loading,
      error,
      reload,
    }),
    [summary, projection, charges, installments, goals, activity, reminders, detail, loading, error, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboard fora do DashboardProvider");
  return ctx;
}
