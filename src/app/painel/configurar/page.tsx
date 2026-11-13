import { ActionForm, PageHead } from "@/components/ui";
import { GROUPS, NICHES } from "@/lib/niches";
import { getSettings } from "@/lib/settings";
import { WEEKDAYS } from "@/lib/time";
import { saveConfig } from "../actions";
import { PersonaFields } from "./PersonaFields";

export const metadata = { title: "Configurar" };

export default async function Page() {
  const s = await getSettings();
  const services = s.services.map((x) => `${x.name} | ${x.minutes} | ${x.price}`).join("\n");
  return (
    <>
      <PageHead eyebrow={s.configured ? "Configuração" : "Primeiro passo"} title={s.configured ? "Configurar o negócio" : "Vamos configurar o negócio"} />
      {!s.configured && (
        <p className="-mt-3 mb-5 max-w-2xl text-[14px] text-soft">
          Escolha o tipo de negócio e preencha o básico. Os serviços, os preços e o tempo de retorno já vêm prontos para o nicho e dá para ajustar depois.
        </p>
      )}
      <ActionForm action={saveConfig} submit={s.configured ? "Salvar" : "Salvar e começar"} className="max-w-3xl space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-[15px] font-semibold">Negócio</h2>
          <div>
            <label className="label" htmlFor="niche">Tipo de negócio</label>
            <select id="niche" name="niche" className="field" defaultValue={s.niche}>
              {GROUPS.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {NICHES.filter((n) => n.group === g.id).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </optgroup>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-[13px] text-soft">
              <input type="checkbox" name="useNicheServices" defaultChecked={!s.configured} className="h-4 w-4 accent-[#aee627]" />
              Ao trocar o tipo, usar os serviços, os locais de atendimento e o tempo de retorno do novo nicho
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="businessName">Nome do negócio</label><input id="businessName" name="businessName" className="field" defaultValue={s.businessName} required /></div>
            <div><label className="label" htmlFor="address">Endereço</label><input id="address" name="address" className="field" defaultValue={s.address} placeholder="Rua, número, bairro, cidade" /></div>
            <div><label className="label" htmlFor="ownerName">Nome do dono</label><input id="ownerName" name="ownerName" className="field" defaultValue={s.ownerName} /></div>
            <div>
              <label className="label" htmlFor="ownerPhone">WhatsApp do dono</label>
              <input id="ownerPhone" name="ownerPhone" className="field" defaultValue={s.ownerPhone} inputMode="tel" placeholder="(11) 99999-0000" />
              <p className="mt-1 text-[12px] text-faint">Recebe a página da manhã e os alertas. Vazio: aparecem só no painel e no simulador.</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="about">Informações para a recepção responder</label>
            <textarea id="about" name="about" className="field min-h-28" defaultValue={s.about} placeholder="Formas de pagamento, estacionamento, convênios aceitos, política de atraso, perguntas comuns…" />
          </div>
          <div><label className="label" htmlFor="googleReviewUrl">Link de avaliação no Google</label><input id="googleReviewUrl" name="googleReviewUrl" className="field" defaultValue={s.googleReviewUrl} placeholder="https://g.page/r/…/review" /></div>
        </section>

        <PersonaFields
          initial={s.persona}
          businessName={s.businessName}
          services={s.services.map((x) => `${x.name}${x.price > 0 ? ` (R$ ${x.price.toFixed(2).replace(".", ",")})` : ""}`).join(", ")}
        />

        <section className="card space-y-3 p-5">
          <h2 className="text-[15px] font-semibold">Horário de funcionamento</h2>
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="flex flex-wrap items-center gap-3">
              <label className="flex w-28 items-center gap-2 text-[14px] capitalize"><input type="checkbox" name={`open-${i}`} defaultChecked={Boolean(s.hours[i])} className="h-4 w-4 accent-[#aee627]" /> {d}</label>
              <label className="sr-only" htmlFor={`from-${i}`}>Abre {d}</label>
              <input id={`from-${i}`} name={`from-${i}`} type="time" className="field w-32" defaultValue={s.hours[i]?.open ?? "09:00"} />
              <span className="text-faint">às</span>
              <label className="sr-only" htmlFor={`to-${i}`}>Fecha {d}</label>
              <input id={`to-${i}`} name={`to-${i}`} type="time" className="field w-32" defaultValue={s.hours[i]?.close ?? "18:00"} />
            </div>
          ))}
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-[15px] font-semibold">Serviços e agenda</h2>
          <div>
            <label className="label" htmlFor="services">Serviços (um por linha: nome | minutos | preço)</label>
            <textarea id="services" name="services" className="field min-h-36 font-mono text-[13px]" defaultValue={services} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="resources">Quem ou onde atende (um por linha)</label>
              <textarea id="resources" name="resources" className="field min-h-24 font-mono text-[13px]" defaultValue={s.resources.join("\n")} />
              <p className="mt-1 text-[12px] text-faint">Cada linha é uma agenda: dá para atender um de cada vez em cada uma.</p>
            </div>
            <div className="space-y-4">
              <div><label className="label" htmlFor="returnDays">Retorno: chamar o cliente depois de quantos dias</label><input id="returnDays" name="returnDays" type="number" min={1} className="field" defaultValue={s.returnDays} /></div>
              <div>
                <label className="label" htmlFor="slotMinutes">Intervalo entre horários</label>
                <select id="slotMinutes" name="slotMinutes" className="field" defaultValue={String(s.slotMinutes)}>
                  {[15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="cancelHours">Cancelamento pelo WhatsApp até quantas horas antes</label><input id="cancelHours" name="cancelHours" type="number" min={0} className="field" defaultValue={s.cancelHours} /></div>
            </div>
          </div>
        </section>
      </ActionForm>
    </>
  );
}
