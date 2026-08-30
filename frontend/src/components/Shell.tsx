"use client";

import { useAuth, useToast, useUi } from "@/lib/providers";

export type TabKey = "painel" | "faturas" | "metas" | "atividades";

const TABS: { key: TabKey; label: string }[] = [
  { key: "painel", label: "Painel" },
  { key: "faturas", label: "Faturas & Contas" },
  { key: "metas", label: "Metas & Sonhos" },
  { key: "atividades", label: "Atividades" },
];

export function Shell({
  tab,
  onTab,
  children,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  children: React.ReactNode;
}) {
  const { theme, toggleTheme, privacy, togglePrivacy } = useUi();
  const { me, households, currentHousehold, currentHouseholdId, setCurrentHousehold, signOut } =
    useAuth();
  const { toast } = useToast();

  const updatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="wrap">
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="seal">$</div>
          <div>
            <h1>Dossiê Financeiro</h1>
            <p>Ficha de acompanhamento — {currentHousehold?.name ?? "—"}</p>
          </div>
        </div>

        <div className="header-controls" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {households.length > 1 && (
            <select
              aria-label="Trocar de ficha"
              value={currentHouseholdId ?? ""}
              onChange={(e) => setCurrentHousehold(e.target.value)}
              style={{ width: "auto", maxWidth: 180 }}
            >
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}
          <button
            className={`icon-btn ${privacy ? "on" : ""}`}
            title={privacy ? "Mostrar valores" : "Ocultar valores"}
            onClick={() => {
              togglePrivacy();
              toast(
                privacy
                  ? "Valores visíveis novamente."
                  : "Valores ocultos neste dispositivo.",
              );
            }}
          >
            {privacy ? "🙈" : "👁"}
          </button>
          <button
            className={`icon-btn ${theme === "light" ? "on" : ""}`}
            title="Alternar tema"
            onClick={toggleTheme}
          >
            {theme === "light" ? "☀️" : "🌙"}
          </button>
          <button
            className="icon-btn"
            title="Sair"
            onClick={signOut}
            aria-label="Sair"
          >
            ⎋
          </button>
          <div className="protocolo">
            {me ? `AGENTE: ${me.name.toUpperCase()}` : ""}
            <br />
            ATUALIZADO EM <b>{updatedAt}</b>
          </div>
        </div>
      </header>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => onTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="view">{children}</section>
    </div>
  );
}
