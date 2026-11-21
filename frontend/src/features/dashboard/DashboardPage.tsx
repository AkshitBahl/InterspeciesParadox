import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Leaf,
  HeartHandshake,
  ShieldCheck,
  PawPrint,
} from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";

const features = [
  {
    title: "Your Needs Matter",
    description:
      "Tell us about your lifestyle, preferences and accessibility needs.",
    icon: ShieldCheck,
    color: "bg-sage/40",
  },
  {
    title: "Wildlife Has a Voice",
    description:
      "Discover the biological needs of your wild neighbors.",
    icon: PawPrint,
    color: "bg-peach/50",
  },
  {
    title: "Find Common Ground",
    description:
      "Explore compromises that respect both humans and wildlife.",
    icon: HeartHandshake,
    color: "bg-sage/40",
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      {/* Welcome section */}
      <section>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
          <Leaf size={15} />
          WELCOME TO THE FUTURE OF COEXISTENCE
        </div>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-forest sm:text-5xl lg:text-6xl">
          Nature is my
          <span className="text-leaf"> neighbor </span>
          now.
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink/65 sm:text-lg">
          In a world where humans and wildlife share the same
          cities, every neighbor deserves to be heard.
          Let's find a way to live together.
        </p>
      </section>

      {/* Main call to action */}
      <section className="relative overflow-hidden rounded-3xl bg-forest p-8 text-cream sm:p-10">
        <div className="relative z-10 max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-sage">
            Your coexistence journey
          </span>

          <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
            Having trouble with a wild neighbor?
          </h2>

          <p className="mt-4 leading-relaxed text-cream/70">
            From unexpected nesting spots to shared pathways,
            our mediator helps you find thoughtful solutions.
          </p>

          <div className="mt-7">
            <Button
              variant="secondary"
              onClick={() => navigate("/conflict/new")}
            >
              Report a conflict
              <ArrowUpRight size={18} />
            </Button>
          </div>
        </div>

        <Leaf
          size={230}
          strokeWidth={0.7}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 -right-12 rotate-[-25deg] text-white/10"
        />
      </section>

      {/* Features */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-forest">
            How coexistence works
          </h2>

          <p className="mt-2 text-sm text-ink/60">
            A better way to share our spaces.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card
                key={feature.title}
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`mb-6 inline-flex rounded-2xl p-4 text-forest ${feature.color}`}
                >
                  <Icon size={26} />
                </div>

                <h3 className="text-lg font-semibold text-forest">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-ink/60">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}