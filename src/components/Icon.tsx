import type { CSSProperties } from "react";

export function Icon({ name, size = 20, fill, className = "", style }: { name: string; size?: number; fill?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`ms ${fill ? "ms-fill" : ""} ${className}`} style={{ fontSize: size, width: size, height: size, ...style }}>
      {name}
    </span>
  );
}
