import type { HTMLAttributes } from "react";

export default function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`
        rounded-3xl border border-forest/10
        bg-white/80 p-6 shadow-sm
        ${className}
      `}
      {...props}
    />
  );
}