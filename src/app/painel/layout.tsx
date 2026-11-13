import { after } from "next/server";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { Nav, TabBar } from "@/components/Nav";
import { requireSession } from "@/lib/auth";
import { aiReady } from "@/lib/brain";
import { maybeRunAgents } from "@/lib/jobs";
import { findNiche } from "@/lib/niches";
import { getSettings } from "@/lib/settings";
import { withTenant } from "@/lib/tenant";
import { evoServer } from "@/lib/whatsapp";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { tenantId } = await requireSession();
  const s = await getSettings();
  // Depois da resposta não há cookie para ler: o tenant vai junto.
  after(() => withTenant(tenantId, () => maybeRunAgents(s)).catch(() => null));
  const n = findNiche(s.niche);
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col lg:flex-row">
      {/* Celular: barra de cima compacta com o nome do negócio. */}
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-signal/40 bg-panel text-signal"><Icon name={n.icon} size={22} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold leading-tight">{s.businessName || "Seu negócio"}</span>
              <span className="block truncate text-[13px] text-faint">{n.label}</span>
            </span>
          </div>
          <Brand size={14} className="shrink-0 text-faint" />
        </div>
      </header>

      {/* Computador: menu lateral. */}
      <aside className="sticky top-0 z-10 hidden h-dvh w-64 shrink-0 border-r border-line bg-bg/95 px-4 py-6 backdrop-blur lg:block">
        <div className="mb-5 px-1"><Brand size={19} /></div>
        <div className="mb-6 flex min-w-0 items-center gap-2.5 px-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-signal/40 bg-panel text-signal"><Icon name={n.icon} size={20} /></span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{s.businessName || "Seu negócio"}</span>
            <span className="block truncate text-[13px] text-faint">{n.label}</span>
          </span>
        </div>
        <Nav />
        <div className="mt-6 space-y-2 px-1 text-[13px]">
          <Status ok={aiReady() && Boolean(evoServer())} label="Atendimento" off="precisa de ajuste" />
          <form action={logout}><button className="btn-quiet mt-2 -ml-3 min-h-10 text-[15px]"><Icon name="logout" size={18} /> Sair</button></form>
        </div>
      </aside>

      <main className="pb-tabbar min-w-0 flex-1 px-4 pt-5 text-[16px] sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      <TabBar />
    </div>
  );
}

function Status({ ok, label, off }: { ok: boolean; label: string; off: string }) {
  return (
    <p className="flex items-center gap-2 text-faint">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-signal" : "bg-warn"}`} />
      {label}: <span className={ok ? "text-soft" : "text-warn"}>{ok ? "ligado" : off}</span>
    </p>
  );
}
