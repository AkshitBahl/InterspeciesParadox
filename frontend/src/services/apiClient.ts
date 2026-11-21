/**
 * Shared HTTP boundary for future FastAPI integration.
 * No request happens until a feature explicitly calls apiRequest().
 * Keep the default app in mock/localStorage mode until backend endpoints agree on data contracts.
 */
const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBase || "http://localhost:8000").replace(/\/+$/, "");

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiRequestError(
      "Cannot connect to the backend. Please check that it is running and CORS is configured.",
      null,
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === "object" && "detail" in payload) {
        const detail = (payload as { detail: unknown }).detail;
        if (typeof detail === "string") message = detail;
      }
    } catch {
      // Keep the default message for non-JSON error bodies.
    }
    throw new ApiRequestError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiRequestError("The backend returned an invalid JSON response.", response.status);
  }
}
