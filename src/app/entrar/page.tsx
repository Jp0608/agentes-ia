import Link from "next/link";
import { Brand } from "@/components/Brand";
import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await isLoggedIn()) redirect("/painel");
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-4">
      <div className="w-full">
        <Brand size={22} />
        <h1 className="mt-6 text-[30px] font-bold tracking-tight">Entrar no painel</h1>
        <p className="mt-1 text-[14px] text-soft">Use o e-mail e a senha da sua conta.</p>
        <LoginForm />
        <p className="mt-5 text-[14px] text-soft">
          Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-signal hover:underline">Criar conta</Link>
        </p>
      </div>
    </main>
  );
}
