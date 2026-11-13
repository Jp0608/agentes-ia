"use client";

import { setAppointment } from "@/app/painel/actions";
import { ActButton } from "./ui";

export function ApptButtons({ id, status, past }: { id: number; status: string; past: boolean }) {
  if (status === "cancelado" || status === "faltou" || status === "concluido") return null;
  return (
    <span className="flex flex-wrap gap-1">
      {!past && status === "marcado" && <ActButton onRun={() => setAppointment(id, "confirmado")} className="btn-quiet min-h-8 px-2 text-[12.5px]">Confirmar</ActButton>}
      {past && <ActButton onRun={() => setAppointment(id, "concluido")} className="btn-quiet min-h-8 px-2 text-[12.5px]">Atendido</ActButton>}
      <ActButton onRun={() => setAppointment(id, "faltou")} className="btn-quiet min-h-8 px-2 text-[12.5px] text-alert">Faltou</ActButton>
      {!past && <ActButton onRun={() => setAppointment(id, "cancelado")} className="btn-quiet min-h-8 px-2 text-[12.5px]" confirmText="Cancelar?">Cancelar</ActButton>}
    </span>
  );
}
