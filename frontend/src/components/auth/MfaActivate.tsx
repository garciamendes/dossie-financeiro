"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { MfaProvisioning, Tokens } from "@/lib/types";

/**
 * Passo obrigatório de MFA (SEGURANCA.md, seção 1): o usuário escaneia o QR
 * num app TOTP (Google Authenticator / Authy) e confirma o primeiro código.
 * Só aí o backend emite tokens de verdade.
 */
export function MfaActivate({
  userId,
  mfa,
  onActivated,
}: {
  userId: string;
  mfa: MfaProvisioning;
  onActivated: (tokens: Tokens) => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("O código TOTP tem 6 dígitos.");
      return;
    }
    setBusy(true);
    try {
      const tokens = await api.activateMfa(userId, code);
      await onActivated(tokens);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não consegui validar o código.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="sub">
        Escaneie o QR no seu app autenticador (Google Authenticator, Authy…) e
        digite o código de 6 dígitos que aparecer.
      </p>

      <div className="qr-box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mfa.qrDataUrl} alt="QR code para configurar o MFA" />
        <div>
          <span className="qr-secret">{mfa.secret}</span>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="auth-field">
        <label>Código do app autenticador</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="000000"
          autoFocus
        />
      </div>

      <button className="btn" style={{ width: "100%" }} disabled={busy}>
        {busy ? "Validando…" : "Ativar e entrar"}
      </button>
    </form>
  );
}
