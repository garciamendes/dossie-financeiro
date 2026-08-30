"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { useAuth, useToast } from "@/lib/providers";
import { fmtDateTime } from "@/lib/format";
import { Avatar, Panel } from "@/components/ui";

const CHANNEL_LABEL: Record<string, string> = {
  web: "Painel",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

function inviteLink(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/convite/${token}`;
}

export function AtividadesTab() {
  const { activity, detail, reload } = useDashboard();
  const { me, currentHousehold } = useAuth();
  const { toast } = useToast();

  const h = currentHousehold?.id ?? "";
  const canInvite = currentHousehold?.permissions.canInviteMembers ?? false;
  const [inviting, setInviting] = useState(false);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Link copiado. Cola no WhatsApp/Telegram e manda pra pessoa.");
    } catch {
      toast("Não consegui copiar — selecione o link e copie na mão.", {
        error: true,
      });
    }
  }

  async function generateInvite() {
    if (!canInvite) {
      toast("Seu perfil não permite convidar pessoas.", { error: true });
      return;
    }
    setInviting(true);
    try {
      const inv = await api.createInvite(h, "link");
      await reload();
      await copy(inviteLink(inv.token));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Falha ao gerar convite.", {
        error: true,
      });
    } finally {
      setInviting(false);
    }
  }

  async function revoke(inviteId: string) {
    setBusyInvite(inviteId);
    try {
      await api.revokeInvite(h, inviteId);
      toast("Convite revogado. O link não funciona mais.");
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Falha ao revogar.", {
        error: true,
      });
    } finally {
      setBusyInvite(null);
    }
  }

  return (
    <div className="view active">
      <div className="grid">
        <Panel title="Linha do tempo">
          {activity.length === 0 && (
            <div className="label">Sem atividades registradas ainda.</div>
          )}
          {activity.map((entry) => {
            const isYou = entry.userId === me?.id;
            const who =
              entry.user?.name ??
              detail?.members.find((m) => m.userId === entry.userId)?.name ??
              (isYou ? "Você" : "Alguém");
            return (
              <div className="log-item" key={entry.id}>
                <Avatar name={isYou ? "Você" : who} isYou={isYou} />
                <div className="log-body">
                  <div className="desc">
                    <b>{isYou ? "Você" : who}</b> — {entry.summary}
                  </div>
                  <div className="log-meta">
                    <span>{fmtDateTime(entry.createdAt)}</span>
                    <span className="channel-tag">
                      {CHANNEL_LABEL[entry.channel] ?? entry.channel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </Panel>

        <Panel title="Membros">
          {detail?.members.map((m) => (
            <div className="members-row" key={m.id}>
              <Avatar name={m.name} isYou={m.userId === me?.id} />
              <div className="member-name">
                {m.userId === me?.id ? "Você" : m.name}
              </div>
              <div className="member-role">
                {m.role === "owner" ? "Dono" : "Membro"}
              </div>
            </div>
          ))}

          <div className="divider" />

          <div className="label" style={{ marginBottom: 8 }}>
            Convidar alguém pra essa ficha
          </div>
          <button
            className="btn"
            style={{ width: "100%" }}
            disabled={inviting || !canInvite}
            onClick={generateInvite}
          >
            {inviting ? "Gerando…" : "Gerar convite"}
          </button>
          <div className="log-meta" style={{ marginTop: 8 }}>
            O link expira em 24h e só serve uma vez. Ninguém digita senha de
            ninguém — a pessoa entra com a própria conta.
          </div>

          {detail && detail.pendingInvites.length > 0 && (
            <>
              <div className="divider" />
              <div className="label" style={{ marginBottom: 8 }}>
                Convites pendentes — copie e mande o link
              </div>
              {detail.pendingInvites.map((inv) => {
                const link = inviteLink(inv.token);
                return (
                  <div key={inv.id} style={{ marginBottom: 14 }}>
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      style={{ marginBottom: 6 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn mini"
                        style={{ marginTop: 0, flex: 1 }}
                        onClick={() => copy(link)}
                      >
                        Copiar link
                      </button>
                      <button
                        className="btn mini ghost"
                        style={{ marginTop: 0 }}
                        disabled={busyInvite === inv.id}
                        onClick={() => revoke(inv.id)}
                      >
                        {busyInvite === inv.id ? "…" : "Revogar"}
                      </button>
                    </div>
                    <div className="log-meta" style={{ marginTop: 5 }}>
                      <span className="channel-tag">{inv.channel ?? "link"}</span>
                      <span>
                        expira {new Date(inv.expiresAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
