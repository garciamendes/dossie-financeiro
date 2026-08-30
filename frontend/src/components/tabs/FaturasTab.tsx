"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { useAuth, useToast } from "@/lib/providers";
import {
  daysUntil,
  dueLabel,
  fmtBRL,
  fmtDate,
  nextDueDateFromDay,
  parseBRLToCents,
} from "@/lib/format";
import { Panel, Stamp, StampTone } from "@/components/ui";

const CATEGORIES = [
  "Moradia",
  "Assinatura",
  "Cartão de crédito",
  "Transporte",
  "Alimentação",
  "Saúde",
  "Lazer",
  "Outros",
];

type Kind = "recorrente" | "parcelada";

export function FaturasTab() {
  const { charges, installments, reload } = useDashboard();
  const { currentHousehold } = useAuth();
  const { toast } = useToast();

  const h = currentHousehold?.id ?? "";
  const canCreate = currentHousehold?.permissions.canCreateCharge ?? false;
  const canMarkPaid = currentHousehold?.permissions.canMarkPaid ?? false;

  const [kind, setKind] = useState<Kind>("recorrente");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [installmentsCount, setInstallmentsCount] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [wpp, setWpp] = useState(true);
  const [tg, setTg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function resetForm() {
    setDescription("");
    setAmount("");
    setDueDay("");
    setInstallmentsCount("");
    setAlreadyPaid("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) {
      toast("Você não tem permissão para cadastrar nesta ficha.", { error: true });
      return;
    }
    const amountCents = parseBRLToCents(amount);
    if (!description.trim() || Number.isNaN(amountCents) || amountCents <= 0) {
      toast("Preencha descrição e um valor válido.", { error: true });
      return;
    }
    const day = parseInt(dueDay, 10);
    if (Number.isNaN(day) || day < 1 || day > 31) {
      toast("Dia de vencimento precisa ser de 1 a 31.", { error: true });
      return;
    }

    setSaving(true);
    try {
      if (kind === "recorrente") {
        await api.createCharge(h, {
          description: description.trim(),
          amountCents,
          dueDay: day,
          category,
          remindViaWhatsapp: wpp,
          remindViaTelegram: tg,
        });
        toast("Recorrência salva na ficha. Lembretes agendados.");
      } else {
        const total = parseInt(installmentsCount, 10);
        if (Number.isNaN(total) || total < 1) {
          toast("Informe o número de parcelas.", { error: true });
          setSaving(false);
          return;
        }
        const paid = parseInt(alreadyPaid || "0", 10) || 0;
        await api.createInstallment(h, {
          description: description.trim(),
          installmentAmountCents: amountCents,
          totalInstallments: total,
          currentInstallment: paid,
          nextDueDate: nextDueDateFromDay(day).toISOString(),
          category,
        });
        toast("Compra parcelada cadastrada. A transição de parcela é automática.");
      }
      resetForm();
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Não deu para salvar.", {
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  async function payCharge(id: string) {
    setBusy(`c-${id}`);
    try {
      await api.markChargePaid(h, id);
      toast("Pagamento registrado.");
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Falha ao registrar.", {
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

  async function payInstallment(id: string) {
    setBusy(`i-${id}`);
    try {
      const updated = await api.registerInstallmentPayment(h, id);
      toast(
        updated.status === "settled"
          ? `Compra "${updated.description}" quitada e fora da lista de abertos.`
          : `Parcela ${updated.currentInstallment}/${updated.totalInstallments} registrada.`,
      );
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Falha ao registrar.", {
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="view active">
      <div className="grid">
        <Panel title="Cadastrar fatura / recorrência">
          <form onSubmit={submit}>
            <div className="form-row">
              <div>
                <label>Descrição</label>
                <input
                  placeholder="Ex: Netflix, Notebook 10x..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label>{kind === "parcelada" ? "Valor da parcela (R$)" : "Valor (R$)"}</label>
                <input
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="form-row">
              <div>
                <label>Dia de vencimento</label>
                <input
                  placeholder="Ex: 10"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label>Tipo</label>
                <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  <option value="recorrente">Recorrente (mensalidade)</option>
                  <option value="parcelada">Compra parcelada</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div>
                <label>Nº de parcelas</label>
                <input
                  placeholder={kind === "parcelada" ? "Ex: 10" : "—"}
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  disabled={kind !== "parcelada"}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label>Parcelas já pagas</label>
                <input
                  placeholder={kind === "parcelada" ? "Ex: 3" : "—"}
                  value={alreadyPaid}
                  onChange={(e) => setAlreadyPaid(e.target.value)}
                  disabled={kind !== "parcelada"}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="form-row full">
              <div>
                <label>Categoria</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row full">
              <div>
                <label>Onde te aviso</label>
                <div className="canais">
                  <button
                    type="button"
                    className={`canal ${wpp ? "on" : ""}`}
                    onClick={() => setWpp((v) => !v)}
                  >
                    📲<span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className={`canal ${tg ? "on" : ""}`}
                    onClick={() => setTg((v) => !v)}
                  >
                    ✈️<span>Telegram</span>
                  </button>
                  <div className="canal on" aria-hidden>
                    🌐<span>Painel</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="btn"
              style={{ marginTop: 4 }}
              disabled={saving || !canCreate}
            >
              {saving ? "Salvando…" : "Salvar na ficha"}
            </button>
            {!canCreate && (
              <div className="label" style={{ marginTop: 8 }}>
                Seu perfil nesta ficha não permite cadastrar contas.
              </div>
            )}
          </form>
        </Panel>

        <Panel title="Todas as contas">
          {charges.length === 0 && installments.length === 0 && (
            <div className="label">Nada cadastrado ainda.</div>
          )}

          {charges.map((c) => {
            const due = nextDueDateFromDay(c.dueDay);
            const d = daysUntil(due);
            const paidThisMonth =
              c.status === "paid" &&
              c.lastPaidAt != null &&
              new Date(c.lastPaidAt).getMonth() === new Date().getMonth();
            const tone: StampTone = paidThisMonth
              ? "green"
              : d <= 3
                ? "red"
                : "gold";
            return (
              <div className="fatura" key={c.id}>
                <Stamp tone={tone}>
                  {paidThisMonth ? "Pago" : dueLabel(d)}
                </Stamp>
                <div className="info">
                  <b>{c.description}</b>
                  <span>
                    Recorrente · dia {c.dueDay}
                    {c.category ? ` · ${c.category}` : ""}
                  </span>
                </div>
                <div className="right-col">
                  <div className="valor money">{fmtBRL(c.amountCents)}</div>
                  <button
                    className="btn mini"
                    disabled={!canMarkPaid || paidThisMonth || busy === `c-${c.id}`}
                    onClick={() => payCharge(c.id)}
                  >
                    {paidThisMonth ? "Pago ✓" : busy === `c-${c.id}` ? "…" : "Marcar como paga"}
                  </button>
                </div>
              </div>
            );
          })}

          {installments.map((i) => {
            const pct = Math.round(
              (i.currentInstallment / i.totalInstallments) * 100,
            );
            const settled = i.status === "settled";
            const d = daysUntil(new Date(i.nextDueDate));
            const owed =
              (i.totalInstallments - i.currentInstallment) *
              i.installmentAmountCents;
            const tone: StampTone = settled ? "gold" : d <= 3 ? "red" : "green";
            return (
              <div className="fatura" key={i.id}>
                <Stamp tone={tone}>
                  {settled ? "Quitado" : dueLabel(d)}
                </Stamp>
                <div className="info">
                  <b>{i.description}</b>
                  <span>
                    Compra parcelada{i.category ? ` · ${i.category}` : ""}
                  </span>
                  <div className="parcela-track">
                    <div className="parcela-label">
                      <span>
                        Parcela {Math.min(i.currentInstallment + (settled ? 0 : 1), i.totalInstallments)} de{" "}
                        {i.totalInstallments}
                        {settled ? " · quitada" : ` · próxima ${fmtDate(i.nextDueDate)}`}
                      </span>
                    </div>
                    <div className="parcela-bar">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    {!settled && (
                      <div className="saldo-devedor">
                        Saldo devedor:{" "}
                        <span className="saldo-valor money">{fmtBRL(owed)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="right-col">
                  <div className="valor money">
                    {fmtBRL(i.installmentAmountCents)}
                  </div>
                  {!settled && (
                    <button
                      className="btn mini"
                      disabled={!canMarkPaid || busy === `i-${i.id}`}
                      onClick={() => payInstallment(i.id)}
                    >
                      {busy === `i-${i.id}` ? "…" : "Registrar parcela"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}
