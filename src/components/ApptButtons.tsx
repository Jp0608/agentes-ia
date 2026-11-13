"use client";

import { setAppointment } from "@/app/painel/actions";
import { ActButton } from "./ui";

export function ApptButtons({ id, status, past }: { id: number; status: string; past: boolean }) {
  if (status === "cancelado" || status === "faltou" || status === "concluido") return null;
  return (
    <span className="flex w-full flex-wrap gap-2 sm:w-auto">
      {!past && status === "marcado" && <ActButton onRun={() => setAppointment(id, "confirmado")} className="btn-soft min-h-11 px-4 text-[15px]">Confirmar</ActButton>}
      {past && <ActButton onRun={() => setAppointment(id, "concluido")} className="btn-soft min-h-11 px-4 text-[15px]">Atendido</ActButton>}
      <ActButton onRun={() => setAppointment(id, "faltou")} className="btn-soft min-h-11 px-4 text-[15px] text-alert">Faltou</ActButton>
      {!past && <ActButton onRun={() => setAppointment(id, "cancelado")} className="btn-soft min-h-11 px-4 text-[15px]" confirmText="Cancelar?">Cancelar</ActButton>}
    </span>
  );
}
