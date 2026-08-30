"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, ApiError } from "./api";
import { session } from "./session";
import type { HouseholdSummary, Me, Tokens } from "./types";

/* ============================ UI (tema + privacidade) ============================ */

interface UiCtx {
  theme: "dark" | "light";
  toggleTheme: () => void;
  privacy: boolean;
  togglePrivacy: () => void;
}
const UiContext = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  // Estado inicial neutro (bate com o SSR); o valor salvo é aplicado no
  // primeiro efeito, no cliente.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [privacy, setPrivacy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTheme(session.getTheme());
    setPrivacy(session.getPrivacy());
    setHydrated(true);
  }, []);

  // Só sincroniza (e persiste) DEPOIS de ler o valor salvo — evita
  // sobrescrever a preferência com o default no primeiro render.
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", theme);
    session.setTheme(theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.body.classList.toggle("privacy-on", privacy);
    session.setPrivacy(privacy);
  }, [privacy, hydrated]);

  const value = useMemo<UiCtx>(
    () => ({
      theme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      privacy,
      togglePrivacy: () => setPrivacy((p) => !p),
    }),
    [theme, privacy],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiCtx {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi fora do UiProvider");
  return ctx;
}

/* ================================ Toast ================================ */

interface ToastState {
  msg: string;
  error: boolean;
  id: number;
}
interface ToastCtx {
  toast: (msg: string, opts?: { error?: boolean }) => void;
}
const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, opts?: { error?: boolean }) => {
    setState({ msg, error: !!opts?.error, id: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 4600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={`toast ${state ? "show" : ""} ${state?.error ? "err" : ""}`}>
        {state?.msg}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  return ctx;
}

/* ================================ Auth ================================ */

interface AuthCtx {
  loading: boolean;
  me: Me | null;
  households: HouseholdSummary[];
  currentHouseholdId: string | null;
  currentHousehold: HouseholdSummary | null;
  setCurrentHousehold: (id: string) => void;
  signIn: (tokens: Tokens) => Promise<{ hasHousehold: boolean }>;
  signOut: () => void;
  reload: () => Promise<void>;
}
const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [currentHouseholdId, setCurrentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tokens = session.getTokens();
    if (!tokens) {
      setMe(null);
      setHouseholds([]);
      setCurrentId(null);
      setLoading(false);
      return;
    }
    try {
      const [meRes, hhRes] = await Promise.all([
        api.me(),
        api.myHouseholds(),
      ]);
      setMe(meRes);
      setHouseholds(hhRes);
      const stored = session.getHouseholdId();
      const pick =
        (stored && hhRes.find((h) => h.id === stored)?.id) ||
        hhRes[0]?.id ||
        null;
      setCurrentId(pick);
      if (pick) session.setHouseholdId(pick);
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) {
        session.clear();
        setMe(null);
        setHouseholds([]);
        setCurrentId(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = useCallback<AuthCtx["signIn"]>(async (tokens) => {
    session.setTokens(tokens);
    setLoading(true);
    const [meRes, hhRes] = await Promise.all([api.me(), api.myHouseholds()]);
    setMe(meRes);
    setHouseholds(hhRes);
    const pick = hhRes[0]?.id ?? null;
    setCurrentId(pick);
    if (pick) session.setHouseholdId(pick);
    setLoading(false);
    return { hasHousehold: hhRes.length > 0 };
  }, []);

  const signOut = useCallback(() => {
    void api.revokeAll().catch(() => undefined);
    session.clear();
    setMe(null);
    setHouseholds([]);
    setCurrentId(null);
  }, []);

  const setCurrentHousehold = useCallback((id: string) => {
    setCurrentId(id);
    session.setHouseholdId(id);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      loading,
      me,
      households,
      currentHouseholdId,
      currentHousehold:
        households.find((h) => h.id === currentHouseholdId) ?? null,
      setCurrentHousehold,
      signIn,
      signOut,
      reload: load,
    }),
    [loading, me, households, currentHouseholdId, setCurrentHousehold, signIn, signOut, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
