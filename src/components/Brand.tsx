import { Icon } from "./Icon";

/** Marca do AgendaFlow: ícone e nome, como no site. */
export function Brand({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`} style={{ fontFamily: "var(--font-display)", fontSize: size }}>
      <Icon name="timelapse" size={Math.round(size * 1.2)} className="text-signal" />
      AgendaFlow
    </span>
  );
}
