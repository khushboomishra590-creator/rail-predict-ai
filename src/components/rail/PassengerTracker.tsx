import { useState } from "react";
import { Search, Train, MapPin, Clock, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./Primitives";
import { trains, journeyStops, type Train as TrainType } from "@/data/demo";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function confColor(c: number) {
  return c >= 90 ? "text-green-400" : c >= 75 ? "text-yellow-400" : "text-red-400";
}
function confBg(c: number) {
  return c >= 90
    ? "bg-green-500/10 border-green-500/30 text-green-400"
    : c >= 75
    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
    : "bg-red-500/10 border-red-500/30 text-red-400";
}
function statusColor(s: string) {
  return s === "departed"  ? "bg-muted-foreground"
    : s === "arrived"    ? "bg-success"
    : s === "current"    ? "bg-live animate-pulse"
    : "bg-border";
}
function delayColor(d: number) {
  return d === 0 ? "text-success" : d <= 10 ? "text-warning" : "text-destructive";
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PassengerTrackerView() {
  const [query, setQuery]     = useState("");
  const [selected, setSelected] = useState<TrainType>(trains[0]);
  const [showSearch, setShowSearch] = useState(false);

  const filtered = trains.filter((t) =>
    `${t.number} ${t.name} ${t.current} ${t.destination}`.toLowerCase().includes(query.toLowerCase())
  );

  const currentStop = journeyStops.find((s) => s.status === "current")!;
  const totalDelay  = journeyStops[journeyStops.length - 1].delay ?? 0;
  const recovered   = selected.delay - totalDelay;

  return (
    <div className="space-y-4">
      {/* ── Hero search bar ── */}
      <div className="border border-border bg-card p-4">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Passenger Journey Tracker</p>
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
          <Button onClick={() => setShowSearch(false)}>Track</Button>
        </div>

        {/* search dropdown */}
        {showSearch && query && (
          <div className="mt-1 border border-border bg-card shadow-lg">
            {filtered.slice(0, 5).map((t) => (
              <button key={t.number} onClick={() => { setSelected(t); setShowSearch(false); setQuery(""); }}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent">
                <Train className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{t.number} · {t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.current} → {t.destination}</p>
                </div>
                <span className={`ml-auto text-xs font-mono font-semibold ${t.delay > 0 ? "text-warning" : "text-success"}`}>
                  {t.delay > 0 ? `+${t.delay} min` : "On time"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Train header card ── */}
      <div className="border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center bg-primary/10 text-primary"><Train className="size-4" /></span>
              <div>
                <p className="text-lg font-bold">{selected.number}</p>
                <p className="text-xs text-muted-foreground">{selected.name}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px]">{selected.zone}</span>
              <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px]">{selected.trainType}</span>
              <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px]">{selected.rake} Rake</span>
              <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px]">MPS {selected.mps} km/h</span>
            </div>
          </div>

          {/* status summary */}
          <div className="flex flex-wrap gap-3">
            <StatChip label="Current Delay"    value={`+${selected.delay} min`}   color="text-warning" />
            <StatChip label="AI Predicted ETA" value={selected.aiEta}             color="text-live" accent />
            <StatChip label="ETA Range"        value={`${selected.aiEtaLower}–${selected.aiEtaUpper}`} color="text-muted-foreground" />
            <StatChip label="Confidence"       value={`${selected.confidence}%`}  color={confColor(selected.confidence)} />
          </div>
        </div>

        {/* route progress bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="size-3" />{journeyStops[0].station}</span>
            <span className="font-mono">{selected.progress}% complete</span>
            <span className="flex items-center gap-1">{journeyStops[journeyStops.length - 1].station}<MapPin className="size-3" /></span>
          </div>
          <div className="relative h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-live transition-all" style={{ width: `${selected.progress}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full border-2 border-live bg-background shadow"
              style={{ left: `${selected.progress}%` }} />
          </div>
        </div>

        {/* AI summary sentence */}
        <div className="mt-3 flex items-start gap-2 rounded border border-live/20 bg-live/5 p-3">
          <Info className="mt-0.5 size-3.5 shrink-0 text-live" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <b className="text-live">AI prediction: </b>
            {selected.delay > 0
              ? `Train is running ${selected.delay} min behind schedule. The model predicts partial recovery — expected arrival at ${selected.destination} is ${selected.aiEta} (${selected.aiEtaLower}–${selected.aiEtaUpper}). Recovery of approx ${Math.max(0, recovered)} min is factored in based on historical section performance.`
              : `Train is running on time. Model predicts on-schedule arrival at ${selected.destination} by ${selected.aiEta}.`}
          </p>
        </div>
      </div>

      {/* ── Journey timeline ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_.42fr]">
        <Panel title="Station-by-Station Journey Timeline" kicker={`${selected.number} · ${selected.destination}`}>
          <div className="p-4">
            {journeyStops.map((stop, idx) => {
              const isLast    = idx === journeyStops.length - 1;
              const isCurrent = stop.status === "current";
              const isDone    = stop.status === "arrived" || stop.status === "departed";
              return (
                <div key={stop.station} className="flex gap-4">
                  {/* timeline spine */}
                  <div className="flex flex-col items-center">
                    <div className={`size-3.5 rounded-full border-2 shrink-0 mt-1 ${isCurrent ? "border-live bg-live shadow-[0_0_8px_var(--live)]" : isDone ? "border-success bg-success" : "border-border bg-background"}`} />
                    {!isLast && <div className={`w-px flex-1 my-1 ${isDone ? "bg-success/40" : "bg-border"}`} style={{ minHeight: 40 }} />}
                  </div>

                  {/* stop content */}
                  <div className={`pb-5 min-w-0 flex-1 ${isLast ? "pb-0" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold ${isCurrent ? "text-live" : isDone ? "text-muted-foreground" : "text-foreground"}`}>
                            {stop.station}
                          </p>
                          <span className="text-[9px] uppercase text-muted-foreground font-mono">{stop.code}</span>
                          {isCurrent && (
                            <span className="flex items-center gap-1 rounded bg-live/10 px-1.5 py-0.5 text-[9px] font-bold text-live">
                              <span className="size-1.5 animate-ping rounded-full bg-live" />CURRENT
                            </span>
                          )}
                          {stop.status === "departed" && <span className="text-[9px] text-muted-foreground">DEPARTED</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{stop.km} km from origin · Platform {stop.platform}</p>
                      </div>

                      {/* times */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="text-center">
                          <p className="text-[9px] text-muted-foreground">SCH</p>
                          <p className="font-mono text-muted-foreground">{stop.sch}</p>
                        </div>
                        {stop.ai ? (
                          <>
                            <ChevronRight className="size-3 text-muted-foreground" />
                            <div className="text-center">
                              <p className="text-[9px] text-muted-foreground">AI ETA</p>
                              <p className="font-mono font-bold text-live">{stop.ai}</p>
                              {stop.lower && stop.upper && (
                                <p className="text-[8px] text-muted-foreground">{stop.lower}–{stop.upper}</p>
                              )}
                            </div>
                            {stop.delay > 0 && (
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-warning/10 ${delayColor(stop.delay)}`}>
                                +{stop.delay}m
                              </span>
                            )}
                            {stop.delay === 0 && (
                              <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">ON TIME</span>
                            )}
                          </>
                        ) : (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">DEPARTED</span>
                        )}
                      </div>
                    </div>

                    {/* range bar for upcoming stops */}
                    {stop.ai && stop.lower && stop.upper && !isDone && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground">{stop.lower}</span>
                        <div className="relative h-1 flex-1 rounded-full bg-muted">
                          <div className="absolute inset-0 rounded-full bg-live/25" />
                          <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-live bg-background" />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{stop.upper}</span>
                        <span className="text-[9px] text-live">±5 min</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── Side info panels ── */}
        <div className="space-y-4">
          {/* Delay summary */}
          <Panel title="Delay Summary" kicker="AI prediction breakdown">
            <div className="space-y-3 p-4">
              <Row label="Current delay at origin"    value={`+${selected.delay} min`} color="text-warning" />
              <Row label="AI predicted final delay"   value={`+${totalDelay} min`}     color="text-live" />
              <Row label="Expected recovery"          value={`−${Math.max(0, recovered)} min`} color="text-success" />
              <div className="border-t border-border pt-3">
                <Row label="Model confidence"         value={`${selected.confidence}%`} color={confColor(selected.confidence)} />
                <Row label="Uncertainty band (P90)"   value="±10 min"                  color="text-muted-foreground" />
                <Row label="Model"                    value="Net-XGBoost v2"            color="text-muted-foreground" />
              </div>
            </div>
          </Panel>

          {/* Kinematics */}
          <Panel title="Live Kinematics" kicker="Real-time signal state">
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-success/10">
                  <span className="size-3 rounded-full bg-success" />
                </span>
                <div>
                  <p className="text-xs font-semibold">Block Signal: Green</p>
                  <p className="text-[10px] text-muted-foreground">Clear track ahead</p>
                </div>
              </div>
              <Row label="GPS Speed"       value={`${selected.speed} km/h`}  color="text-foreground" />
              <Row label="En-route Weather" value="Light Rain"               color="text-blue-400" />
              <Row label="TSR Active"      value="None (Clear Track)"        color="text-success" />
              <Row label="Preceding Train" value="12952 · 8 min ahead"      color="text-muted-foreground" />
            </div>
          </Panel>

          {/* Important predictive signals */}
          <Panel title="Important Predictive Signals" kicker="explain_prediction() output">
            <div className="space-y-2.5 p-4">
              {[
                { signal: "Current station delay",       impact: "+8.65 min", dir: "up"   },
                { signal: "Preceding train congestion",  impact: "+1.85 min", dir: "up"   },
                { signal: "Historical section pattern",  impact: "−0.73 min", dir: "down" },
                { signal: "Weather conditions",          impact: "+0.54 min", dir: "up"   },
                { signal: "Recovery absorption",         impact: "−2.10 min", dir: "down" },
              ].map(({ signal, impact, dir }) => (
                <div key={signal} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{signal}</span>
                  <span className={`font-mono font-semibold ${dir === "up" ? "text-warning" : "text-success"}`}>{impact}</span>
                </div>
              ))}
              <p className="pt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
                Perturbation importance · Does not imply causation
              </p>
            </div>
          </Panel>

          {/* Offline note */}
          <div className="border border-dashed border-border bg-muted/20 p-3 text-[10px] text-muted-foreground">
            <p className="font-semibold text-foreground">📱 Offline mode</p>
            <p className="mt-1">Last prediction cached locally. Connect to refresh live ETA. Timetable data available offline.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function StatChip({ label, value, color, accent }: { label: string; value: string; color: string; accent?: boolean }) {
  return (
    <div className={`border px-3 py-2 ${accent ? "border-live/30 bg-live/5" : "border-border bg-card"}`}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
