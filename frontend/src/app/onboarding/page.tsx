"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/providers";

export default function OnboardingPage() {
  const router = useRouter();
  const { me, loading, households, reload, setCurrentHousehold } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/login");
    else if (households.length > 0) router.replace("/");
  }, [loading, me, households.length, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Dê um nome pra ficha.");
      return;
    }
    setBusy(true);
    try {
      const hh = await api.createHousehold(name.trim());
      await reload();
      setCurrentHousehold(hh.id);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não consegui criar a ficha.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Sua primeira ficha</h1>
        <p className="sub">
          A ficha é a unidade financeira compartilhada. Você pode convidar
          outra pessoa depois, sem compartilhar senha.
        </p>
        <form onSubmit={submit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-field">
            <label>Nome da ficha</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Você & Marina"
              autoFocus
            />
          </div>
          <button className="btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Criando…" : "Criar ficha"}
          </button>
        </form>
      </div>
    </div>
  );
}
