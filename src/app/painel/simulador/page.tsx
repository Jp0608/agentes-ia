import { PageHead } from "@/components/ui";
import { RunAgents } from "@/components/RunAgents";
import { aiReady } from "@/lib/brain";
import { SIM_ME } from "@/lib/demo";
import { getSettings } from "@/lib/settings";
import { Simulator } from "./Simulator";

export const metadata = { title: "Simulador" };

export default async function Page() {
  const s = await getSettings();
  return (
    <>
      <PageHead eyebrow="Demonstração" title="Simulador de WhatsApp" />
      <p className="-mt-3 mb-5 max-w-2xl text-[15px] text-soft">
        Converse como se fosse um cliente. A assistente responde de verdade e marca na agenda de verdade, mas nada é enviado para nenhum
        WhatsApp. Ao lado aparece o que o dono recebe.
      </p>
      {!aiReady() && (
        <p className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[13.5px] text-warn">
          A IA está sem chave: a recepção só responde uma mensagem padrão. Configure ANTHROPIC_API_KEY para ver a conversa completa.
        </p>
      )}
      <div className="mb-5"><RunAgents demo /></div>
      <Simulator me={SIM_ME} business={s.businessName || "Seu negócio"} owner={s.ownerName || "Dono"} />
    </>
  );
}
