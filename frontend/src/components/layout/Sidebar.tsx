import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Compass,
  FilePlus2,
  HeartHandshake,
  LayoutDashboard,
  Leaf,
  Scale,
  ScrollText,
  UserRound,
  X,
} from "lucide-react";

const navigation = [
  { label: "Overview", path: "/dashboard", icon: LayoutDashboard, number: "01" },
  { label: "My profile", path: "/profile", icon: UserRound, number: "02" },
  { label: "Report conflict", path: "/conflict/new", icon: FilePlus2, number: "03" },
  { label: "Needs assessment", path: "/conflict/demo/assessment", icon: Scale, number: "04", section: "assessment" },
  { label: "Mediation studio", path: "/conflict/demo/mediation", icon: HeartHandshake, number: "05", section: "mediation" },
  { label: "Agreements", path: "/conflict/demo/agreement", icon: ScrollText, number: "06", section: "agreement" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <>
      {isOpen && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#071f1c]/70 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        id="primary-navigation"
        className={`kinship-sidebar fixed inset-y-0 left-0 z-50 flex w-[278px] shrink-0 flex-col overflow-y-auto px-6 pb-6 pt-7 transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-11 flex items-start justify-between">
          <NavLink to="/dashboard" onClick={onClose} className="group flex items-center gap-3" aria-label="Kinship dashboard">
            <div className="kinship-mark relative flex h-11 w-11 items-center justify-center rounded-[14px]">
              <Leaf size={22} strokeWidth={1.7} aria-hidden="true" />
              <span className="kinship-mark-dot" aria-hidden="true" />
            </div>
            <div>
              <p className="kinship-brand font-semibold tracking-[-0.055em]">kinship<span className="kinship-brand-dot">.</span></p>
              <p className="mt-[-2px] text-[9px] font-semibold uppercase tracking-[0.2em] text-[#a2b9ad]">interspecies / 2126</p>
            </div>
          </NavLink>
          <button onClick={onClose} aria-label="Close navigation" className="rounded-full p-2 text-[#d6e7d6] hover:bg-white/10 lg:hidden">
            <X size={20} />
          </button>
        </div>

        <div className="kinship-sidebar-rule mb-7" />
        <div className="mb-3 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.19em] text-[#a2b9ad]">
          <span>Explore</span>
          <Compass size={14} aria-hidden="true" />
        </div>

        <nav className="flex flex-col gap-1" aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isCurrent = item.section
              ? new RegExp(`^/conflict/[^/]+/${item.section}/?$`).test(pathname)
              : pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                aria-current={isCurrent ? "page" : undefined}
                className={`kinship-nav-link group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition-colors ${isCurrent ? "kinship-nav-active" : ""}`}
              >
                <span className="kinship-nav-number text-[10px] tabular-nums">{item.number}</span>
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {isCurrent && <span className="kinship-nav-current" aria-hidden="true" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-9">
          <div className="kinship-sidebar-note relative overflow-hidden rounded-[21px] p-5">
            <div className="kinship-sidebar-note-orbit" aria-hidden="true" />
            <span className="relative mb-6 flex h-8 w-8 items-center justify-center rounded-full border border-[#d5eaa6]/40 text-[#d5eaa6]">
              <ArrowUpRight size={16} strokeWidth={1.7} />
            </span>
            <p className="relative font-serif text-[23px] leading-[1.06] tracking-[-0.035em] text-[#f3f4df]">
              A shared city.<br /><em>A shared future.</em>
            </p>
            <p className="relative mt-4 text-[10px] leading-5 tracking-[0.03em] text-[#aec2b4]">
              Every form of life deserves consideration.
            </p>
          </div>
          <div className="mt-5 px-2">
            <NavLink to="/" onClick={onClose} className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#d7eab6] hover:text-white">
              <Compass size={15} /> Replay the neighborhood intro <ArrowUpRight size={13}/>
            </NavLink>
          </div>
          <div className="mt-7 flex items-center justify-between px-2 text-[9px] uppercase tracking-[0.19em] text-[#829c8e]">
            <span>Field station 001</span>
            <span>● Online</span>
          </div>
        </div>
      </aside>
    </>
  );
}
