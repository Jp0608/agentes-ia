import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/ui";
import { connectionState, evoServer, instanceInfo, jidDigits } from "@/lib/whatsapp";
import { Connect } from "./Connect";

export const metadata = { title: "WhatsApp" };

export default async function Page() {
  const configured = Boolean(evoServer());
  const state = configured ? await connectionState() : null;
  const info = state?.ok && state.data === "open" ? await instanceInfo() : null;
  return (
    <>
      <PageHead eyebrow="Conexão" title="WhatsApp" />
      <section className="card max-w-2xl p-5">
        {!configured ? (
          <div className="space-y-3 text-[14px] text-soft">
            <p className="flex items-center gap-2 font-semibold text-warn"><Icon name="warning" size={18} /> A Evolution API ainda não está ligada.</p>
            <p>Coloque estas variáveis na Vercel e faça o redeploy:</p>
            <ul className="space-y-1 font-mono text-[13px] text-ink">
              <li>EVOLUTION_API_URL = endereço do Railway (https://…up.railway.app)</li>
              <li>EVOLUTION_API_KEY = AUTHENTICATION_API_KEY do Railway</li>
            </ul>
            <p>Enquanto isso, o simulador funciona normalmente.</p>
          </div>
        ) : !state?.ok ? (
          <p className="flex items-center gap-2 text-[14px] text-alert"><Icon name="error" size={18} /> {state?.ok === false ? state.error : ""}</p>
        ) : (
          <Connect connected={state.data === "open"} phone={info ? jidDigits(info.ownerJid) : ""} profile={info?.profileName ?? ""} />
        )}
      </section>
    </>
  );
}
