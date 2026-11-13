import "server-only";

/**
 * Banco de dados. Com DATABASE_URL (Supabase em produção) usa o Postgres de verdade; sem ela,
 * um Postgres embutido (PGlite) salvo em .data/, bom para rodar no computador e para demonstração.
 * As tabelas são criadas sozinhas no primeiro acesso.
 */
export type Row = Record<string, unknown>;
export type Q = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;
type Db = { q: Q; tx: <R>(fn: (q: Q) => Promise<R>) => Promise<R> };

/**
 * Multiempresa: cada conta (accounts) é dona de um tenant, e toda tabela de negócio tem tenant_id.
 * Bancos antigos (de antes das contas) migram sozinhos: as linhas existentes ficam no tenant 1 e as
 * restrições que eram globais (telefone do cliente, id da mensagem, chave do job, id das configurações)
 * passam a valer por tenant. Roda tudo numa transação só (o texto vai inteiro numa consulta simples),
 * com trava para dois servidores não migrarem ao mesmo tempo.
 */
const SCHEMA = `
select pg_advisory_xact_lock(4241);

create table if not exists accounts (
  id bigserial primary key,
  tenant_id bigint not null unique,
  email text not null unique,
  password_hash text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists settings (
  tenant_id bigint not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id bigserial primary key,
  tenant_id bigint not null,
  phone text not null,
  name text not null default '',
  notes text not null default '',
  simulated boolean not null default false,
  opt_out boolean not null default false,
  last_return_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id bigserial primary key,
  tenant_id bigint not null,
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
  tenant_id bigint not null,
  client_id bigint not null references clients(id) on delete cascade,
  service text not null,
  wants text not null default '',
  status text not null default 'esperando',
  offered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id bigserial primary key,
  tenant_id bigint not null,
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
  tenant_id bigint not null,
  phone text not null,
  direction text not null,
  body text not null,
  agent text,
  ext_id text,
  created_at timestamptz not null default now()
);
create index if not exists messages_phone on messages (phone, created_at);

create table if not exists activity (
  id bigserial primary key,
  tenant_id bigint not null,
  agent text not null,
  summary text not null,
  phone text,
  created_at timestamptz not null default now()
);
create index if not exists activity_created on activity (created_at);

create table if not exists job_runs (
  tenant_id bigint not null,
  key text not null,
  ran_at timestamptz not null default now()
);

do $mig$
declare t text;
begin
  -- Tabelas de antes das contas: ganham tenant_id (as linhas antigas vão para o tenant 1) e as
  -- restrições que eram globais caem (as novas, por tenant, são os índices únicos logo abaixo).
  foreach t in array array['settings','clients','appointments','waitlist','quotes','messages','activity','job_runs'] loop
    if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = t and column_name = 'tenant_id') then
      execute format('alter table %I add column tenant_id bigint not null default 1', t);
      execute format('alter table %I alter column tenant_id drop default', t);
      if t = 'clients' then alter table clients drop constraint if exists clients_phone_key; end if;
      if t = 'messages' then alter table messages drop constraint if exists messages_ext_id_key; end if;
      if t = 'job_runs' then alter table job_runs drop constraint if exists job_runs_pkey; end if;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'settings' and column_name = 'id') then
    alter table settings drop column id;
  end if;
end
$mig$;

create unique index if not exists settings_tenant on settings (tenant_id);
create unique index if not exists clients_tenant_phone on clients (tenant_id, phone);
create unique index if not exists messages_tenant_ext on messages (tenant_id, ext_id);
create unique index if not exists job_runs_tenant_key on job_runs (tenant_id, key);
create index if not exists appointments_tenant_starts on appointments (tenant_id, starts_at);
create index if not exists messages_tenant_phone on messages (tenant_id, phone, created_at);
create index if not exists activity_tenant_created on activity (tenant_id, created_at);
create index if not exists quotes_tenant on quotes (tenant_id, created_at);
create index if not exists waitlist_tenant on waitlist (tenant_id, status);

-- Conserto: versões antigas gravavam a configuração como texto dentro de texto e ela crescia a cada
-- salvamento até travar o painel. Linha nesse estado volta ao padrão.
update settings set data = '{}'::jsonb where pg_column_size(data) > 200000 or jsonb_typeof(data) <> 'object';
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
