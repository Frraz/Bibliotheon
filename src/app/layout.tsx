import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bibliotheon",
  description: "E-books práticos para resolver problemas reais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
