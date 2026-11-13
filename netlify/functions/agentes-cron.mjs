// Netlify: roda os agentes de todos os negócios a cada 10 minutos, sem ninguém abrir o painel.
export default async () => {
  const base = process.env.URL || process.env.APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("faltam URL ou CRON_SECRET", { status: 500 });
  const r = await fetch(`${base}/api/cron`, { headers: { authorization: `Bearer ${secret}` } }).catch((e) => ({ status: 0, text: async () => String(e) }));
  console.log("agentes:", r.status, (await r.text()).slice(0, 300));
  return new Response("ok");
};

export const config = { schedule: "*/10 * * * *" };
