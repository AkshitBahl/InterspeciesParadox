import { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import JourneyProgress from "./JourneyProgress";
import DepthBackdrop from "../../motion/DepthBackdrop";
import { ScrollTrigger } from "../../motion/gsap";
import { useReducedMotion } from "../../motion/reducedMotion";
import { jumpToTop, startSmoothScroll } from "../../motion/smoothScroll";
import "../../styles/experience.css";

/** The app shell: a neon 3D backdrop, smooth scrolling, the rail, the top bar and the page. */
export default function AppLayout() {
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDashboard = pathname === "/dashboard";
  const reduced = useReducedMotion();

  // Smooth, eased scrolling for every app page (native scrolling with reduced motion).
  useEffect(() => (reduced ? undefined : startSmoothScroll()), [reduced]);

  // A new page starts at the top, and scroll animations re-measure once it has rendered.
  useLayoutEffect(() => {
    jumpToTop();
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div className="kinship-shell route-fade min-h-screen lg:flex">
      <DepthBackdrop />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="kinship-app-column relative flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main
          id="main-content"
          className={`kinship-main mx-auto w-full max-w-[1600px] flex-1 px-4 pb-14 pt-6 sm:px-7 lg:px-9 xl:px-12 ${isDashboard ? "kinship-main-home" : "kinship-main-inner"}`}
        >
          <JourneyProgress />
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
        <footer className="kinship-footer relative flex flex-wrap items-center justify-between gap-2 px-5 pb-6 pt-2 text-[10px] uppercase tracking-[0.18em] sm:px-10">
          <span>Kinship / The Interspecies Paradox</span>
          <span>Imagining coexistence · Earth, 2126</span>
        </footer>
      </div>
    </div>
  );
}
