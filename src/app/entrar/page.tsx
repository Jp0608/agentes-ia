import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function Page() {
  if (await isLoggedIn()) redirect("/painel");
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-4">
      <div className="w-full">
        <p className="eyebrow">Agentes de IA</p>
        <h1 className="mt-2 text-[30px] font-bold tracking-tight">Entrar no painel</h1>
        <p className="mt-1 text-[14px] text-soft">Use a senha definida na instalação.</p>
        <LoginForm />
      </div>
    </main>
  );
}
