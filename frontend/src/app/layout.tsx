import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Special_Elite } from "next/font/google";
import "./globals.css";
import { AuthProvider, ToastProvider, UiProvider } from "@/lib/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});
const specialElite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-special-elite",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dossiê Financeiro",
  description:
    "Agente financeiro proativo: cobra fatura, projeta o futuro do seu dinheiro e monta plano de ação.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${inter.variable} ${plexMono.variable} ${specialElite.variable}`}
    >
      <body>
        <UiProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </UiProvider>
      </body>
    </html>
  );
}
