"use client";

import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDashboard } from "@/lib/dashboard";
import { useAuth, useToast } from "@/lib/providers";
import {
  daysUntil,
  dueLabel,
  fmtBRL,
  fmtDate,
  nextDueDateFromDay,
} from "@/lib/format";
import { Memo, Panel, Stamp, StampTone } from "@/components/ui";

interface UpcomingItem {
  key: string;
  kind: "charge" | "installment";
  id: string;
  title: string;
  subtitle: string;
  amountCents: number;
  due: Date;
  days: number;
  paid: boolean;
  installment?: { current: number; total: number };
}

function stampFor(item: UpcomingItem): { tone: StampTone; text: string } {
  if (item.paid) return { tone: "green", text: "Pago" };
  if (item.days < 0) return { tone: "red", text: dueLabel(item.days) };
  if (item.days <= 3) return { tone: "red", text: dueLabel(item.days) };
  return { tone: "gold", text: dueLabel(item.days) };
}

export function PainelTab() {
  const { summary, projection, charges, installments, reload } = useDashboard();
  const { currentHousehold } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const canMarkPaid = currentHousehold?.permissions.canMarkPaid ?? false;
  const h = currentHousehold?.id ?? "";

  const upcoming = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];

    for (const c of charges) {
      const due = nextDueDateFromDay(c.dueDay);
      const days = daysUntil(due);
      const paidThisMonth =
        c.status === "paid" &&
        c.lastPaidAt != null &&
        new Date(c.lastPaidAt).getMonth() === new Date().getMonth() &&
        new Date(c.lastPaidAt).getFullYear() === new Date().getFullYear();
      items.push({
        key: `c-${c.id}`,
        kind: "charge",
        id: c.id,
        title: c.description,
        subtitle: `Recorrente · dia ${c.dueDay}${c.category ? ` · ${c.category}` : ""}`,
        amountCents: c.amountCents,
        due,
        days,
        paid: paidThisMonth,
      });
    }

    for (const i of installments) {
      if (i.status === "settled") continue;
      const due = new Date(i.nextDueDate);
      items.push({
        key: `i-${i.id}`,
        kind: "installment",
        id: i.id,
        title: i.description,
        subtitle: `Parcelado · ${i.currentInstallment + 1}/${i.totalInstallments}`,
        amountCents: i.installmentAmountCents,
        due,
        days: daysUntil(due),
        paid: false,
        installment: { current: i.currentInstallment, total: i.totalInstallments },
      });
    }

    return items
      .filter((it) => it.paid || it.days <= 12)
      .sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        return a.due.getTime() - b.due.getTime();
      })
      .slice(0, 8);
  }, [charges, installments]);

  const topCategory = summary?.spendingThisMonthByCategory?.[0] ?? null;
  const monthTotal =
    summary?.spendingThisMonthByCategory?.reduce((s, r) => s + r.totalCents, 0) ??
    0;
  const topPct =
    topCategory && monthTotal > 0
      ? Math.round((topCategory.totalCents / monthTotal) * 100)
      : 0;

  const projEnd = projection?.endBalanceCents ?? 0;
  const projLabel = projection?.firstNegativeDate
    ? `Projeção · ${fmtDate(projection.firstNegativeDate)}`
    : `Projeção · ${projection?.horizonDays ?? 90}d`;

  async function pay(item: UpcomingItem) {
    if (!canMarkPaid) {
      toast("Você não tem permissão para marcar pagamentos nesta ficha.", {
        error: true,
      });
      return;
    }
    setBusy(item.key);
    try {
      if (item.kind === "charge") {
        await api.markChargePaid(h, item.id);
        toast("Pagamento registrado. Próximo lembrete reagendado pro mês que vem.");
      } else {
        await api.registerInstallmentPayment(h, item.id);
        toast("Parcela registrada. Vencimento e saldo devedor atualizados.");
      }
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Não deu para registrar.", {
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

  async function runReminders() {
    setBusy("scan");
    try {
      const res = await api.scanReminders(h);
      toast(
        `Varredura feita: ${res.planned} lembrete(s) previstos, ${res.created} novo(s) enviado(s).`,
      );
      await reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Falha ao rodar lembretes.", {
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="view active">
      <div className="grid" style={{ marginBottom: 18 }}>
        <Panel title="Resumo do mês">
          <div className="resumo-row">
            <div className="metric">
              <div className="label">Saldo atual</div>
              <div className="value money">
                {summary ? fmtBRL(summary.totalBalanceCents) : "—"}
              </div>
            </div>
            <div className="metric">
              <div className="label">{projLabel}</div>
              <div className={`value money ${projEnd < 0 ? "neg" : "pos"}`}>
                {projection ? fmtBRL(projEnd) : "—"}
              </div>
            </div>
            <div className="metric">
              <div className="label">Faturas em aberto</div>
              <div className="value">{summary?.openCharges.count ?? "—"}</div>
            </div>
          </div>

          <div className="divider" />

          {topCategory ? (
            <>
              <div className="label">
                Maior gasto do mês — {topCategory.category}
              </div>
              <div className="barra">
                <div style={{ width: `${topPct}%` }} />
              </div>
              <div className="legenda-barra">
                <span className="money">
                  {fmtBRL(topCategory.totalCents)} de{" "}
                  {fmtBRL(monthTotal)}
                </span>
                <span>{topPct}%</span>
              </div>
            </>
          ) : (
            <div className="label">Nenhum gasto lançado neste mês ainda.</div>
          )}
        </Panel>

        <Memo>
          <p>
            {projection?.firstNegativeDate ? (
              <>
                No ritmo atual, seu saldo projetado fica negativo em{" "}
                <b>{fmtDate(projection.firstNegativeDate)}</b> (
                <span className="money">
                  {fmtBRL(projection.lowestBalanceCents)}
                </span>{" "}
                no pior dia).
              </>
            ) : (
              <>
                Projeção no azul pelos próximos{" "}
                <b>{projection?.horizonDays ?? 90} dias</b>. Fecha em{" "}
                <span className="money">{fmtBRL(projEnd)}</span>.
              </>
            )}
          </p>
          <p>
            {topCategory
              ? `Maior gasto do mês: ${topCategory.category} (${topPct}% do total).`
              : "Assim que você lançar gastos, eu te digo pra onde o dinheiro está indo."}
          </p>
          <div>
            <button className="btn" disabled={busy === "scan"} onClick={runReminders}>
              {busy === "scan" ? "Rodando…" : "Rodar lembretes agora"}
            </button>
          </div>
        </Memo>
      </div>

      <Panel title="Vencendo em breve">
        {upcoming.length === 0 && (
          <div className="label">
            Nada vencendo nos próximos dias. Cadastre suas contas na aba{" "}
            <b>Faturas & Contas</b>.
          </div>
        )}
        {upcoming.map((item) => {
          const s = stampFor(item);
          return (
            <div className="fatura" key={item.key}>
              <Stamp tone={s.tone}>{s.text}</Stamp>
              <div className="info">
                <b>{item.title}</b>
                <span>
                  {item.subtitle} · {fmtDate(item.due)}
                </span>
              </div>
              <div className="right-col">
                <div className="valor money">{fmtBRL(item.amountCents)}</div>
                {!item.paid && (
                  <button
                    className="btn mini"
                    disabled={!canMarkPaid || busy === item.key}
                    onClick={() => pay(item)}
                  >
                    {busy === item.key
                      ? "…"
                      : item.kind === "charge"
                        ? "Marcar como paga"
                        : "Registrar parcela"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
