import { ApiRequestError, apiRequest } from "../apiClient";
import type { LiveUser, TokenPair } from "./types";

/**
 * Login session for the live backend.
 * Tokens live in localStorage for this hackathon prototype only.
 */
const SESSION_KEY = "interspecies-session";
const SESSION_EVENT = "interspecies-session-change";

export interface LiveSession {
  accessToken: string;
  refreshToken: string;
  user: LiveUser;
}

export function getSession(): LiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveSession>;
    return parsed.accessToken && parsed.refreshToken && parsed.user ? (parsed as LiveSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: LiveSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be blocked (private mode). The session then lasts for this page only.
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function onSessionChange(listener: () => void): () => void {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

const PREFIX = "/api/v1";

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  refreshing ??= apiRequest<TokenPair>(`${PREFIX}/auth/refresh`, {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  })
    .then((pair) => {
      setSession({ ...session, accessToken: pair.access_token, refreshToken: pair.refresh_token });
      return true;
    })
    .catch(() => {
      setSession(null);
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface LiveOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Send the request without a token (login, public data). */
  anonymous?: boolean;
}

/** Calls `/api/v1{path}` with the login token, refreshing it once if it expired. */
export async function liveRequest<T>(path: string, options: LiveOptions = {}): Promise<T> {
  const { body, anonymous, ...init } = options;

  const send = () => {
    const headers = new Headers(init.headers);
    const session = anonymous ? null : getSession();
    if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
    return apiRequest<T>(`${PREFIX}${path}`, {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  try {
    return await send();
  } catch (error) {
    if (!anonymous && error instanceof ApiRequestError && error.status === 401 && getSession()) {
      if (await refreshTokens()) return send();
    }
    throw error;
  }
}

export async function login(email: string, password: string): Promise<LiveSession> {
  const pair = await liveRequest<TokenPair>("/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  });
  const user = await liveRequest<LiveUser>("/auth/me", {
    anonymous: true,
    headers: { Authorization: `Bearer ${pair.access_token}` },
  });
  const session = { accessToken: pair.access_token, refreshToken: pair.refresh_token, user };
  setSession(session);
  return session;
}

export function logout(): void {
  setSession(null);
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
