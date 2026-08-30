"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { useAuth, useToast } from "@/lib/providers";
import { fmtBRL, parseBRLToCents } from "@/lib/format";
import { Memo, Panel } from "@/components/ui";

export function MetasTab() {
  const { goals, reload } = useDashboard();
  const { currentHousehold } = useAuth();
  const { toast } = useToast();

  const h = currentHousehold?.id ?? "";
  const canManage = currentHousehold?.permissions.canManageGoals ?? false;

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) {
      toast("Seu perfil não permite gerenciar metas.", { error: true });
      return;
    }
    const targetCents = parseBRLToCents(target);
    if (!name.trim() || Number.isNaN(targetCents) || targetCents <= 0) {
      toast("Dê um nome e um valor alvo válido.", { error: true });
      return;
    }
    const savedCents = parseBRLToCents(saved || "0");
    setCreating(true);
    try {
      await api.createGoal(h, {
        name: name.trim(),
        targetAmountCents: targetCents,
        currentAmountCents: Number.isNaN(savedCents) ? 0 : savedCents,
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
      });
      toast("Meta criada. Vou monitorar o aporte mensal.");
      setName("");
      setTarget("");
      setSaved("");
      setTargetDate("");
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Não deu para criar.", {
        error: true,
      });
    } finally {
      setCreating(false);
    }
  }

  async function contribute(goalId: string) {
    const raw = window.prompt("Quanto você aportou? (R$)");
    if (raw == null) return;
    const cents = parseBRLToCents(raw);
    if (Number.isNaN(cents) || cents === 0) {
      toast("Valor inválido.", { error: true });
      return;
    }
    setBusy(goalId);
    try {
      await api.contributeGoal(h, goalId, cents);
      toast("Aporte registrado. Aporte sugerido recalculado.");
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Falha ao aportar.", {
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

  const nearest = goals
    .filter((g) => g.targetDate)
    .sort(
      (a, b) =>
        new Date(a.targetDate as string).getTime() -
        new Date(b.targetDate as string).getTime(),
    )[0];

  return (
    <div className="view active">
      <div className="grid">
        <Panel title="Sonhos em andamento">
          {goals.length === 0 && (
            <div className="label">
              Nenhuma meta ainda. Crie uma no formulário ao lado.
            </div>
          )}
          {goals.map((g) => {
            const pct =
              g.targetAmountCents > 0
                ? Math.round((g.currentAmountCents / g.targetAmountCents) * 100)
                : 0;
            return (
              <div className="meta-card" key={g.id}>
                <div className="meta-top">
                  <b>{g.name}</b>
                  <span className="money">
                    {fmtBRL(g.currentAmountCents)} / {fmtBRL(g.targetAmountCents)}
                  </span>
                </div>
                <div className="barra">
                  <div
                    style={{ width: `${Math.min(pct, 100)}%`, background: "var(--stamp-green)" }}
                  />
                </div>
                <div className="legenda-barra">
                  <span className="money">
                    {g.suggestedMonthlyCents != null
                      ? `Aporte sugerido: ${fmtBRL(g.suggestedMonthlyCents)}/mês`
                      : "Sem prazo definido"}
                  </span>
                  <span>{pct}%</span>
                </div>
                <button
                  className="btn mini"
                  style={{ width: "100%" }}
                  disabled={!canManage || busy === g.id}
                  onClick={() => contribute(g.id)}
                >
                  {busy === g.id ? "…" : "Registrar aporte"}
                </button>
              </div>
            );
          })}

          <div className="divider" />

          <form onSubmit={createGoal}>
            <div className="label" style={{ marginBottom: 8 }}>
              Nova meta
            </div>
            <div className="form-row">
              <div>
                <label>Nome</label>
                <input
                  placeholder="Ex: Viagem — Chapada"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label>Valor alvo (R$)</label>
                <input
                  placeholder="15.000,00"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label>Já guardado (R$)</label>
                <input
                  placeholder="0,00"
                  value={saved}
                  onChange={(e) => setSaved(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <label>Data alvo</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
            <button className="btn" disabled={creating || !canManage}>
              {creating ? "Criando…" : "Criar meta"}
            </button>
          </form>
        </Panel>

        <Memo>
          {goals.length === 0 ? (
            <p>
              Me diga um sonho com valor e prazo que eu monto o plano de aporte
              mensal e aviso se você atrasar.
            </p>
          ) : (
            <>
              <p>
                Você tem <b>{goals.length}</b> meta(s) em andamento
                {nearest ? (
                  <>
                    {" "}
                    — a mais próxima é <b>{nearest.name}</b>, com alvo em{" "}
                    <b>
                      {new Date(nearest.targetDate as string).toLocaleDateString(
                        "pt-BR",
                      )}
                    </b>
                    .
                  </>
                ) : (
                  "."
                )}
              </p>
              <p>
                O aporte sugerido sobe sozinho se você ficar pra trás — é só
                registrar cada aporte que eu recalculo.
              </p>
            </>
          )}
        </Memo>
      </div>
    </div>
  );
}
