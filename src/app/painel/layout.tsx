import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { requireLogin } from "@/lib/auth";
import { aiReady } from "@/lib/brain";
import { findNiche } from "@/lib/niches";
import { getSettings } from "@/lib/settings";
import { evoServer } from "@/lib/whatsapp";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireLogin();
  const s = await getSettings();
  const n = findNiche(s.niche);
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col lg:flex-row">
      <aside className="sticky top-0 z-10 border-b border-line bg-bg/95 px-3 py-3 backdrop-blur lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="mb-3 flex items-center justify-between gap-2 px-1 lg:mb-6 lg:block">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-signal/40 bg-panel text-signal"><Icon name={n.icon} size={20} /></span>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold">{s.businessName || "Seu negócio"}</span>
              <span className="block truncate text-[12px] text-faint">{n.label}</span>
            </span>
          </div>
          <form action={logout} className="lg:hidden"><button className="btn-quiet min-h-8 px-2 text-[13px]">Sair</button></form>
        </div>
        <Nav />
        <div className="mt-6 hidden space-y-2 px-1 text-[12px] lg:block">
          <Status ok={aiReady()} label="IA" off="sem chave" />
          <Status ok={Boolean(evoServer())} label="WhatsApp" off="não configurado" />
          <form action={logout}><button className="btn-quiet mt-2 -ml-3 min-h-8 text-[13px]"><Icon name="logout" size={17} /> Sair</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
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
