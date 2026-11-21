import { RouterProvider } from "react-router-dom";
import AppErrorBoundary from "../components/ui/AppErrorBoundary";
import { router } from "./router";

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}