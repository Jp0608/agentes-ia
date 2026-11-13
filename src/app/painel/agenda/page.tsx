import { ApptButtons } from "@/components/ApptButtons";
import { Icon } from "@/components/Icon";
import { ActionForm, PageHead, StatusTag } from "@/components/ui";
import { appointmentsBetween } from "@/lib/booking";
import { getSettings } from "@/lib/settings";
import { addDays, brl, dayKey, hourLabel, parts, WEEKDAYS, zoned } from "@/lib/time";
import { newAppointment } from "../actions";

export const metadata = { title: "Agenda" };

export default async function Page() {
  const s = await getSettings();
  const tz = s.timezone;
  const now = new Date();
  const today = dayKey(now, tz);
  const appts = await appointmentsBetween(zoned(addDays(today, -1), "00:00", tz), zoned(addDays(today, 8), "00:00", tz));
  const days = Array.from({ length: 9 }, (_, i) => addDays(today, i - 1));
  return (
    <>
      <PageHead eyebrow="Agenda" title="Próximos dias">
        <a href="#marcar" className="btn-main xl:hidden"><Icon name="add" size={20} /> Marcar horário</a>
      </PageHead>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3 sm:space-y-4">
          {days.map((d) => {
            const list = appts.filter((a) => dayKey(a.starts_at, tz) === d);
            const wd = parts(zoned(d, "12:00", tz), tz).wd;
            const label = d === today ? "Hoje" : d === addDays(today, 1) ? "Amanhã" : d === addDays(today, -1) ? "Ontem" : WEEKDAYS[wd];
            return (
              <section key={d} className="card p-4">
                <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[19px] font-semibold capitalize">
                  {label} <span className="font-mono text-[14px] font-normal text-faint">{d.split("-").reverse().join("/")}</span>
                  {!s.hours[wd] && <span className="text-[14px] font-normal normal-case text-faint">· fechado</span>}
                </h2>
                {list.length === 0 ? (
                  <p className="text-[15px] text-faint">Nada marcado.</p>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {list.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                        <span className="num w-14 shrink-0 self-start font-mono text-[16px] font-semibold text-signal sm:self-center">{hourLabel(a.starts_at, tz)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold">{a.client_name || a.client_phone}{a.client_simulated && <span className="ml-1.5 text-[13px] font-normal text-faint">(simulado)</span>}</span>
                          <span className="block text-[14px] leading-snug text-soft">{a.service} · {a.resource} · {brl(a.price)} · {a.source === "whatsapp" ? "marcado pelo WhatsApp" : a.source === "demo" ? "demonstração" : "marcado no painel"}</span>
                        </span>
                        <StatusTag status={a.status} />
                        <ApptButtons id={a.id} status={a.status} past={a.starts_at < now} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <aside id="marcar" className="card h-fit scroll-mt-24 p-4 sm:p-5 xl:sticky xl:top-6">
          <h2 className="mb-3 text-[19px] font-semibold">Marcar horário</h2>
          <ActionForm action={newAppointment} submit="Marcar" className="space-y-3">
            <div><label className="label" htmlFor="ap-phone">WhatsApp</label><input id="ap-phone" name="phone" className="field" placeholder="(11) 99999-0000" required inputMode="tel" /></div>
            <div><label className="label" htmlFor="ap-name">Nome</label><input id="ap-name" name="name" className="field" /></div>
            <div>
              <label className="label" htmlFor="ap-service">Serviço</label>
              <select id="ap-service" name="service" className="field">{s.services.map((x) => <option key={x.name}>{x.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0"><label className="label" htmlFor="ap-day">Dia</label><input id="ap-day" name="day" type="date" className="field min-w-0" defaultValue={today} required /></div>
              <div className="min-w-0"><label className="label" htmlFor="ap-time">Hora</label><input id="ap-time" name="time" type="time" step={300} className="field min-w-0" required /></div>
            </div>
            <div>
              <label className="label" htmlFor="ap-res">Onde / com quem</label>
              <select id="ap-res" name="resource" className="field"><option value="">Primeiro livre</option>{s.resources.map((r) => <option key={r}>{r}</option>)}</select>
            </div>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
