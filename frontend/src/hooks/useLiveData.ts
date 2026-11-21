import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../services/live/client";

export interface LiveData<T> {
  data: T | undefined;
  error: string;
  loading: boolean;
  reload: () => void;
  setData: (value: T) => void;
}

/**
 * Loads data from the backend and re-runs when `key` changes.
 * `key` is a string so callers don't need to memoise the loader.
 */
export function useLiveData<T>(key: string | null, load: () => Promise<T>): LiveData<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error: string }>({ key: null, error: "" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, data, error: "" }),
      (error: unknown) => !cancelled && setState({ key, error: errorMessage(error) })
    );
    return () => {
      cancelled = true;
    };
    // `load` is intentionally left out: `key` describes what it fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data, error: "" })), []);

  const fresh = state.key === key;
  return {
    data: fresh ? state.data : undefined,
    error: fresh ? state.error : "",
    loading: key !== null && (!fresh || (state.data === undefined && !state.error)),
    reload,
    setData,
  };
}
