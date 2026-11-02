import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Fraunces: títulos e preços. Hanken Grotesk: texto e interface.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const texto = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-texto" });

export const metadata: Metadata = {
  title: "Bibliotheon",
  description: "E-books práticos para resolver problemas reais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${texto.variable} h-full font-sans`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
