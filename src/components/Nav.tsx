"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

// Menu do dono do negócio: só o que ele usa no dia a dia. As telas de Simulador, Agentes, Orçamentos
// e Mapa continuam existindo pelo endereço (/painel/simulador etc.), fora do menu.
export const NAV = [
  { href: "/painel", label: "Início", icon: "home" },
  { href: "/painel/agenda", label: "Agenda", icon: "calendar_month" },
  { href: "/painel/conversas", label: "Conversas", icon: "forum" },
  { href: "/painel/clientes", label: "Clientes", icon: "group" },
  { href: "/painel/whatsapp", label: "WhatsApp", icon: "qr_code_2" },
  { href: "/painel/configurar", label: "Configurar", icon: "tune" },
  { href: "/painel/conta", label: "Minha conta", icon: "account_circle" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/painel" ? path === href : path.startsWith(href));
  return (
    <nav aria-label="Painel" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible [scrollbar-width:none]">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-3 text-[16px] font-medium transition ${
            active(n.href) ? "bg-raise-2 text-ink" : "text-soft hover:bg-raise hover:text-ink"
          }`}
        >
          <Icon name={n.icon} size={22} className={active(n.href) ? "text-signal" : ""} />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
