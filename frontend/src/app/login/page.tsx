"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/providers";
import { MfaActivate } from "@/components/auth/MfaActivate";
import type { MfaProvisioning, Tokens } from "@/lib/types";

type Step =
  | { name: "credentials" }
  | { name: "totp"; mfaToken: string }
  | { name: "setup"; userId: string; mfa: MfaProvisioning };

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { me, loading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ name: "credentials" });

  useEffect(() => {
    if (!loading && me) router.replace(next || "/");
  }, [loading, me, router, next]);

  async function finish(tokens: Tokens) {
    const { hasHousehold } = await signIn(tokens);
    if (next) router.replace(next);
    else router.replace(hasHousehold ? "/" : "/onboarding");
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.login(email.trim(), password);
      if ("mfaRequired" in res) {
        setStep({ name: "totp", mfaToken: res.mfaToken });
      } else if ("mfaSetupRequired" in res) {
        setStep({ name: "setup", userId: res.userId, mfa: res.mfa });
      } else {
        await finish(res);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "E-mail ou senha inválidos.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    if (step.name !== "totp") return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("O código tem 6 dígitos.");
      return;
    }
    setBusy(true);
    try {
      const tokens = await api.loginMfa(step.mfaToken, code);
      await finish(tokens);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código incorreto.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Dossiê Financeiro</h1>
        <p className="sub">
          {step.name === "credentials" && "Entre na sua ficha."}
          {step.name === "totp" && "Digite o código do seu app autenticador."}
          {step.name === "setup" && "Sua conta ainda não tem MFA. Configure agora."}
        </p>

        {step.name === "credentials" && (
          <form onSubmit={submitCredentials}>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button className="btn" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <Link className="auth-link" href="/register">
                Criar uma conta
              </Link>
            </div>
          </form>
        )}

        {step.name === "totp" && (
          <form onSubmit={submitTotp}>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label>Código de 6 dígitos</label>
              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                placeholder="000000"
                autoFocus
              />
            </div>
            <button className="btn" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Validando…" : "Confirmar"}
            </button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setStep({ name: "credentials" });
                  setCode("");
                  setError(null);
                }}
              >
                Voltar
              </button>
            </div>
          </form>
        )}

        {step.name === "setup" && (
          <MfaActivate
            userId={step.userId}
            mfa={step.mfa}
            onActivated={finish}
          />
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="center-note">Carregando…</div>}>
      <LoginInner />
    </Suspense>
  );
}
