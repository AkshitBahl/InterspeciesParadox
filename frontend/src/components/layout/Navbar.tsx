import { Menu, Leaf } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({
  onMenuClick,
}: NavbarProps) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-forest/10 bg-cream px-5 sm:px-8 lg:px-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-forest hover:bg-sage/30 lg:hidden"
        >
          <Menu size={24} />
        </button>

        <div>
          <p className="text-sm font-semibold text-forest">
            Welcome to the neighborhood
          </p>

          <p className="text-xs text-ink/50">
            A new era of urban coexistence
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest sm:block">
          🌿 Year 2126
        </span>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-cream">
          <Leaf size={19} />
        </div>
      </div>
    </header>
  );
}