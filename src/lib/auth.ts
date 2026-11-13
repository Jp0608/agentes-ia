import "server-only";
import { timingSafeEqual } from "crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Login do painel: uma senha só (PAINEL_SENHA), porque cada instalação é de um negócio.
 * A sessão fica num cookie assinado com AUTH_SECRET por 30 dias.
 */
export const COOKIE = "painel";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.VERCEL) throw new Error("Falta a variável AUTH_SECRET.");
  return new TextEncoder().encode(s || "dev-secret-troque-em-producao");
}

export const panelPassword = () => process.env.PAINEL_SENHA || (process.env.VERCEL ? "" : "demo1234");

export function checkPassword(given: string) {
  const want = panelPassword();
  if (!want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession() {
  const token = await new SignJWT({ role: "owner" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isLoggedIn() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

/** Para páginas e ações do painel: sem login, volta para /entrar. */
export async function requireLogin() {
  if (!(await isLoggedIn())) redirect("/entrar");
}
