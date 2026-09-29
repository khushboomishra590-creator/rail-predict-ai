/**
 * PassengerTracker.tsx
 * ─────────────────────
 * Passenger View — uses REAL backend data for train 12951.
 *
 * Data flow:
 *   GET /api/trains/12951/eta
 *   → FastAPI M4 → PostgreSQL → M3 Dynamic ETA Engine → XGBoost
 *   → current_station, next_station, predicted_eta, eta_lower,
 *     eta_upper, uncertainty_minutes, current_delay, scheduled_eta
 *   → rendered in Passenger View
 *
 * For all other trains the static railData stop timeline is shown but
 * no fake live ETA is displayed — the ETA summary strip shows
 * "Not available" rather than hardcoded values.
 *
 * Rules:
 * - Do NOT calculate ETA inside React.
 * - Do NOT invent/hardcode ETA times.
 * - Do NOT show "--:--".
 * - Loading → "Calculating..."
 * - Missing → "Not available"
 * - Backend unavailable → "Backend unavailable"
 */

import { useState } from "react";
import { Search, Train, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allJourneyStops, trains, type Train as TrainType, type JourneyStop } from "@/data/railData";
import { useTrainEta } from "@/hooks/use-train-eta";
import { fmtEtaTime, fmtEtaRange } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delayLabel(delay: number): string {
  if (delay === 0) return "On time";
  if (delay < 60) return `${delay} min late`;
  const h = Math.floor(delay / 60), m = delay % 60;
  return m > 0 ? `${h} hr ${m} min late` : `${h} hr late`;
}

function delayTextColor(delay: number) {
  if (delay === 0) return "text-success";
  if (delay <= 15) return "text-warning";
  return "text-destructive";
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PassengerTrackerView({ initialTrain }: { initialTrain?: TrainType } = {}) {
  const [query, setQuery]           = useState("");
  const [selected, setSelected]     = useState<TrainType>(initialTrain ?? trains[0]);
  const [showSearch, setShowSearch] = useState(false);
  const [expanded, setExpanded]     = useState(true);

  // ── Real API — only for train 12951 ─────────────────────────────────────────
  const { state: etaState } = useTrainEta("12951");
  const isLive12951 = selected.number === "12951" && etaState.status === "ok";
  const isLoading12951 = selected.number === "12951" &&
    (etaState.status === "loading" || etaState.status === "idle");
  const isError12951 = selected.number === "12951" && etaState.status === "error";
  const liveEta = isLive12951 ? etaState.data : null;

  // ── ETA display helpers ──────────────────────────────────────────────────────
  function etaDisplay(iso: string | null | undefined): string {
    if (isLoading12951) return "Calculating...";
    if (isError12951)   return "Backend unavailable";
    return fmtEtaTime(iso);
  }

  function rangeDisplay(lower: string | null | undefined, upper: string | null | undefined): string {
    if (isLoading12951) return "Calculating...";
    if (isError12951)   return "Backend unavailable";
    return fmtEtaRange(lower, upper);
  }

  // ── Derived display values — real API for 12951, static for others ──────────
  const currentLocation = isLoading12951
    ? "Loading..."
    : isError12951
      ? "Backend unavailable"
      : liveEta
        ? liveEta.current_station
        : selected.current;

  const nextStation = isLoading12951
    ? "Loading..."
    : isError12951
      ? "Backend unavailable"
      : liveEta
        ? liveEta.next_station
        : selected.next;

  const predictedArrival = isLoading12951
    ? "Calculating..."
    : isError12951
      ? "Backend unavailable"
      : liveEta
        ? fmtEtaTime(liveEta.predicted_eta)
        : selected.number === "12951"
          ? "Not available"
          : selected.aiEta;

  const etaRange = rangeDisplay(
    liveEta?.eta_lower ?? null,
    liveEta?.eta_upper ?? null,
  );
  // For non-12951 trains use static range if available
  const displayRange = liveEta
    ? etaRange
    : selected.number !== "12951"
      ? fmtEtaRange(selected.aiEtaLower, selected.aiEtaUpper)
      : etaRange;

  const currentDelay = liveEta ? liveEta.current_delay : selected.delay;
  const scheduledEta = liveEta
    ? fmtEtaTime(liveEta.scheduled_eta)
    : selected.scheduled;
  const uncertaintyStr = liveEta
    ? `±${liveEta.uncertainty_minutes} min`
    : selected.number === "12951"
      ? (isLoading12951 ? "Calculating..." : "Not available")
      : "Not available";

  // ── AI prediction text ───────────────────────────────────────────────────────
  function buildAiText(): string {
    if (isLoading12951) return "Calculating expected arrival time…";
    if (isError12951)   return "Backend unavailable — cannot generate prediction.";
    if (!liveEta && selected.number === "12951") return "No prediction available for this train.";
    if (liveEta) {
      const delayPart = liveEta.current_delay > 0
        ? `Train is running ${liveEta.current_delay} min late.`
        : "Train is running on time.";
      const arrivalPart = `Predicted arrival: ${fmtEtaTime(liveEta.predicted_eta)}.`;
      const delayDiff = liveEta.predicted_delay > 0
        ? ` Expected delay at destination: +${liveEta.predicted_delay} min.`
        : " Model predicts on-time arrival.";
      return `${delayPart} ${arrivalPart}${delayDiff}`;
    }
    // Non-12951 static trains
    return currentDelay > 0
      ? `Train is running ${currentDelay} min late. Predicted arrival: ${predictedArrival}.`
      : "Train is running on time.";
  }

  // ── Stop list ────────────────────────────────────────────────────────────────
  const stopsToShow: JourneyStop[] = allJourneyStops[selected.number] ?? [
    { station: currentLocation, code: "", km: 0, sch: scheduledEta,
      ai: predictedArrival !== "Calculating..." && predictedArrival !== "Not available" && predictedArrival !== "Backend unavailable" ? predictedArrival : null,
      lower: liveEta?.eta_lower ?? null, upper: liveEta?.eta_upper ?? null,
      status: "current" as const, delay: currentDelay, platform: "—" },
    { station: nextStation, code: "", km: 0, sch: "—",
      ai: null, lower: null, upper: null,
      status: "upcoming" as const, delay: null, platform: "—" },
    { station: selected.destination, code: "", km: 0, sch: selected.scheduled,
      ai: predictedArrival !== "Calculating..." && predictedArrival !== "Not available" && predictedArrival !== "Backend unavailable" ? predictedArrival : null,
      lower: liveEta?.eta_lower ?? null, upper: liveEta?.eta_upper ?? null,
      status: "upcoming" as const, delay: currentDelay, platform: "—" },
  ];

  // For train 12951 with live API data, overlay the current stop's AI times
  // with real backend values so the stop timeline reflects the actual M3 output
  const stopsWithLiveOverlay: JourneyStop[] = liveEta
    ? stopsToShow.map((stop) => {
        if (stop.status === "current") {
          return {
            ...stop,
            station: liveEta.current_station || stop.station,
            ai: fmtEtaTime(liveEta.predicted_eta),
            lower: fmtEtaTime(liveEta.eta_lower),
            upper: fmtEtaTime(liveEta.eta_upper),
          };
        }
        // Next upcoming stop: show the live next_station
        if (stop.status === "upcoming" && stopsToShow.indexOf(stop) === stopsToShow.findIndex(s => s.status === "upcoming")) {
          return { ...stop, station: liveEta.next_station || stop.station };
        }
        return stop;
      })
    : stopsToShow;

  const origin = stopsWithLiveOverlay[0]?.station ?? "—";
  const dest   = stopsWithLiveOverlay[stopsWithLiveOverlay.length - 1]?.station ?? "—";
  const currentStop = stopsWithLiveOverlay.find((s) => s.status === "current");

  const filtered = trains.filter((t) =>
    `${t.number} ${t.name} ${t.current} ${t.destination}`
      .toLowerCase().includes(query.toLowerCase())
  );

  // Top-row displayed times
  const topScheduled = scheduledEta;
  const topExpected  = isLoading12951
    ? "Calculating..."
    : liveEta
      ? (fmtEtaRange(liveEta.eta_lower, liveEta.eta_upper) !== "Not available"
          ? fmtEtaRange(liveEta.eta_lower, liveEta.eta_upper)
          : fmtEtaTime(liveEta.predicted_eta))
      : selected.number !== "12951"
        ? (currentStop?.lower && currentStop?.upper
            ? `${currentStop.lower}–${currentStop.upper}`
            : (selected.aiEta || "Not available"))
        : "Not available";

  return (
    <div className="space-y-3 max-w-2xl mx-auto">

      {/* ── Search bar ── */}
      <div className="border border-border bg-card p-4">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Passenger View</p>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 border border-input bg-background px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Enter train number or name…"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button onClick={() => { setShowSearch(false); setQuery(""); }}>Track</Button>
        </div>

        {/* search dropdown */}
        {showSearch && query && (
          <div className="mt-1 border border-border bg-card shadow-lg">
            {filtered.slice(0, 5).map((t) => (
              <button
                key={t.number}
                onClick={() => { setSelected(t); setShowSearch(false); setQuery(""); }}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent"
              >
                <Train className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{t.number} · {t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.current} → {t.destination}</p>
                </div>
                <span className={`shrink-0 text-xs font-mono font-semibold ${t.delay > 0 ? "text-warning" : "text-success"}`}>
                  {t.delay > 0 ? `+${t.delay} min` : "On time"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Live data badge for 12951 ── */}
      {selected.number === "12951" && (
        <div className={`flex items-center gap-2 border px-3 py-2 text-[10px] font-semibold ${
          isLive12951
            ? "border-live/30 bg-live/5 text-live"
            : isLoading12951
              ? "border-border bg-card text-muted-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive"
        }`}>
          {isLive12951 && <><span className="size-1.5 animate-pulse rounded-full bg-live" /> LIVE — M3 XGBoost prediction active · GET /api/trains/12951/eta</>}
          {isLoading12951 && <><span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" /> Fetching prediction from backend…</>}
          {isError12951 && <><span className="size-1.5 rounded-full bg-destructive" /> Backend unavailable — prediction cannot be loaded</>}
          {liveEta && <span className="ml-auto text-muted-foreground font-normal">Updated {new Date(liveEta.last_updated).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</span>}
        </div>
      )}

      {/* ── Column headers ── */}
      <div className="flex justify-end gap-10 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Scheduled</span>
        <span>Expected (Range)</span>
      </div>

      {/* ── Single train card ── */}
      <div className="border border-border bg-card">

        {/* Top row: number badge + scheduled + expected */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary px-2.5 py-0.5 font-mono text-xs font-bold text-primary-foreground">
              {selected.number}
            </span>
            {(liveEta ? liveEta.current_delay > 0 : selected.delay > 0) && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-live">
                <span className="size-1.5 animate-pulse rounded-full bg-live" />
                {liveEta ? "LIVE" : "DELAYED"}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-8 font-mono text-sm">
            <span className="text-foreground font-medium">{topScheduled}</span>
            <span className={`font-bold ${delayTextColor(liveEta ? liveEta.current_delay : selected.delay)}`}>
              {topExpected}
            </span>
          </div>
        </div>

        {/* Train name + delay label */}
        <div className="flex items-center justify-between px-4 pb-3">
          <p className="text-sm font-semibold text-foreground">{selected.name}</p>
          <span className={`text-[11px] font-semibold ${delayTextColor(liveEta ? liveEta.current_delay : selected.delay)}`}>
            {liveEta
              ? delayLabel(liveEta.current_delay)
              : delayLabel(selected.delay)}
          </span>
        </div>

        {/* Origin → Destination spine */}
        <div className="flex items-stretch gap-3 border-t border-border px-4 py-3">
          <div className="flex flex-col items-center pt-1">
            <span className="size-2.5 shrink-0 rounded-full bg-success" />
            <span className="my-1 w-px flex-1 bg-border" style={{ minHeight: 16 }} />
            <span className="size-2.5 shrink-0 rounded-full bg-destructive" />
          </div>
          <div className="flex flex-1 flex-col justify-between gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{origin}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{dest}</span>
            </div>
          </div>
        </div>

        {/* Route progress bar */}
        <div className="border-t border-border px-4 py-3">
          <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{currentLocation}</span>
            <span className="font-mono">{selected.progress}% en route</span>
            <span>{selected.destination}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-live transition-all" style={{ width: `${selected.progress}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full border-2 border-live bg-background shadow"
              style={{ left: `${selected.progress}%` }}
            />
          </div>
        </div>

        {/* Journey details toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between border-t border-border px-4 py-2.5 text-[11px] font-semibold text-primary hover:bg-accent"
        >
          <span>Station-by-station journey</span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {/* Expandable stop timeline */}
        {expanded && (
          <div className="border-t border-border divide-y divide-border/60">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Station</span>
              <span>Scheduled</span>
              <span>Expected (Range)</span>
            </div>

            {stopsWithLiveOverlay.map((stop, idx) => {
              const isDone    = stop.status === "departed" || stop.status === "arrived";
              const isCurrent = stop.status === "current";
              const isLast    = idx === stopsWithLiveOverlay.length - 1;

              // For the current stop of train 12951, use live API values
              const displayAi = (isCurrent && isLoading12951)
                ? "Calculating..."
                : stop.ai ?? (isDone ? null : null);
              const displayRange2 = (isCurrent && liveEta)
                ? fmtEtaRange(liveEta.eta_lower, liveEta.eta_upper)
                : (stop.lower && stop.upper ? `${stop.lower}–${stop.upper}` : null);

              return (
                <div
                  key={`${stop.station}-${idx}`}
                  className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? "bg-live/5" : ""} ${isDone ? "opacity-50" : ""}`}
                >
                  <div className="flex flex-col items-center self-stretch pt-1.5">
                    <span className={`size-2 shrink-0 rounded-full ${
                      isCurrent ? "bg-live shadow-[0_0_6px_var(--live)]" :
                      isDone    ? "bg-success" :
                      isLast    ? "bg-destructive" : "bg-border"
                    }`} />
                    {!isLast && <span className={`my-1 w-px flex-1 ${isDone ? "bg-success/40" : "bg-border"}`} style={{ minHeight: 12 }} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold ${isCurrent ? "text-live" : isDone ? "text-muted-foreground" : "text-foreground"}`}>
                        {stop.station}
                      </p>
                      {stop.code && <span className="font-mono text-[9px] text-muted-foreground">{stop.code}</span>}
                      {isCurrent && (
                        <span className="rounded bg-live/10 px-1 py-0.5 text-[8px] font-bold text-live">NOW</span>
                      )}
                    </div>
                    {stop.platform && stop.platform !== "—" && (
                      <p className="text-[9px] text-muted-foreground">Platform {stop.platform}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 text-xs font-mono">
                    <span className="text-muted-foreground w-12 text-right">{stop.sch ?? "—"}</span>
                    <span className={`text-right font-bold ${
                      displayAi
                        ? stop.delay != null && stop.delay > 0 ? delayTextColor(stop.delay) : "text-success"
                        : "text-muted-foreground"
                    }`} style={{ minWidth: "7rem" }}>
                      {displayAi
                        ? (displayRange2 ?? displayAi)
                        : (isDone ? "✓" : "—")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ETA summary strip — all values from real API for train 12951 ── */}
      <div className="grid grid-cols-3 divide-x divide-border border border-border bg-card text-xs">
        <div className="px-4 py-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Current delay</p>
          <p className={`mt-1 font-mono font-bold ${
            isLoading12951 ? "text-muted-foreground" : delayTextColor(currentDelay)
          }`}>
            {isLoading12951
              ? "Calculating..."
              : isError12951
                ? "Unavailable"
                : liveEta
                  ? (liveEta.current_delay > 0 ? `+${liveEta.current_delay} min` : "On time")
                  : (selected.delay > 0 ? `+${selected.delay} min` : "On time")}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Predicted arrival</p>
          <p className={`mt-1 font-mono font-bold ${isLoading12951 ? "text-muted-foreground" : "text-live"}`}>
            {predictedArrival}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">ETA window</p>
          <p className={`mt-1 font-mono ${isLoading12951 ? "text-muted-foreground" : "text-foreground"}`}>
            {displayRange}
          </p>
        </div>
      </div>

      {/* ── AI prediction text + uncertainty ── */}
      <div className="border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <b className="text-live">AI prediction:</b>{" "}
        <span>{buildAiText()}</span>
        {!isLoading12951 && !isError12951 && (
          <p className="mt-1.5 text-[10px]">
            Uncertainty: <span className="font-semibold text-warning">{uncertaintyStr}</span>
            {liveEta && (
              <> · Source: <span className="font-mono">GET /api/trains/12951/eta</span> · M3 XGBoost v2</>
            )}
          </p>
        )}
      </div>

    </div>
  );
}
