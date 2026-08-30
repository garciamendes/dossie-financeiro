"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/providers";
import { MfaActivate } from "@/components/auth/MfaActivate";
import type { MfaProvisioning } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const { me, loading, signIn } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "mfa">("form");
  const [provisioning, setProvisioning] = useState<
    { userId: string; mfa: MfaProvisioning } | null
  >(null);

  useEffect(() => {
    if (!loading && me) router.replace("/");
  }, [loading, me, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("A senha precisa ter pelo menos 10 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.register(email.trim(), name.trim(), password);
      setProvisioning(res);
      setStep("mfa");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não consegui criar a conta.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Dossiê Financeiro</h1>
        <p className="sub">
          {step === "form"
            ? "Criar sua conta. MFA é obrigatório desde o primeiro acesso."
            : "Quase lá — configure o MFA."}
        </p>

        {step === "form" && (
          <form onSubmit={submit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label>Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="auth-field">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label>Senha (mínimo 10 caracteres)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button className="btn" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Criando…" : "Criar conta"}
            </button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <Link className="auth-link" href="/login">
                Já tenho conta
              </Link>
            </div>
          </form>
        )}

        {step === "mfa" && provisioning && (
          <MfaActivate
            userId={provisioning.userId}
            mfa={provisioning.mfa}
            onActivated={async (tokens) => {
              const { hasHousehold } = await signIn(tokens);
              router.replace(hasHousehold ? "/" : "/onboarding");
            }}
          />
        )}
      </div>
    </div>
  );
}
