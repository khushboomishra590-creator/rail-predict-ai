/**
 * use-route-eta.ts
 * ─────────────────
 * Fetches GET /api/trains/{trainId}/route-eta and re-fetches whenever
 * trainId changes or refresh() is called.
 *
 * Falls back gracefully — on error the status is "error" and the
 * caller should render the demo fallback.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type RouteEtaResponse } from "@/lib/api";

type RouteEtaState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: RouteEtaResponse }
  | { status: "error"; error: string };

const POLL_MS = 20_000;

export function useRouteEta(trainId: string) {
  const [state, setState] = useState<RouteEtaState>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRoute = useCallback(async () => {
    setState((prev) =>
      prev.status === "idle" ? { status: "loading" } : prev,
    );
    try {
      const data = await api.getRouteEta(trainId);
      setState({ status: "ok", data });
    } catch (err) {
      setState({ status: "error", error: String(err) });
    }
  }, [trainId]);

  useEffect(() => {
    setState({ status: "idle" });
    fetchRoute();
    timerRef.current = setInterval(fetchRoute, POLL_MS);
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchRoute]);

  const refresh = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    fetchRoute();
    timerRef.current = setInterval(fetchRoute, POLL_MS);
  }, [fetchRoute]);

  return { state, refresh };
}
