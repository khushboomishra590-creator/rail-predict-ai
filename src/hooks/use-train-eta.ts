/**
 * use-train-eta.ts
 * ─────────────────
 * Polls GET /api/trains/{trainId}/eta every 15 seconds.
 * ETA is NEVER calculated inside React — it comes from the FastAPI → M3 pipeline.
 *
 * Returns:
 *   state   — { status: "idle" | "loading" | "ok" | "error", data?, error? }
 *   refresh — call to force an immediate re-fetch (used after POST /update)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type EtaResponse } from "@/lib/api";

type EtaState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: EtaResponse }
  | { status: "error"; error: string };

const POLL_MS = 15_000;

export function useTrainEta(trainId: string) {
  const [state, setState] = useState<EtaState>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEta = useCallback(async () => {
    setState((prev) =>
      prev.status === "idle" ? { status: "loading" } : prev
    );
    try {
      const data = await api.getEta(trainId);
      setState({ status: "ok", data });
    } catch (err) {
      setState({ status: "error", error: String(err) });
    }
  }, [trainId]);

  // Start polling
  useEffect(() => {
    fetchEta(); // immediate first fetch

    timerRef.current = setInterval(fetchEta, POLL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fetchEta]);

  // refresh() resets the polling interval AND fetches immediately
  const refresh = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
    fetchEta();
    timerRef.current = setInterval(fetchEta, POLL_MS);
  }, [fetchEta]);

  return { state, refresh };
}
