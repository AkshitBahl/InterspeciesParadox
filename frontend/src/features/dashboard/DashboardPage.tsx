import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import HeroFlight from "./hero/HeroFlight";
import StepsOrbit from "./StepsOrbit";
import WildVoices from "./WildVoices";
import RecentCases from "./RecentCases";
import LiveRecentCases from "../live/LiveRecentCases";
import { USE_MOCKS } from "../../services/conflictGateway";
import "../../styles/parallax.css";

/**
 * The home page, told as a scroll: fly into the 3D neighborhood, turn the ring of steps,
 * hear from a wild neighbor, then pick up your own cases.
 */
export default function DashboardPage() {
  return (
    <div className="parallax-home">
      <HeroFlight />
      <StepsOrbit />
      <WildVoices />

      <div className="home-cases reveal-3d">
        {USE_MOCKS ? <RecentCases /> : <LiveRecentCases />}
      </div>

      <section className="home-final reveal-3d" aria-label="Start a mediation">
        <p className="home-final-line">Ready when you are.</p>
        <div className="hero-actions">
          <Link to="/conflict/new" className="hero-cta">
            Start a mediation <span aria-hidden="true"><ArrowUpRight size={17} /></span>
          </Link>
          <Link to="/map" className="hero-ghost">Open the map</Link>
        </div>
      </section>
    </div>
  );
}
