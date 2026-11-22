import { lazy, Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import AssessmentPage from "../features/assessment/AssessmentPage";
import ReportConflictPage from "../features/conflict/ReportConflictPage";
import ProfilePage from "../features/profile/ProfilePage";
import MediationPage from "../features/mediation/MediationPage";
import AgreementPage from "../features/agreement/AgreementPage";
import AppLayout from "../components/layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";

import { USE_MOCKS } from "../services/conflictGateway";
import LoginPage from "../features/live/LoginPage";
import RequireLogin from "../features/live/RequireLogin";
import LiveReportConflictPage from "../features/live/LiveReportConflictPage";
import LiveAssessmentPage from "../features/live/LiveAssessmentPage";
import LiveMediationPage from "../features/live/LiveMediationPage";
import LiveAgreementPage from "../features/live/LiveAgreementPage";

// Only the prologue is new. Everything below retains its existing route and logic.
// Lazy loading keeps the scene and its illustration out of the normal app bundle.
// (The router file is not hot-reloaded as a component, so this lint rule doesn't apply.)
// eslint-disable-next-line react-refresh/only-export-components
const IntroPage = lazy(() => import("../features/intro/IntroPage"));
// The full-page neighborhood map, also lazy so Leaflet loads only when it is needed.
// eslint-disable-next-line react-refresh/only-export-components
const MapPage = lazy(() => import("../features/map/MapPage"));

// Mock mode (VITE_USE_MOCKS=true): everything runs in the browser with demo data.
const mockRoutes: RouteObject[] = [
  { path: "dashboard", element: <DashboardPage /> },
  { path: "profile", element: <ProfilePage /> },
  { path: "conflict/new", element: <ReportConflictPage /> },
  { path: "conflict/:id/assessment", element: <AssessmentPage /> },
  { path: "conflict/:id/mediation", element: <MediationPage /> },
  { path: "conflict/:id/agreement", element: <AgreementPage /> },
];

// Live mode (VITE_USE_MOCKS=false): the same screens, backed by the FastAPI backend.
const liveRoutes: RouteObject[] = [
  { path: "dashboard", element: <DashboardPage /> },
  { path: "login", element: <LoginPage /> },
  {
    element: <RequireLogin />,
    children: [
      { path: "profile", element: <ProfilePage /> },
      { path: "conflict/new", element: <LiveReportConflictPage /> },
      { path: "conflict/:id/assessment", element: <LiveAssessmentPage /> },
      { path: "conflict/:id/mediation", element: <LiveMediationPage /> },
      { path: "conflict/:id/agreement", element: <LiveAgreementPage /> },
    ],
  },
];

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
    // Full screen, outside the app layout, so the map gets the whole page. Public in both modes.
    path: "/map",
    element: (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-forest text-cream">Drawing the neighborhood…</div>}>
        <MapPage />
      </Suspense>
    ),
  },
  {
    element: <AppLayout />,
    children: USE_MOCKS ? mockRoutes : liveRoutes,
  },
]);
