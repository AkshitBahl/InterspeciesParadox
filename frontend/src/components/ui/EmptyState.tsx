import type { ReactNode } from "react";
import { Leaf } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-forest/20 bg-sage/10 px-6 py-9 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage/40 text-forest">
        <Leaf size={23} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-forest">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/60">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
