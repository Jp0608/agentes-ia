import Link from "next/link";
import { Brand } from "@/components/Brand";
import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

export default async function Page() {
  if (await isLoggedIn()) redirect("/painel");
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-4 py-8">
      <div className="w-full">
        <Brand size={22} />
        <h1 className="mt-6 text-[30px] font-bold tracking-tight">Criar conta grátis</h1>
        <p className="mt-1 text-[14px] text-soft">Cada negócio tem a própria agenda, os próprios clientes e o próprio WhatsApp.</p>
        <SignupForm />
        <p className="mt-5 text-[14px] text-soft">
          Já tem conta? <Link href="/entrar" className="font-semibold text-signal hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
