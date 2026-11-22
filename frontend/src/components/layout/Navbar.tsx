import { ArrowUpRight, Menu, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AccountBadge from "../../features/live/AccountBadge";
import { USE_MOCKS } from "../../services/conflictGateway";

interface NavbarProps {
  onMenuClick: () => void;
}

const pageNames: Record<string, string> = {
  "/dashboard": "The living city",
  "/profile": "Human representative",
  "/conflict/new": "New coexistence case",
  "/login": "Resident login",
};

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { pathname } = useLocation();
  const section = pathname.split("/")[3];
  const pageTitle = pageNames[pathname] ?? ({ assessment: "Needs assessment", mediation: "Mediation studio", agreement: "Agreement review" } as Record<string, string>)[section] ?? "Coexistence studio";

  return (
    <header className="kinship-navbar relative z-20 flex min-h-[80px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-9 xl:px-12">
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={onMenuClick} aria-label="Open navigation" aria-controls="primary-navigation" className="kinship-menu-button rounded-xl p-2 lg:hidden">
          <Menu size={23} />
        </button>
        <div className="hidden h-[28px] w-px bg-white/10 sm:block" aria-hidden="true" />
        <div className="min-w-0">
          <p className="kinship-eyebrow text-[9px] font-semibold uppercase tracking-[0.23em]">Your neighborhood / 2126</p>
          <p className="truncate text-[13px] font-medium tracking-[-0.02em] text-forest">{pageTitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="kinship-signal hidden items-center gap-2 rounded-full px-3 py-2 sm:flex">
          <Radio size={14} strokeWidth={1.7} aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Coexistence network</span>
        </div>
        {!USE_MOCKS && <AccountBadge />}
        <Link to="/conflict/new" className="kinship-new-case inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-[11px] font-semibold sm:px-4" aria-label="Report a new conflict">
          <span className="hidden sm:inline">New case</span><span className="sm:hidden">Report</span>
          <ArrowUpRight size={15} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
