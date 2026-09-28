/**
 * api.ts — M4 FastAPI client for the M5 React frontend.
 *
 * Base URL is read from VITE_API_BASE_URL (set in .env).
 * Falls back to http://localhost:8000 only when the env var is absent.
 *
 * M5 never calls M3 directly and never calculates ETA.
 * All predictions come from the FastAPI → PostgreSQL → M3 pipeline.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

// ── Response shapes — match FastAPI Pydantic schemas exactly ──────────────────

export interface HealthResponse {
  status: string;
  version: string;
}

export interface ApiTrain {
  id: number;
  number: string;
  name: string;
  short_name: string | null;
  train_type: string | null;
  origin_station_id: number;
  destination_station_id: number;
  zone_id: number | null;
  created_at: string;
}

export interface ApiTrainDetail {
  id: number;
  number: string;
  name: string;
  short_name: string | null;
  train_type: string | null;
  origin_station: { id: number; name: string; code: string };
  destination_station: { id: number; name: string; code: string };
  zone_id: number | null;
  created_at: string;
}

/**
 * Exact contract from GET /api/trains/{id}/eta.
 * Uncertainty is represented as eta_lower / eta_upper / uncertainty_minutes.
 * There is NO confidence_pct field.
 */
export interface EtaResponse {
  train_id: string;
  current_station: string;
  next_station: string;
  current_speed: number;
  current_delay: number;       // minutes
  scheduled_eta: string;       // ISO-8601 datetime string
  predicted_eta: string;       // AI ETA — ISO-8601 datetime string
  predicted_delay: number;     // minutes vs schedule
  eta_lower: string;           // lower bound — ISO-8601 datetime string
  eta_upper: string;           // upper bound — ISO-8601 datetime string
  uncertainty_minutes: number; // half-width of the P90 uncertainty window
  delay_adjustment: number;    // delta applied by the engine (minutes)
  last_updated: string;        // ISO-8601 datetime string
}

export interface RouteEtaResponse {
  train_id: string;
  updated_at: string;
  stations: EtaResponse[];
}

/** Request body for POST /api/trains/{id}/update */
export interface MovementUpdateRequest {
  train_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: string;                       // ISO-8601 with timezone
  current_delay_min: number;
  current_section?: string;
  distance_to_next_station_km?: number;
}

/** Response from POST /api/trains/{id}/update */
export interface MovementUpdateResponse {
  movement_id: number;
  train_run_id: number;
  recorded_at: string;
  message: string;
}

// ── Low-level fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {
  /** GET /health */
  health: () => apiFetch<HealthResponse>("/health"),

  /** GET /api/trains */
  listTrains: () => apiFetch<ApiTrain[]>("/api/trains"),

  /** GET /api/trains/{train_id} */
  getTrain: (trainId: string) =>
    apiFetch<ApiTrainDetail>(`/api/trains/${trainId}`),

  /** GET /api/trains/{train_id}/eta — real M3 prediction, no ETA logic in React */
  getEta: (trainId: string) =>
    apiFetch<EtaResponse>(`/api/trains/${trainId}/eta`),

  /** GET /api/trains/{train_id}/route-eta */
  getRouteEta: (trainId: string) =>
    apiFetch<RouteEtaResponse>(`/api/trains/${trainId}/route-eta`),

  /**
   * POST /api/trains/{train_id}/update — simulated RTIS movement input.
   * Writes to train_movements → updates train_runs → triggers M3 → persists ETA prediction.
   */
  postMovementUpdate: async (
    trainId: string,
    body: MovementUpdateRequest,
  ): Promise<MovementUpdateResponse> => {
    const res = await fetch(`${BASE}/api/trains/${trainId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST /api/trains/${trainId}/update → HTTP ${res.status}`);
    }
    return res.json() as Promise<MovementUpdateResponse>;
  },
};

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * Convert an ISO-8601 datetime string from the API to "HH:MM" (IST display).
 *
 * Returns:
 *   "Not available"  — if iso is null / undefined / empty string
 *   "HH:MM"          — if iso is a valid datetime
 *   "Not available"  — if the string cannot be parsed
 *
 * NEVER returns "--:--", "undefined", "null", or "Invalid Date".
 */
export function fmtEtaTime(iso: string | null | undefined): string {
  if (!iso || iso.trim() === "") return "Not available";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Not available";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "Not available";
  }
}

/**
 * Format an ETA range from two ISO-8601 strings.
 *
 * Returns:
 *   "HH:MM – HH:MM"  — when both values are valid
 *   "Not available"  — when either value is missing / invalid
 */
export function fmtEtaRange(
  lower: string | null | undefined,
  upper: string | null | undefined,
): string {
  const lo = fmtEtaTime(lower);
  const hi = fmtEtaTime(upper);
  if (lo === "Not available" || hi === "Not available") return "Not available";
  return `${lo} – ${hi}`;
}

/**
 * Return the correct ETA display string based on API loading state.
 *
 *   loading = true  → "Calculating..."
 *   iso valid       → "HH:MM"
 *   otherwise       → "Not available"
 */
export function fmtEtaOrState(
  iso: string | null | undefined,
  loading: boolean,
): string {
  if (loading) return "Calculating...";
  return fmtEtaTime(iso);
}
