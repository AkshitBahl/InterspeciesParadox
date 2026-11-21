import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLiveData } from "../../hooks/useLiveData";
import { liveApi } from "../../services/live/api";
import { errorMessage } from "../../services/live/client";

/**
 * Loads one conflict from the backend.
 * The sidebar links to /conflict/demo/…: in live mode "demo" opens your latest case
 * (or the latest case in the neighborhood if you haven't reported one yet).
 */
export function useLiveConflict(id: string | undefined, section: "assessment" | "mediation" | "agreement") {
  const navigate = useNavigate();
  const [demoError, setDemoError] = useState("");
  const isDemo = id === "demo";

  useEffect(() => {
    if (!isDemo) return;
    let cancelled = false;
    (async () => {
      const mine = await liveApi.listConflicts(true);
      const pick = mine[0] ?? (await liveApi.listConflicts())[0];
      if (!cancelled) navigate(pick ? `/conflict/${pick.id}/${section}` : "/conflict/new", { replace: true });
    })().catch((error: unknown) => !cancelled && setDemoError(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [isDemo, navigate, section]);

  const result = useLiveData(id && !isDemo ? `conflict:${id}` : null, () => liveApi.getConflict(id!));
  return {
    ...result,
    loading: result.loading || (isDemo && !demoError),
    error: result.error || demoError,
  };
}
