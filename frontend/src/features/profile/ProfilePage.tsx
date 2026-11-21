
import { CheckCircle2, Leaf, Save } from "lucide-react";

import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ProfileAvatar from "./ProfileAvatar";
import ProfileForm from "./ProfileForm";
import { useHumanProfile } from "../../hooks/useHumanProfile";

const accentStyles = {
  forest: "bg-forest text-cream",
  sage: "bg-sage text-forest",
  peach: "bg-peach text-forest",
};

export default function ProfilePage() {
  const {
    profile,
    updateProfile,
    saveProfile,
    saveStatus,
  } = useHumanProfile();

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <section>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage/40 px-4 py-2 text-xs font-semibold text-forest">
          <Leaf size={15} />
          YOUR HUMAN REPRESENTATIVE
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-forest">
          Make yourself at home.
        </h1>

        <p className="mt-3 max-w-2xl text-ink/60">
          Before meeting your wild neighbors, let us
          understand your needs, habits, and preferences.
        </p>
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Editor */}
        <Card className="space-y-8">
          <ProfileAvatar
            avatar={profile.avatar}
            accent={profile.accent}
            onAvatarChange={(avatar) =>
              updateProfile({ ...profile, avatar })
            }
            onAccentChange={(accent) =>
              updateProfile({ ...profile, accent })
            }
          />

          <div className="border-t border-forest/10 pt-8">
            <ProfileForm
              profile={profile}
              onChange={updateProfile}
            />
          </div>

          <div className="border-t border-forest/10 pt-6">
            <Button
              onClick={saveProfile}
              disabled={!profile.displayName.trim()}
              className="w-full sm:w-auto"
            >
              <Save size={17} />
              Save my profile
            </Button>

            {saveStatus === "saved" && (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 text-sm font-medium text-leaf"
              >
                <CheckCircle2 size={17} />
                Profile saved successfully!
              </p>
            )}

            {saveStatus === "error" && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                Could not save your profile in this browser.
              </p>
            )}
          </div>
        </Card>

        {/* Live profile preview */}
        <aside className="space-y-5 xl:sticky xl:top-6">
          <Card className="overflow-hidden !p-0">
            <div
              className={`flex h-36 items-center justify-center ${accentStyles[profile.accent]}`}
            >
              <span className="text-7xl">
                {profile.avatar}
              </span>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-leaf">
                  Human Representative
                </p>

                <h2 className="mt-2 break-words text-2xl font-bold text-forest">
                  {profile.displayName || "Your name"}
                </h2>

                <p className="mt-1 text-sm text-ink/50">
                  {profile.homeType} resident · 2126
                </p>
              </div>

              <p className="break-words text-sm leading-relaxed text-ink/70">
                {profile.bio || "Your introduction will appear here."}
              </p>

              <div className="border-t border-forest/10 pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-forest">
                  Essential needs
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    ...profile.essentialNeeds,
                    ...profile.accessNeeds,
                  ].map((need) => (
                    <span
                      key={need}
                      className="rounded-full bg-sage/30 px-3 py-1.5 text-xs text-forest"
                    >
                      {need}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-forest/10 pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-forest">
                  Preferred compromises
                </p>

                <div className="flex flex-wrap gap-2">
                  {profile.preferredSolutions.length ? (
                    profile.preferredSolutions.map((solution) => (
                      <span
                        key={solution}
                        className="rounded-full bg-peach/40 px-3 py-1.5 text-xs text-forest"
                      >
                        {solution}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-ink/50">
                      No preferences selected.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="rounded-2xl bg-sage/25 p-5 text-sm leading-relaxed text-forest">
            🌱 Your mediator will use these preferences
            to understand what matters to you before
            proposing any compromises.
          </div>
        </aside>
      </div>
    </div>
  );
}
