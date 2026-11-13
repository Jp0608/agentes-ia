import "server-only";
import { hashPassword, verifyPassword } from "./auth";
import { q, tx } from "./db";

/**
 * Contas: cada uma é dona de um tenant (um negócio, com a própria agenda, clientes e WhatsApp).
 * O tenant 1 é o dos dados de antes das contas: a primeira conta criada fica com ele (o dono atual
 * se cadastra e continua com tudo). As contas seguintes ganham tenants novos (2, 3, ...).
 */
export type Account = { id: number; tenant_id: number; email: string; name: string; password_hash: string; created_at: Date };

const fix = (a: Account): Account => ({ ...a, id: Number(a.id), tenant_id: Number(a.tenant_id) });

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
export const MIN_PASSWORD = 8;

export async function findAccountByEmail(email: string) {
  const rows = await q<Account>("select * from accounts where email = $1", [normalizeEmail(email)]);
  return rows[0] ? fix(rows[0]) : null;
}

export async function getAccount(id: number) {
  const rows = await q<Account>("select * from accounts where id = $1", [id]);
  return rows[0] ? fix(rows[0]) : null;
}

/** Confere e-mail e senha. Devolve a conta ou null. */
export async function authenticate(email: string, password: string) {
  const a = await findAccountByEmail(email);
  if (!a) {
    // Mesmo trabalho com ou sem conta, para não revelar quais e-mails existem.
    await verifyPassword(password, DUMMY_HASH).catch(() => false);
    return null;
  }
  return (await verifyPassword(password, a.password_hash)) ? a : null;
}
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export class SignupError extends Error {}

export async function createAccount(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new SignupError("Coloque o nome do negócio.");
  if (!validEmail(email)) throw new SignupError("E-mail inválido.");
  if (input.password.length < MIN_PASSWORD) throw new SignupError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  if (input.password.length > 200) throw new SignupError("Senha longa demais.");
  const hash = await hashPassword(input.password);

  return tx(async (t) => {
    // Um cadastro de cada vez, para dois não pegarem o mesmo tenant.
    await t("select pg_advisory_xact_lock(4240)");
    if ((await t("select 1 from accounts where email = $1", [email])).length) throw new SignupError("Já existe uma conta com esse e-mail.");
    // A primeira conta fica com o tenant 1 (os dados que já existiam). Depois, sempre um tenant novo,
    // acima de qualquer um que já tenha conta ou dados.
    const rows = await t<{ n: string }>(
      `select case when not exists (select 1 from accounts) then 1
              else greatest(1, coalesce((select max(tenant_id) from accounts), 0), coalesce((select max(tenant_id) from settings), 0)) + 1
              end as n`,
    );
    const tenantId = Number(rows[0].n);
    const created = await t<Account>(
      "insert into accounts (tenant_id, email, password_hash, name) values ($1, $2, $3, $4) returning *",
      [tenantId, email, hash, name],
    );
    // Configuração inicial só com o nome (no tenant 1 a que já existe fica como está).
    await t(
      `insert into settings (tenant_id, data) values ($1, ($2::text)::jsonb)
       on conflict (tenant_id) do nothing`,
      [tenantId, JSON.stringify({ businessName: name })],
    );
    return fix(created[0]);
  });
}

export async function updateAccountProfile(id: number, input: { name: string; email: string }) {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) throw new SignupError("E-mail inválido.");
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new SignupError("Coloque seu nome.");
  const taken = await q("select 1 from accounts where email = $1 and id <> $2", [email, id]);
  if (taken.length) throw new SignupError("Já existe uma conta com esse e-mail.");
  await q("update accounts set name = $2, email = $3 where id = $1", [id, name, email]);
}

export async function updateAccountPassword(id: number, current: string, next: string) {
  const a = await getAccount(id);
  if (!a || !(await verifyPassword(current, a.password_hash))) throw new SignupError("A senha atual está errada.");
  if (next.length < MIN_PASSWORD) throw new SignupError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
  if (next.length > 200) throw new SignupError("Senha longa demais.");
  await q("update accounts set password_hash = $2 where id = $1", [id, await hashPassword(next)]);
}
