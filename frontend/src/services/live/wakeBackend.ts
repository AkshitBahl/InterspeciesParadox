import { API_BASE_URL } from "../apiClient";
import { USE_MOCKS } from "../conflictGateway";

/**
 * The hosted backend (Render free plan) sleeps after 15 quiet minutes and needs about
 * a minute to wake up. Pinging /health as soon as the site opens starts that wake up
 * while the visitor watches the intro, so logging in afterwards is quick.
 */
export function wakeBackend(): void {
  if (USE_MOCKS) return;
  fetch(`${API_BASE_URL}/health`, { cache: "no-store" }).catch(() => {
    // Nothing to do: the pages show their own message if the backend stays unreachable.
  });
}
