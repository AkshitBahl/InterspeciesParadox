import { NavLink } from "react-router-dom";
import {
  Leaf,
  LayoutDashboard,
  UserRound,
  FilePlus2,
  Scale,
  HeartHandshake,
  ScrollText,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "My Profile", path: "/profile", icon: UserRound },
  { label: "Report Conflict", path: "/conflict/new", icon: FilePlus2 },
  {
    label: "Needs Assessment",
    path: "/conflict/demo/assessment",
    icon: Scale,
  },
  {
    label: "Mediation Studio",
    path: "/conflict/demo/mediation",
    icon: HeartHandshake,
  },
  {
    label: "Agreements",
    path: "/conflict/demo/agreement",
    icon: ScrollText,
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {isOpen && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-forest/40 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-72 shrink-0
          flex-col bg-forest p-6 text-cream
          transition-transform duration-300
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <Leaf size={25} />
            </div>

            <div>
              <h1 className="text-lg font-bold">Interspecies</h1>
              <p className="text-xs text-sage">
                Nature is my neighbor.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-sage/70">
          Workspace
        </p>

        <nav className="flex flex-col gap-2">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `
                  flex items-center gap-3 rounded-xl
                  px-4 py-3 text-sm font-medium
                  transition-colors
                  ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-sage hover:bg-white/10 hover:text-white"
                  }
                  `
                }
              >
                <Icon size={19} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/10 p-5">
          <Leaf className="mb-3 text-sage" size={25} />

          <p className="font-semibold">
            A city for everyone.
          </p>

          <p className="mt-2 text-sm leading-relaxed text-sage">
            Making space for humans and wildlife to thrive together.
          </p>
        </div>
      </aside>
    </>
  );
}