import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { isLoggedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "forum", title: "Recepção no WhatsApp 24 horas", text: "A assistente responde na hora, tira dúvidas, mostra os serviços e marca o horário sozinha, no número do próprio negócio." },
  { icon: "mic", title: "Entende áudio", text: "O cliente manda mensagem de voz e a assistente entende e responde como se fosse texto." },
  { icon: "calendar_month", title: "Agenda sem horário duplicado", text: "Cada profissional ou cadeira tem a sua agenda. Marcar, remarcar e cancelar pelo WhatsApp cai direto no painel." },
  { icon: "notifications_active", title: "Lembrete e confirmação", text: "Na véspera o cliente recebe o lembrete e confirma com uma resposta. Quem cancela abre vaga para a lista de espera." },
  { icon: "autorenew", title: "Chama o cliente de volta", text: "Quem passou do tempo de retorno recebe um convite para voltar. Faltas e orçamentos parados também são cobrados." },
  { icon: "tune", title: "Com a cara do negócio", text: "Nome da atendente, tom de voz, emojis e mensagens prontas. Cada negócio configura o seu jeito de falar." },
];

const CHAT = [
  { me: true, text: "Oi, tem horário pra limpeza amanhã?" },
  { me: false, text: "Oi! 😊 Aqui é a Ana, assistente da Clínica Sorriso. Amanhã tenho 9h, 10h30 ou 14h. Qual fica melhor?" },
  { me: true, text: "10h30" },
  { me: false, text: "Fechado ✅ Limpeza amanhã às 10h30. Te lembro na véspera!" },
];

const STEPS = [
  { n: "1", title: "Crie a conta", text: "Nome do negócio, e-mail e senha. Leva um minuto." },
  { n: "2", title: "Configure", text: "Serviços, preços, horários e o tom da atendente." },
  { n: "3", title: "Conecte o WhatsApp", text: "Aponte a câmera para o QR code e pronto: a assistente começa a atender." },
];

export default async function Home() {
  if (await isLoggedIn()) redirect("/painel");
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5">
      <header className="flex items-center justify-between gap-2 py-4 sm:py-5">
        <Brand size={19} className="min-w-0" />
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link href="/entrar" className="btn-quiet px-3 text-[15px]">Entrar</Link>
          <Link href="/cadastro" className="btn-main px-3.5 text-[15px] sm:px-4">Criar conta</Link>
        </nav>
      </header>

      <main>
        <section className="grid items-center gap-10 py-8 sm:py-10 lg:grid-cols-[1.15fr_1fr] lg:py-16">
          <div>
            <p className="eyebrow">Para clínicas, barbearias, salões e estúdios</p>
            <h1 className="mt-3 text-[36px] font-semibold sm:text-[40px] leading-[1.08] tracking-tight md:text-[54px]">
              Seu WhatsApp atende e agenda sozinho, <span className="text-signal">24 horas</span>.
            </h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-soft">
              O AgendaFlow coloca uma assistente com inteligência artificial no WhatsApp do seu negócio. Ela conversa, marca o horário, lembra o cliente e avisa você. Tudo aparece no painel.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/cadastro" className="btn-main min-h-13 px-6 text-[17px]">Começar grátis <Icon name="arrow_forward" size={20} /></Link>
              <Link href="/entrar" className="btn-soft min-h-13 px-6 text-[17px]">Já tenho conta</Link>
            </div>
          </div>

          <div className="card mx-auto w-full max-w-sm p-4">
            <div className="mb-3 flex items-center gap-2.5 border-b border-line-soft pb-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-signal/15 text-signal"><Icon name="smart_toy" size={20} /></span>
              <span>
                <span className="block text-[15px] font-semibold">Clínica Sorriso</span>
                <span className="block text-[13px] text-signal">online</span>
              </span>
            </div>
            <div className="space-y-2">
              {CHAT.map((m, i) => (
                <p key={i} className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-[15px] leading-snug ${m.me ? "ml-auto bg-signal text-on-signal" : "bg-raise-2 text-ink"}`}>
                  {m.text}
                </p>
              ))}
            </div>
            <p className="mt-3 text-center text-[13px] text-faint">A assistente responde e marca no WhatsApp</p>
          </div>
        </section>

        <section className="py-8">
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">Tudo no mesmo fluxo</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-signal/15 text-signal"><Icon name={f.icon} size={22} /></span>
                <h3 className="mt-3 text-[17px] font-semibold">{f.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-soft">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-8">
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[28px]">Funcionando em três passos</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="box p-5">
                <span className="num text-[30px] font-bold leading-none text-signal">{s.n}</span>
                <h3 className="mt-2 text-[17px] font-semibold">{s.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-soft">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="my-10 card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <h2 className="text-[22px] font-semibold leading-tight tracking-tight">Coloque sua agenda para encher sozinha</h2>
            <p className="mt-1 text-[16px] text-soft">Crie a conta, conecte o WhatsApp e deixe a assistente atender.</p>
          </div>
          <Link href="/cadastro" className="btn-main min-h-13 w-full px-6 text-[17px] sm:w-auto">Criar conta grátis <Icon name="arrow_forward" size={20} /></Link>
        </section>
      </main>

      <footer className="border-t border-line-soft py-6 text-[14px] text-faint">AgendaFlow · agenda e atendimento por WhatsApp com inteligência artificial</footer>
    </div>
  );
}
