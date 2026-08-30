"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/providers";

export default function InvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { me, loading, reload, setCurrentHousehold } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setBusy(true);
    try {
      await api.acceptInvite(token);
      await reload();
      const mine = await api.myHouseholds();
      if (mine[0]) setCurrentHousehold(mine[0].id);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não consegui aceitar o convite.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Convite para uma ficha</h1>

        {loading ? (
          <p className="sub">Carregando…</p>
        ) : me ? (
          <>
            <p className="sub">
              Você entra nesta ficha com a sua própria conta ({me.email}).
              Nenhuma senha é compartilhada.
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button
              className="btn"
              style={{ width: "100%" }}
              disabled={busy}
              onClick={accept}
            >
              {busy ? "Entrando…" : "Aceitar convite"}
            </button>
          </>
        ) : (
          <>
            <p className="sub">
              Entre ou crie sua conta para aceitar este convite. Depois de
              logar, abra este link de novo.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Link
                className="btn"
                style={{ flex: 1, textAlign: "center" }}
                href={`/login?next=/convite/${token}`}
              >
                Entrar
              </Link>
              <Link
                className="btn ghost"
                style={{ flex: 1, textAlign: "center", color: "var(--ink)" }}
                href="/register"
              >
                Criar conta
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
