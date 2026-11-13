import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Porteiro do painel: sem sessão válida, /painel/* volta para /entrar antes de qualquer página ou ação.
 * (As páginas e ações conferem de novo em lib/auth.ts; aqui é a primeira barreira.)
 * O nome do cookie e o segredo são os mesmos de lib/auth.ts.
 */
export const config = { matcher: ["/painel", "/painel/:path*"] };

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("painel")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-troque-em-producao"));
      if (Number(payload.tid) >= 1 && Number(payload.aid) >= 1) return NextResponse.next();
    } catch {
      // token vencido ou adulterado: cai no redirecionamento
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}
