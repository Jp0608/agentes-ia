import "server-only";

/**
 * Banco de dados. Com DATABASE_URL (Supabase em produção) usa o Postgres de verdade; sem ela,
 * um Postgres embutido (PGlite) salvo em .data/, bom para rodar no computador e para demonstração.
 * As tabelas são criadas sozinhas no primeiro acesso.
 */
export type Row = Record<string, unknown>;
export type Q = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;
type Db = { q: Q; tx: <R>(fn: (q: Q) => Promise<R>) => Promise<R> };

const SCHEMA = `
create table if not exists settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id bigserial primary key,
  phone text not null unique,
  name text not null default '',
  notes text not null default '',
  simulated boolean not null default false,
  opt_out boolean not null default false,
  last_return_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id bigserial primary key,
  client_id bigint not null references clients(id) on delete cascade,
  service text not null,
  price numeric(10,2) not null default 0,
  resource text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'marcado',
  source text not null default 'painel',
  reminder_sent_at timestamptz,
  confirmed_at timestamptz,
  review_asked_at timestamptz,
  review_score int,
  review_text text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_starts on appointments (starts_at);
create index if not exists appointments_client on appointments (client_id);

create table if not exists waitlist (
  id bigserial primary key,
  client_id bigint not null references clients(id) on delete cascade,
  service text not null,
  wants text not null default '',
  status text not null default 'esperando',
  offered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id bigserial primary key,
  client_id bigint not null references clients(id) on delete cascade,
  title text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  explanation text not null default '',
  status text not null default 'rascunho',
  sent_at timestamptz,
  followups int not null default 0,
  last_followup_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id bigserial primary key,
  phone text not null,
  direction text not null,
  body text not null,
  agent text,
  ext_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists messages_phone on messages (phone, created_at);

create table if not exists activity (
  id bigserial primary key,
  agent text not null,
  summary text not null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists activity_created on activity (created_at);

create table if not exists job_runs (
  key text primary key,
  ran_at timestamptz not null default now()
);
`;

let dbPromise: Promise<Db> | null = null;

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    // prepare: false porque o pooler do Supabase (porta 6543) não aceita comandos preparados.
    const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
    const wrap = (s: typeof sql): Q => async (text, params = []) => (await s.unsafe(text, params as never[])) as never;
    const db: Db = {
      q: wrap(sql),
      tx: (fn) => sql.begin((t) => fn(wrap(t as unknown as typeof sql))) as never,
    };
    await sql.unsafe(SCHEMA);
    return db;
  }
  if (process.env.VERCEL) throw new Error("Falta a variável DATABASE_URL (Postgres do Supabase).");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || ".data/pglite";
  (await import("fs")).mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.exec(SCHEMA);
  const q: Q = async (text, params = []) => (await pg.query(text, params as unknown[])).rows as never;
  return {
    q,
    tx: (fn) => pg.transaction((t) => fn(async (text, params = []) => (await t.query(text, params as unknown[])).rows as never)),
  };
}

function db() {
  if (!dbPromise) dbPromise = open().catch((e) => { dbPromise = null; throw e; });
  return dbPromise;
}

export const q: Q = async (text, params) => (await db()).q(text, params);
export const tx = async <R>(fn: (q: Q) => Promise<R>) => (await db()).tx(fn);
