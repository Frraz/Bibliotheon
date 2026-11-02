import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_DESCRICAO, SITE_NOME, SITE_URL } from "@/lib/site";

// Fraunces: títulos e preços. Hanken Grotesk: texto e interface.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const texto = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-texto" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NOME} · E-books práticos`, template: `%s | ${SITE_NOME}` },
  description: SITE_DESCRICAO,
  openGraph: { siteName: SITE_NOME, locale: "pt_BR", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${texto.variable} h-full font-sans`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
