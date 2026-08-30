import type { Tokens } from "./types";

/**
 * Guarda tokens e a ficha selecionada no localStorage.
 *
 * Nota de segurança: o backend é stateless por token (JWT curto + refresh
 * rotativo). Guardar no localStorage é o suficiente pro MVP; se isto virar
 * SaaS, migrar o refresh token para cookie httpOnly (ver SEGURANCA.md).
 */
const TOKENS_KEY = "dossie.tokens";
const HOUSEHOLD_KEY = "dossie.household";
const THEME_KEY = "dossie.theme";
const PRIVACY_KEY = "dossie.privacy";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* modo privado / storage bloqueado */
  }
}
function safeDel(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export const session = {
  getTokens(): Tokens | null {
    const raw = safeGet(TOKENS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Tokens;
      return parsed.accessToken && parsed.refreshToken ? parsed : null;
    } catch {
      return null;
    }
  },
  setTokens(tokens: Tokens) {
    safeSet(TOKENS_KEY, JSON.stringify(tokens));
  },
  clear() {
    safeDel(TOKENS_KEY);
    safeDel(HOUSEHOLD_KEY);
  },

  getHouseholdId(): string | null {
    return safeGet(HOUSEHOLD_KEY);
  },
  setHouseholdId(id: string) {
    safeSet(HOUSEHOLD_KEY, id);
  },

  getTheme(): "dark" | "light" {
    return safeGet(THEME_KEY) === "light" ? "light" : "dark";
  },
  setTheme(theme: "dark" | "light") {
    safeSet(THEME_KEY, theme);
  },

  getPrivacy(): boolean {
    return safeGet(PRIVACY_KEY) === "on";
  },
  setPrivacy(on: boolean) {
    safeSet(PRIVACY_KEY, on ? "on" : "off");
  },
};
