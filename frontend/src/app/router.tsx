import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import AssessmentPage from "../features/assessment/AssessmentPage";
import ReportConflictPage from "../features/conflict/ReportConflictPage";
import ProfilePage from "../features/profile/ProfilePage";
import MediationPage from "../features/mediation/MediationPage";
import AgreementPage from "../features/agreement/AgreementPage";
import AppLayout from "../components/layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";

// Only the prologue is new. Everything below retains its existing route and logic.
// Lazy loading keeps the scene and its illustration out of the normal app bundle.
const IntroPage = lazy(() => import("../features/intro/IntroPage"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-forest text-cream">Growing your neighborhood…</div>}>
        <IntroPage />
      </Suspense>
    ),
  },
  {
    element: <AppLayout />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "conflict/new", element: <ReportConflictPage /> },
      { path: "conflict/:id/assessment", element: <AssessmentPage /> },
      { path: "conflict/:id/mediation", element: <MediationPage /> },
      { path: "conflict/:id/agreement", element: <AgreementPage /> },
    ],
  },
]);
