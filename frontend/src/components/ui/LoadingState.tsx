import { LoaderCircle } from "lucide-react";

interface LoadingStateProps {
  label?: string;
  compact?: boolean;
}

export default function LoadingState({
  label = "Finding common ground…",
  compact = false,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex items-center justify-center gap-3 rounded-2xl border border-forest/10 bg-white/85 text-forest ${compact ? "p-4" : "min-h-48 p-8"}`}
    >
      <LoaderCircle className="animate-spin text-leaf motion-reduce:animate-none" size={compact ? 19 : 25} aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
