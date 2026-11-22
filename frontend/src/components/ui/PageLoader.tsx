import LeafSpinner from "./LeafSpinner";

/** Full screen loading view for lazy pages (the intro and the map). */
export default function PageLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-forest text-cream"
    >
      <LeafSpinner size={42} className="text-sage" />
      <p className="text-xs uppercase tracking-[0.16em] text-cream/70">{label}</p>
    </div>
  );
}
