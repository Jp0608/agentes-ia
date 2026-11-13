"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export const NAV = [
  { href: "/painel", label: "Painel", icon: "dashboard" },
  { href: "/painel/agenda", label: "Agenda", icon: "calendar_month" },
  { href: "/painel/simulador", label: "Simulador", icon: "smartphone" },
  { href: "/painel/conversas", label: "Conversas", icon: "forum" },
  { href: "/painel/agentes", label: "Agentes", icon: "smart_toy" },
  { href: "/painel/orcamentos", label: "Orçamentos", icon: "request_quote" },
  { href: "/painel/clientes", label: "Clientes", icon: "group" },
  { href: "/painel/mapa", label: "Mapa", icon: "hub" },
  { href: "/painel/whatsapp", label: "WhatsApp", icon: "qr_code_2" },
  { href: "/painel/configurar", label: "Configurar", icon: "tune" },
  { href: "/painel/conta", label: "Conta", icon: "account_circle" },
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
          className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition ${
            active(n.href) ? "bg-raise-2 text-ink" : "text-soft hover:bg-raise hover:text-ink"
          }`}
        >
          <Icon name={n.icon} size={19} className={active(n.href) ? "text-signal" : ""} />
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
