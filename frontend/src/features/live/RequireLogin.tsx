import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "./session";

/** Route guard for live mode: pages that talk to the backend need a logged-in resident. */
export default function RequireLogin() {
  const session = useSession();
  const { pathname, search } = useLocation();
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <Outlet />;
}
