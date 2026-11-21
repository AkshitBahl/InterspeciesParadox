import AssessmentPage from "../features/assessment/AssessmentPage";
import ReportConflictPage from "../features/conflict/ReportConflictPage";
import ProfilePage from "../features/profile/ProfilePage";
import { createBrowserRouter } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-forest/10 bg-white p-10">
      <p className="mb-3 text-sm text-leaf">Coming next</p>

      <h1 className="text-3xl font-bold text-forest">{title}</h1>

      <p className="mt-3 text-ink/60">
        We'll build this screen in the next steps.
      </p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "conflict/new",
        element: <ReportConflictPage />,
      },
      {
        path: "conflict/:id/assessment",
        element: <AssessmentPage />,
      },
      {
        path: "conflict/:id/mediation",
        element: <ComingSoon title="Mediation Studio" />,
      },
      {
        path: "conflict/:id/agreement",
        element: <ComingSoon title="Coexistence Agreement" />,
      },
    ],
  },
]);
