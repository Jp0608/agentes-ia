import type { Metadata, Viewport } from "next";
import { Geist_Mono, Hanken_Grotesk, Outfit } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AgendaFlow", template: "%s · AgendaFlow" },
  description: "AgendaFlow: agentes de IA que atendem o WhatsApp, marcam horário, chamam o cliente de volta e avisam o dono.",
};

export const viewport: Viewport = { themeColor: "#121414", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${hanken.variable} ${outfit.variable} ${mono.variable}`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..500,0..1,0&display=block" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
