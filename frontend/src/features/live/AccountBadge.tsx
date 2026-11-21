import { LogIn, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../../services/live/client";
import { useSession } from "./session";

/** Shows who is logged in to the live backend, with a log out button. */
export default function AccountBadge() {
  const session = useSession();
  const navigate = useNavigate();

  if (!session) {
    return (
      <Link to="/login" className="kinship-signal inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold">
        <LogIn size={14} aria-hidden="true" /> Log in
      </Link>
    );
  }

  return (
    <div className="kinship-signal flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5">
      <span className="hidden max-w-[10rem] truncate text-[11px] font-semibold md:inline">{session.user.display_name}</span>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        aria-label="Log out"
        title="Log out"
        className="rounded-full p-1.5 hover:bg-white/40"
      >
        <LogOut size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
