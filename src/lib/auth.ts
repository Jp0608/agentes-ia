import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Login do painel: cada negócio tem a própria conta (e-mail e senha) e o próprio tenant.
 * A sessão fica num cookie assinado com AUTH_SECRET por 30 dias e guarda o tenant e a conta.
 */
export const COOKIE = "painel";
const MAX_AGE = 30 * 86400;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.VERCEL) throw new Error("Falta a variável AUTH_SECRET.");
  return new TextEncoder().encode(s || "dev-secret-troque-em-producao");
}

/* ---------- Senhas (scrypt com sal aleatório) ---------- */

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$N$r$p$sal$hash" (sal e hash em base64). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0) || n > 1 << 20) return false;
  const salt = Buffer.from(parts[4], "base64");
  const want = Buffer.from(parts[5], "base64");
  if (!want.length) return false;
  try {
    const got = await derive(password, salt, n, r, p, want.length);
    return got.length === want.length && timingSafeEqual(got, want);
  } catch {
    return false;
  }
}

/** Atraso fixo depois de uma tentativa errada (atrapalha quem tenta adivinhar senha). */
export const failDelay = () => new Promise((r) => setTimeout(r, 800));

/* ---------- Sessão ---------- */

export type Session = { tenantId: number; accountId: number };

export async function createSession(s: Session) {
  const token = await new SignJWT({ tid: s.tenantId, aid: s.accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Tokens já conferidos (a mesma página consulta o tenant muitas vezes). */
const verified = new Map<string, Session & { exp: number }>();

async function decode(token: string): Promise<Session | null> {
  const hit = verified.get(token);
  if (hit && hit.exp > Date.now()) return { tenantId: hit.tenantId, accountId: hit.accountId };
  try {
    const { payload } = await jwtVerify(token, secret());
    const tenantId = Number(payload.tid);
    const accountId = Number(payload.aid);
    // Sessões antigas (de antes das contas) não têm tenant: pedem login de novo.
    if (!Number.isInteger(tenantId) || tenantId < 1 || !Number.isInteger(accountId) || accountId < 1) return null;
    if (verified.size > 1000) verified.clear();
    verified.set(token, { tenantId, accountId, exp: Math.min((payload.exp ?? 0) * 1000, Date.now() + 10 * 60000) });
    return { tenantId, accountId };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decode(token) : null;
}

export async function isLoggedIn() {
  return (await getSession()) !== null;
}

/** Para páginas e ações do painel: sem login, volta para /entrar. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/entrar");
  return s;
}

export async function requireLogin() {
  await requireSession();
}

/** Tenant da sessão (painel). */
export async function getTenantId() {
  return (await requireSession()).tenantId;
}
