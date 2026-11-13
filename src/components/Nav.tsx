"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/painel/actions";
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

// No celular: 4 abas fixas embaixo e o resto dentro de "Mais".
const TABS = NAV.slice(0, 4);
const MORE = NAV.slice(4);

function useActive() {
  const path = usePathname() ?? "";
  return (href: string) => (href === "/painel" ? path === href : path.startsWith(href));
}

/** Menu lateral (computador). */
export function Nav() {
  const active = useActive();
  return (
    <nav aria-label="Painel" className="flex flex-col gap-1">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[16px] font-medium transition ${
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

/** Barra de abas fixa embaixo (celular), com a folha "Mais". */
export function TabBar() {
  const path = usePathname();
  const active = useActive();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((n) => active(n.href));

  // Fecha a folha ao trocar de tela ou com Esc.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tab = (on: boolean) =>
    `flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[12.5px] font-semibold transition ${on ? "text-signal" : "text-soft"}`;

  return (
    <div className="lg:hidden">
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button type="button" aria-label="Fechar" className="absolute inset-0 h-full w-full cursor-default bg-black/60" onClick={() => setOpen(false)} />
          <div className="sheet-pb absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-panel px-4 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
            <ul className="space-y-1">
              {MORE.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    aria-current={active(n.href) ? "page" : undefined}
                    className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-[17px] font-medium ${active(n.href) ? "bg-raise-2 text-ink" : "text-ink active:bg-raise"}`}
                  >
                    <Icon name={n.icon} size={24} className={active(n.href) ? "text-signal" : "text-soft"} />
                    {n.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-line-soft pt-1">
                <form action={logout}>
                  <button type="submit" className="flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left text-[17px] font-medium text-soft active:bg-raise">
                    <Icon name="logout" size={24} /> Sair
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      )}
      <nav aria-label="Painel" className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((n) => {
            const on = active(n.href) && !open;
            return (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={tab(on)}>
                <Icon name={n.icon} size={26} fill={on} />
                {n.label}
              </Link>
            );
          })}
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={tab(open || moreActive)}>
            <Icon name={open ? "close" : "menu"} size={26} />
            Mais
          </button>
        </div>
      </nav>
    </div>
  );
}
