"use client";

import { fmtBRL } from "@/lib/format";

export function Money({
  cents,
  className = "",
}: {
  cents: number;
  className?: string;
}) {
  return <span className={`money ${className}`}>{fmtBRL(cents)}</span>;
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Memo({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`memo ${className}`}>
      <h2>O agente diz</h2>
      {children}
    </div>
  );
}

export function ProgressBar({
  pct,
  green = false,
}: {
  pct: number;
  green?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="barra">
      <div
        style={{
          width: `${clamped}%`,
          background: green ? "var(--stamp-green)" : undefined,
        }}
      />
    </div>
  );
}

export type StampTone = "red" | "green" | "gold";

export function Stamp({ tone, children }: { tone: StampTone; children: React.ReactNode }) {
  return <span className={`stamp ${tone}`}>{children}</span>;
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label>{label}</label>
      <input {...props} />
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label>{label}</label>
      <select {...props}>{children}</select>
    </div>
  );
}

export function Avatar({ name, isYou }: { name: string; isYou: boolean }) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div className={`log-avatar ${isYou ? "you" : "partner"}`}>{letter}</div>
  );
}
