import { useEffect, useMemo, useState } from "react";
import { useTrainEta } from "@/hooks/use-train-eta";
import { useTrainList } from "@/hooks/use-train-list";
import { useRouteEta } from "@/hooks/use-route-eta";
import { api, fmtEtaTime, fmtEtaRange, fmtEtaOrState, type EtaResponse, type RouteEtaResponse } from "@/lib/api";
import {
  AlertTriangle, Bell, BrainCircuit, ChevronDown, CircleUserRound,
  Moon, Pause, Play, RotateCcw, Search, Sparkles, Sun, TrainFront, Zap,
  Activity, BarChart2, FlaskConical, MapPin, Shield, Cpu, Wifi,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Line, LineChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis, Legend,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { KpiCard, Metric, Panel, StatusDot, LiveBadge } from "./Primitives";
import { TrainMap } from "./TrainMap";
import { PassengerTrackerView } from "./PassengerTracker";
import { ScenarioSandboxView } from "./ScenarioSandbox";
import {
  chartData, delayFactors, featureImportance, initialAlerts, journeyStops,
  modelTiers, networkSections, pidsRows, scenarios, stations, zones,
  trains as demoTrains,
  type Train,
} from "@/data/demo";
import { allJourneyStops } from "@/data/railData";

// ─── Navigation ───────────────────────────────────────────────────────────────
const nav = [
  "Dashboard", "Live Trains", "ETA Prediction",
  "Passenger Tracker", "Station PIDS", "Scenario Sandbox",
  "Network Monitor", "Delay Analytics", "Model Performance",
  "Alerts", "API / Integration",
];

// ─── Hindi status map ─────────────────────────────────────────────────────────
const STATUS_HI: Record<string, string> = {
  "on-time": "समय पर", minor: "थोड़ा विलंब",
  significant: "विलंबित", critical: "अत्यंत विलंब",
};

// ─── Confidence colour helper ─────────────────────────────────────────────────
function confColor(c: number) {
  return c >= 90 ? "text-success" : c >= 75 ? "text-warning" : "text-destructive";
}
function confBg(c: number) {
  return c >= 90 ? "bg-success/10 text-success border-success/30"
    : c >= 75 ? "bg-warning/10 text-warning border-warning/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [view, setView] = useState("Dashboard");
  const [running, setRunning] = useState(true);
  const [simMode, setSimMode] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [congestion, setCongestion] = useState(false);
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState(initialAlerts);
  const [activeScenarios, setActiveScenarios] = useState<string[]>([]);

  // ── Train list from API (GET /api/trains) — falls back to demo on error ──────
  const trainListState = useTrainList();
  const sourceTrains = trainListState.status === "loading" ? [] : trainListState.trains;
  const [selected, setSelected] = useState<Train>(demoTrains[0]);

  // Keep selected in sync when the API train list loads
  useEffect(() => {
    if (trainListState.status === "ok" && trainListState.trains.length > 0) {
      setSelected((prev) => {
        const match = trainListState.trains.find((t) => t.number === prev.number);
        return match ?? trainListState.trains[0];
      });
    }
  }, [trainListState.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── M4 API — real ETA for train 12951 only ──────────────────────────────────
  const { state: etaState, refresh: refreshEta } = useTrainEta("12951");
  const liveEta: EtaResponse | null =
    etaState.status === "ok" ? etaState.data : null;

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  useEffect(() => {
    if (!running || !simMode) return;
    const id = window.setInterval(() => setTick((v) => v + 1), 3000 / speed);
    return () => window.clearInterval(id);
  }, [running, simMode, speed]);

  // ── Real-time IST clock ──────────────────────────────────────────────────────
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const istTime = clock.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "Asia/Kolkata",
  });

  const liveSelected = useMemo(() => ({
    ...selected,
    speed: Math.max(48, selected.speed + ((tick % 5) - 2)),
    confidence: Math.max(78, selected.confidence - (congestion ? 6 : 0) + (tick % 2)),
    delay: selected.delay + (congestion ? 8 : 0),
    aiEta: congestion && selected.number === "12951" ? "22:01" : selected.aiEta,
    aiEtaLower: congestion && selected.number === "12951" ? "21:56" : selected.aiEtaLower,
    aiEtaUpper: congestion && selected.number === "12951" ? "22:06" : selected.aiEtaUpper,
    range: congestion && selected.number === "12951" ? "21:56 – 22:06" : selected.range,
  }), [selected, tick, congestion]);

  const filtered = sourceTrains.filter(
    (t) => `${t.number} ${t.name} ${t.current}`.toLowerCase().includes(query.toLowerCase())
  );


  function triggerCongestion() {
    if (congestion) return;
    setCongestion(true);
    setAlerts((a) => [{
      severity: "critical", time: "NOW", title: "Vadodara → Ratlam",
      reason: "Congestion event — route_congestion_index spiked to 9.2",
      impact: "+8 min", action: "Recalculate precedence plan",
    }, ...a]);
    toast.error("Critical congestion detected", {
      description: "Train 12951 AI ETA revised to 22:01. Network cascade risk active.",
    });
  }

  function injectScenario(id: string) {
    if (activeScenarios.includes(id)) return;
    const s = scenarios.find((x) => x.id === id)!;
    setActiveScenarios((prev) => [...prev, id]);
    setAlerts((a) => [{
      severity: s.severity, time: "NOW", title: s.label,
      reason: s.description, impact: s.impact, action: "ETA recalculated",
    }, ...a]);
    toast.error(`Scenario injected: ${s.label}`, { description: `Expected impact: ${s.impact}` });
  }

  function clearScenarios() {
    setActiveScenarios([]);
    toast.success("All scenarios cleared — restoring optimal schedule");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Toaster position="top-right" theme={dark ? "dark" : "light"} />



      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 lg:px-5">
          <button className="flex min-w-0 items-center gap-3" onClick={() => setView("Dashboard")}>
            <span className="flex size-9 shrink-0 items-center justify-center bg-primary text-primary-foreground">
              <TrainFront className="size-5" />
            </span>
            <span className="min-w-0 text-left">
              <b className="block truncate text-sm tracking-wide">
                RailPredict <span className="text-primary">AI</span>
              </b>
              <small className="hidden truncate text-[9px] uppercase tracking-[.16em] text-muted-foreground sm:block">
                Dynamic ETA Intelligence
              </small>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* live clock — real IST */}
            <span className="hidden font-mono text-[11px] text-foreground lg:block">
              {istTime} IST
            </span>
            <span className="hidden items-center gap-1.5 text-[10px] font-bold text-warning md:flex rounded border border-warning/40 bg-warning/10 px-2 py-0.5">
              <i className="size-2 animate-pulse rounded-full bg-warning" /> DEMO — Simulated RTIS
            </span>
            {/* KPIs */}
            <div className="hidden items-center divide-x divide-border border border-border lg:flex">
              <span className="px-3 py-1 text-center">
                <p className="font-mono text-sm font-bold">229</p>
                <p className="text-[8px] uppercase text-muted-foreground">Trains tracked</p>
              </span>
              <span className="px-3 py-1 text-center">
                <p className="font-mono text-sm font-bold text-success">55.9%</p>
                <p className="text-[8px] uppercase text-muted-foreground">Punctuality</p>
              </span>
              <span className="px-3 py-1 text-center">
                <p className="font-mono text-sm font-bold text-warning">+5.5m</p>
                <p className="text-[8px] uppercase text-muted-foreground">Avg delay</p>
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDark((v) => !v)}>
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>

        {/* simulation bar — visible only on Dashboard and ETA Prediction */}
        {(view === "Dashboard" || view === "ETA Prediction") && (
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5 lg:px-5">
          <SimulationControls
            running={running} setRunning={setRunning}
            simMode={simMode} setSimMode={setSimMode}
            speed={speed} setSpeed={setSpeed}
            onReset={() => { setTick(0); setCongestion(false); setActiveScenarios([]); toast.success("Simulation reset"); }}
          />
          <span className="hidden text-[9px] uppercase tracking-wider text-muted-foreground sm:block">
            Network Simulation Time
          </span>
        </div>
        )}

        {/* nav tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 lg:px-4 [-webkit-overflow-scrolling:touch]">
          {nav.map((item) => (
            <button key={item} onClick={() => setView(item)}
              className={`h-11 shrink-0 whitespace-nowrap border-b-2 px-2.5 text-[11px] font-semibold transition-colors ${view === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main className="p-3 lg:p-4">
        <div className="mx-auto max-w-[1700px]">
          <div className="mb-4 min-w-0">
            <h1 className="text-lg font-semibold sm:text-2xl">
              {view === "Dashboard" ? "Dynamic ETA Intelligence & Railway Operations" : view}
            </h1>
          </div>

          {view === "Dashboard"        && <DashboardView selected={liveSelected} setSelected={setSelected} tick={tick} congestion={congestion} triggerCongestion={triggerCongestion} query={query} setQuery={setQuery} filtered={filtered} liveEta={liveEta} refreshEta={refreshEta} allTrains={sourceTrains} etaLoading={etaState.status === "loading"} />}
          {view === "Live Trains"      && <LiveTrainsView allTrains={sourceTrains} onSelect={(t) => { setSelected(t); setView("Dashboard"); }} />}
          {view === "ETA Prediction"   && <PredictionView selected={liveSelected} setSelected={setSelected} allTrains={sourceTrains} congestion={congestion} triggerCongestion={triggerCongestion} liveEta={liveEta} refreshEta={refreshEta} etaLoading={etaState.status === "loading"} />}
          {view === "Passenger Tracker"&& <PassengerTrackerView />}
          {view === "Station PIDS"     && <StationPIDSView />}
          {view === "Scenario Sandbox" && <ScenarioSandboxView activeScenarios={activeScenarios} onInject={injectScenario} onClear={clearScenarios} alerts={alerts} />}
          {view === "Network Monitor"  && <NetworkView congestion={congestion} />}
          {view === "Delay Analytics"  && <AnalyticsView />}
          {view === "Model Performance"&& <ModelView />}
          {view === "Alerts"           && <AlertsView alerts={alerts} />}
          {view === "API / Integration"&& <ArchitectureView />}

          <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-border py-5 text-[10px] uppercase tracking-wider text-muted-foreground sm:flex-row">
            <span>RailPredict AI</span>
            <span>Network-aware XGBoost · MAE 4.34 min · 29 features · 20K training rows</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

// ─── Simulation controls ──────────────────────────────────────────────────────
function SimulationControls({ running, setRunning, simMode, setSimMode, speed, setSpeed, onReset }: {
  running: boolean; setRunning: (v: boolean) => void; simMode: boolean;
  setSimMode: (v: boolean) => void; speed: number; setSpeed: (v: number) => void; onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border border-border bg-card p-1.5">
      <label className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wider">
        <Switch checked={simMode} onCheckedChange={setSimMode} /> Simulation
      </label>
      <Button size="sm" variant={running ? "secondary" : "default"} onClick={() => setRunning(!running)}>
        {running ? <Pause /> : <Play />}{running ? "Pause" : "Start"}
      </Button>
      <Button size="icon" variant="ghost" onClick={onReset} title="Reset simulation"><RotateCcw /></Button>
      {[1, 2, 5, 15].map((v) => (
        <Button key={v} size="sm" variant={speed === v ? "default" : "ghost"} onClick={() => setSpeed(v)}>{v}x</Button>
      ))}
    </div>
  );
}

// ─── Dashboard view ───────────────────────────────────────────────────────────
function DashboardView({ selected, setSelected, tick, congestion, triggerCongestion, query, setQuery, filtered, liveEta, refreshEta, allTrains, etaLoading }: {
  selected: Train; setSelected: (t: Train) => void; tick: number; congestion: boolean;
  triggerCongestion: () => void; query: string; setQuery: (v: string) => void; filtered: Train[];
  liveEta: EtaResponse | null; refreshEta: () => void; allTrains: Train[]; etaLoading: boolean;
}) {
  const spark = (n: number) => Array.from({ length: 8 }, (_, i) => n + Math.sin(i + tick) * n * 0.05);
  const eta12951 = selected.number === "12951" ? liveEta : null;
  const loading12951 = selected.number === "12951" ? etaLoading : false;
  return (
    <>
      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Live trains"       value="1,248"                         change="2.4%"   data={spark(60)} />
        <KpiCard label="On-time trains"    value="78.6%"                         change="1.8%"   tone="success"  data={spark(78)} />
        <KpiCard label="Delayed trains"    value={congestion ? "222" : "214"}    change={congestion ? "+3.7%" : "-4.2%"} tone="danger" data={spark(45)} />
        <KpiCard label="Avg network delay" value={congestion ? "19 min" : "18 min"} change="+1.2%" tone="warning" data={spark(20)} />
        <KpiCard label="ETA accuracy"      value="91.8%"                         change="2.1%"   tone="success"  data={spark(88)} />
        <KpiCard label="Active alerts"     value={congestion ? "18" : "17"}      change={congestion ? "+5.9%" : "-8.4%"} tone="danger" data={spark(17)} />
      </div>

      {/* Map + Train detail */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]">
        <Panel title="Live Railway Network" kicker="Western–Northern corridor"
          action={<span className="flex items-center gap-1.5 text-[10px] text-live"><i className="size-1.5 animate-pulse rounded-full bg-live" /> POSITION STREAM ACTIVE</span>}>
          <TrainMap
            trains={allTrains.map((t: Train, i: number) => ({ ...t, y: t.y + ((tick + i) % 4) * 0.25 }))}
            selected={selected} onSelect={setSelected} congestion={congestion} />
        </Panel>
        <TrainDetail train={selected} congestion={congestion} triggerCongestion={triggerCongestion} liveEta={eta12951} etaLoading={loading12951} />
      </div>

      {/* Capability strip */}
      <CapabilityStrip />

      {/* Prediction + Factors */}
      <div className="my-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <PredictionPanel selected={selected} congestion={congestion} liveEta={eta12951} etaLoading={loading12951} />
        <FactorsPanel congestion={congestion} />
      </div>

      {/* Simulated RTIS — Demo Mode: movement → M4 → M3 → ETA */}
      <SimulatedRtisPanel refreshEta={refreshEta} />

      {/* Station table + Search */}
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <StationTable trainNumber={selected.number} trainName={selected.shortName} />
        <Panel title="Train Search" kicker="Live operational feed">
          <SearchBox query={query} setQuery={setQuery} />
          <div className="divide-y divide-border">
            {filtered.slice(0, 4).map((t) => (
              <button onClick={() => setSelected(t)} key={t.number}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-accent">
                <div>
                  <p className="text-xs font-semibold">{t.number} · {t.shortName}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{t.current} → {t.destination}</p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">{t.zone} · {t.trainType} · {t.rake}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-live">
                    AI {fmtEtaTime(t.aiEta) === "Not available" ? "—" : fmtEtaTime(t.aiEta)}
                  </p>
                  {fmtEtaRange(t.aiEtaLower, t.aiEtaUpper) !== "Not available" && (
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{fmtEtaRange(t.aiEtaLower, t.aiEtaUpper)}</p>
                  )}
                  {t.confidence > 0 && (
                    <p className={`mt-1 text-[9px] ${confColor(t.confidence)}`}>{t.confidence}% CONF.</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Bottom widgets */}
      {/* PassengerCard follows the selected train; liveEta only available for 12951 */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <PassengerCard selected={selected} liveEta={eta12951} etaLoading={loading12951} />
        <StationDisplayBoard />
      </div>
    </>
  );
}

// ─── Train detail panel ───────────────────────────────────────────────────────
function TrainDetail({ train, congestion, triggerCongestion, liveEta, etaLoading = false }: {
  train: Train; congestion: boolean; triggerCongestion: () => void;
  liveEta: EtaResponse | null; etaLoading?: boolean;
}) {
  const isLive = liveEta !== null;
  const fmt = (iso: string | null | undefined) => fmtEtaOrState(iso, etaLoading);
  const range = etaLoading
    ? "Calculating..."
    : isLive
      ? fmtEtaRange(liveEta!.eta_lower, liveEta!.eta_upper)
      : fmtEtaRange(train.aiEtaLower, train.aiEtaUpper);

  return (
    <Panel title={`${train.number} · ${train.shortName}`} kicker="Selected train" action={<StatusDot status={train.status} />} className="h-full">
      <div className="p-4">
        {/* header */}
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <div className="flex size-10 items-center justify-center bg-primary/10 text-primary"><TrainFront /></div>
          <div>
            <p className="text-sm font-semibold">
              {etaLoading ? "Locating…" : isLive ? liveEta!.current_station : train.current}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Next · {etaLoading ? "…" : isLive ? liveEta!.next_station : train.next}
            </p>
            <p className="text-[9px] text-muted-foreground">{train.zone} · {train.trainType} · MPS {train.mps} km/h</p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-lg font-semibold">
              {etaLoading ? "…" : isLive ? liveEta!.current_speed : train.speed}{" "}
              <span className="text-[10px] text-muted-foreground">km/h</span>
            </p>
            <p className="text-[9px] uppercase text-live">Movement verified</p>
          </div>
        </div>

        {/* metrics grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Metric label="Current delay"
            value={etaLoading ? "Calculating..." : isLive ? `+${liveEta!.current_delay} min` : `+${train.delay} min`} />
          <Metric label="Scheduled ETA"
            value={isLive ? fmt(liveEta!.scheduled_eta) : train.scheduled} />
          <Metric label="Current ETA"
            value={isLive ? fmt(liveEta!.predicted_eta) : train.currentEta} />
          <Metric label="AI Predicted ETA"
            value={isLive ? fmt(liveEta!.predicted_eta) : train.aiEta} accent />
        </div>

        {/* progress */}
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-[10px]">
            <span className="uppercase text-muted-foreground">Route progress</span>
            <span className="font-mono">{train.progress}%</span>
          </div>
          <div className="h-1.5 bg-muted"><div className="h-full bg-live transition-all" style={{ width: `${train.progress}%` }} /></div>
        </div>

        {/* Forecast confidence band */}
        <div className="mt-4 border border-border bg-card/50 p-3">
          <p className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">Forecast Confidence Band</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">Expected (P50)</p><p className="font-mono font-semibold text-live">+3.2 min</p></div>
            <div><p className="text-muted-foreground">Upper Risk (P90)</p><p className="font-mono font-semibold text-warning">+10.0 min</p></div>
            <div><p className="text-muted-foreground">Model MAE</p><p className="font-mono font-semibold">4.34 min</p></div>
            <div><p className="text-muted-foreground">Confidence</p><p className={`font-mono font-semibold ${confColor(train.confidence)}`}>{train.confidence}%</p></div>
          </div>
        </div>

        {/* ETA range */}
        <div className="mt-3 border-l-2 border-live bg-live/5 p-3">
          <div className="flex justify-between">
            <span className="text-[10px] uppercase text-muted-foreground">Prediction range</span>
            <b className={`font-mono text-[11px] ${confColor(train.confidence)}`}>{train.confidence}%</b>
          </div>
          <p className={`mt-1 font-mono text-sm ${etaLoading ? "text-muted-foreground" : ""}`}>{range}</p>
          {!etaLoading && (
            <div className="mt-2 flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground">
                {isLive ? fmtEtaTime(liveEta!.eta_lower) : fmtEtaTime(train.aiEtaLower)}
              </span>
              <div className="relative h-1.5 flex-1 rounded bg-muted">
                <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-live bg-background" />
                <div className="h-full w-1/2 rounded bg-live/40" />
              </div>
              <span className="text-[9px] text-muted-foreground">
                {isLive ? fmtEtaTime(liveEta!.eta_upper) : fmtEtaTime(train.aiEtaUpper)}
              </span>
            </div>
          )}
        </div>

        <Button onClick={triggerCongestion} disabled={congestion}
          variant={congestion ? "secondary" : "destructive"} className="mt-4 w-full">
          <AlertTriangle />{congestion ? "Congestion Event Active" : "Trigger Congestion Event"}
        </Button>
      </div>
    </Panel>
  );
}


// ─── Simulated RTIS Panel ─────────────────────────────────────────────────────
// Demo Mode: sends a simulated RTIS movement to FastAPI → PostgreSQL → M3 engine
// then calls refreshEta() to pull the fresh prediction into the dashboard.
function SimulatedRtisPanel({ refreshEta }: { refreshEta: () => void }) {
  const [speed, setSpeed] = useState(90);
  const [delay, setDelay] = useState(5);
  const [distance, setDistance] = useState(8);
  const [lat, setLat] = useState(22.307);
  const [lon, setLon] = useState(73.181);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleSimulate() {
    setBusy(true);
    setLastResult(null);
    try {
      const res = await api.postMovementUpdate("12951", {
        train_id: "12951",
        latitude: lat,
        longitude: lon,
        speed,
        timestamp: new Date().toISOString(),
        current_delay_min: delay,
        current_section: "BRC_SECTION",
        distance_to_next_station_km: distance,
      });
      setLastResult(`Movement #${res.movement_id} recorded. Refreshing ETA…`);
      // Wait briefly for M3 to finish, then pull the new prediction
      await new Promise((r) => setTimeout(r, 400));
      refreshEta();
      toast.success("Simulated RTIS accepted", {
        description: `movement_id=${res.movement_id} · delay=${delay} min · speed=${speed} km/h`,
      });
    } catch (err) {
      setLastResult(`Error: ${String(err)}`);
      toast.error("RTIS update failed", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Simulated RTIS Feed"
      kicker="DEMO MODE — Train 12951 · FastAPI → PostgreSQL → M3 Engine"
      className="mt-4"
      action={
        <span className="rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase text-warning">
          Demo Mode
        </span>
      }
    >
      <div className="p-4">
        <p className="mb-3 text-[10px] text-muted-foreground">
          Inject a simulated train position. The backend writes to{" "}
          <code className="text-foreground">train_movements</code>, updates{" "}
          <code className="text-foreground">train_runs</code>, calls M3 XGBoost, persists to{" "}
          <code className="text-foreground">eta_predictions</code>, and returns the new ETA.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              { label: "Speed (km/h)", value: speed, set: setSpeed, min: 0, max: 160, step: 5 },
              { label: "Delay (min)", value: delay, set: setDelay, min: 0, max: 120, step: 1 },
              { label: "Distance to next (km)", value: distance, set: setDistance, min: 0.5, max: 200, step: 0.5 },
              { label: "Latitude", value: lat, set: setLat, min: 8, max: 37, step: 0.001 },
              { label: "Longitude", value: lon, set: setLon, min: 68, max: 97, step: 0.001 },
            ] as const
          ).map(({ label, value, set, min, max, step }) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
              <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => (set as (v: number) => void)(Number(e.target.value))}
                className="border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSimulate} disabled={busy} className="gap-2">
            <Cpu className={busy ? "animate-spin" : ""} />
            {busy ? "Sending…" : "Simulate Movement → M3 Engine"}
          </Button>
          {lastResult && (
            <span className="text-[10px] text-muted-foreground">{lastResult}</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ─── Capability strip ─────────────────────────────────────────────────────────
function CapabilityStrip() {
  const items = [
    [BrainCircuit, "Predict", "Continuously recalculates arrival time using 29 live features"],
    [Sparkles,    "Explain",  "Attributes delay impact per factor — plain language for operators"],
    [Zap,         "Respond",  "Revises ETAs and raises actionable alerts within seconds"],
  ] as const;
  return (
    <div className="grid border border-border bg-card md:grid-cols-3">
      {items.map(([Icon, a, b], i) => (
        <div key={a} className={`flex items-center gap-3 p-4 ${i < 2 ? "border-b border-border md:border-b-0 md:border-r" : ""}`}>
          <span className="flex size-9 items-center justify-center bg-primary/10 text-primary"><Icon className="size-4" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em]">{a}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{b}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Prediction panel ─────────────────────────────────────────────────────────
// ─── Prediction panel ─────────────────────────────────────────────────────────
function PredictionPanel({ selected, congestion, liveEta, etaLoading = false }: {
  selected: Train; congestion: boolean; liveEta: EtaResponse | null; etaLoading?: boolean;
}) {
  const isLive = liveEta !== null;
  const fmt = (iso: string | null | undefined) => fmtEtaOrState(iso, etaLoading);
  const aiEta = isLive
    ? fmt(liveEta!.predicted_eta)
    : (congestion && selected.number === "12951" ? "22:01" : selected.aiEta);
  const scheduledEta = isLive ? fmt(liveEta!.scheduled_eta) : selected.scheduled;
  const currentEta  = isLive ? fmt(liveEta!.predicted_eta)  : selected.currentEta;
  const improvement = isLive
    ? `${liveEta!.delay_adjustment > 0 ? "+" : ""}${liveEta!.delay_adjustment} min vs schedule`
    : (congestion ? "-1 min" : "-7 min");
  const rangeLo = isLive ? liveEta!.eta_lower : selected.aiEtaLower;
  const rangeHi = isLive ? liveEta!.eta_upper : selected.aiEtaUpper;
  const rangeStr = etaLoading
    ? "Calculating..."
    : fmtEtaRange(rangeLo, rangeHi);
  const uncertainty = isLive ? `±${liveEta!.uncertainty_minutes} min` : "±5 min";

  return (
    <Panel title="AI ETA Prediction" kicker="Dynamic comparison"
      action={<span className={`font-mono text-xs ${confColor(selected.confidence)}`}>CONF {selected.confidence}%</span>}>
      <div className="grid border-b border-border sm:grid-cols-3">
        <div className="p-4"><Metric label="Scheduled ETA" value={scheduledEta} /></div>
        <div className="border-y border-border p-4 sm:border-x sm:border-y-0"><Metric label="Current Railway ETA" value={currentEta} /></div>
        <div className="bg-live/5 p-4">
          <Metric label="AI Predicted ETA" value={aiEta} accent />
          <p className="mt-1 text-[10px] text-success">{improvement} vs current</p>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-1.5 flex-1 bg-muted"><i className="block h-full w-[35%] bg-muted-foreground" /></span>
          <span className="size-2 rounded-full bg-muted-foreground" />
          <span className="h-1.5 flex-1 bg-orange-500/30">
            <i className="block h-full bg-live transition-all" style={{ width: congestion ? "90%" : "55%" }} />
          </span>
          <span className="size-3 rounded-full bg-live ring-4 ring-live/15" />
        </div>
        <div className="flex justify-between text-[9px] uppercase text-muted-foreground">
          <span>Scheduled {scheduledEta}</span>
          <span>Current {currentEta}</span>
          <span className="text-live">AI {aiEta}</span>
        </div>
        {/* range bar */}
        <div className="mt-3 flex items-center gap-2 rounded border border-live/20 bg-live/5 px-3 py-2">
          <span className="text-[9px] text-muted-foreground">
            {etaLoading ? "…" : fmtEtaTime(rangeLo)}
          </span>
          <div className="relative h-1 flex-1 rounded bg-muted">
            <div className="absolute inset-0 rounded bg-live/30" />
            <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-live bg-background" />
          </div>
          <span className="text-[9px] text-muted-foreground">
            {etaLoading ? "…" : fmtEtaTime(rangeHi)}
          </span>
          <span className={`ml-1 text-[10px] font-semibold ${confColor(selected.confidence)}`}>
            {etaLoading ? "…" : uncertainty}
          </span>
        </div>
        {/* full range label */}
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Range: <span className={isLive && !etaLoading ? "text-foreground font-semibold" : ""}>{rangeStr}</span>
        </p>
        <p className="mt-4 border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted-foreground">
          AI prediction dynamically updates using real-time train movement, historical sectional delays, congestion, weather, and network conditions across 29 features.
        </p>
      </div>
    </Panel>
  );
}

// ─── Factors panel — with minute impacts ─────────────────────────────────────
function FactorsPanel({ congestion }: { congestion: boolean }) {
  const factors = delayFactors.map((f, i) => ({
    ...f,
    pct: congestion && i === 0 ? 49 : f.pct,
    impact: congestion && i === 0 ? "+5.8 min" : f.impact,
  }));
  return (
    <Panel title="Delay Factor Attribution" kicker="ML-derived signals">
      <div className="space-y-3 p-4">
        {factors.map(({ label, impact, pct }, i) => {
          const isRecovery = impact.startsWith("−") || impact.startsWith("-");
          return (
            <div key={label}>
              <div className="mb-1.5 flex justify-between text-[10px]">
                <span className="text-foreground">{label}</span>
                <b className={`font-mono ${isRecovery ? "text-success" : i === 0 ? "text-destructive" : i < 3 ? "text-warning" : "text-live"}`}>{impact}</b>
              </div>
              <div className="h-1.5 bg-muted">
                <div className={`h-full transition-all duration-700 ${isRecovery ? "bg-success" : i === 0 ? "bg-destructive" : i < 3 ? "bg-warning" : "bg-live"}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <p className="pt-2 text-[9px] uppercase tracking-wider text-muted-foreground">
          Source: explain_prediction() · perturbation importance · Network-aware XGBoost v2
        </p>
      </div>
    </Panel>
  );
}

// ─── Station table — with range, reason, confidence colour ───────────────────
function StationTable({ trainNumber, trainName }: { trainNumber: string; trainName: string }) {
  const { state } = useRouteEta(trainNumber);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  const routeData = state.status === "ok" ? state.data : null;
  const isLive    = state.status === "ok";
  const isLoading = state.status === "loading" || state.status === "idle";

  // Build rows: live API data when available, demo fallback otherwise
  const rows = useMemo(() => {
    if (routeData && routeData.stations.length > 0) {
      return routeData.stations.map((s) => ({
          station: s.next_station,
          stationCode: (s.next_station.split(" ")[0] ?? s.next_station).toUpperCase().slice(0, 4),
          scheduled: isLoading ? "Calculating..." : fmtEtaTime(s.scheduled_eta),
          current:   isLoading ? "Calculating..." : fmtEtaTime(s.predicted_eta),
          ai:        isLoading ? "Calculating..." : fmtEtaTime(s.predicted_eta),
          aiLower:   isLoading ? "Calculating..." : fmtEtaTime(s.eta_lower),
          aiUpper:   isLoading ? "Calculating..." : fmtEtaTime(s.eta_upper),
          aiRange:   isLoading ? "Calculating..." : fmtEtaRange(s.eta_lower, s.eta_upper),
          delay: s.predicted_delay,
          confidence: Math.max(70, Math.min(99, 97 - Math.round(s.uncertainty_minutes * 1.5))),
          reason: s.predicted_delay > 10 ? "Cumulative section delay" : s.predicted_delay > 5 ? "Preceding train delay" : "Section congestion",
          platform: "—",
          isLive: true,
        }));
    }
    // Fallback: use per-train static stop data from railData if available,
    // otherwise show the demo stations (which are 12951's stops).
    // This prevents showing 12951's stops when a different train is selected.
    const trainStops = allJourneyStops[trainNumber];
    if (trainStops && trainStops.length > 0) {
      return trainStops
        .filter((s) => s.status === "upcoming" || s.status === "current")
        .map((s) => ({
          station:    s.station,
          stationCode: s.code || s.station.slice(0, 4).toUpperCase(),
          scheduled:  s.sch ?? "—",
          current:    s.ai  ?? "—",
          ai:         s.ai  ?? "—",
          aiLower:    s.lower ?? "",
          aiUpper:    s.upper ?? "",
          aiRange:    fmtEtaRange(s.lower, s.upper),
          delay:      s.delay ?? 0,
          confidence: 85,
          reason:     s.delay ? (s.delay > 10 ? "Cumulative section delay" : "Preceding train delay") : "On schedule",
          platform:   s.platform,
          isLive:     false,
        }));
    }
    // Last resort: only show demo stations if the selected train IS 12951
    if (trainNumber === "12951") {
      return stations.map((s) => ({
        ...s,
        aiRange: fmtEtaRange(s.aiLower, s.aiUpper),
        isLive: false,
      }));
    }
    // No data available for this train
    return [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeData, isLoading, trainNumber]);

  return (
    <Panel
      title="Upcoming Stations"
      kicker={`${trainNumber} · ${trainName}`}
      action={
        isLive
          ? <span className="flex items-center gap-1 text-[9px] text-live font-semibold uppercase"><i className="size-1.5 animate-pulse rounded-full bg-live inline-block" /> Live</span>
          : isLoading
            ? <span className="text-[9px] text-muted-foreground uppercase">Loading…</span>
            : <span className="text-[9px] text-warning uppercase">Demo data</span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Station", "Scheduled", "Current ETA", "AI ETA ± Range", "Platform", "Delay", "Confidence"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No upcoming stations available for this train.
                </td>
              </tr>
            )}
            {rows.map((s) => {
              const isSelected = selectedStation === s.station;
              return (
                <tr
                  key={s.station}
                  onClick={() => setSelectedStation(isSelected ? null : s.station)}
                  className={`cursor-pointer transition-colors hover:bg-accent ${isSelected ? "bg-accent/80 ring-1 ring-inset ring-primary/30" : ""}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.station}</p>
                    <p className="text-[9px] text-muted-foreground">{s.stationCode}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{s.scheduled}</td>
                  <td className="px-4 py-3 font-mono">{s.current}</td>
                  <td className="px-4 py-3">
                    <p className="font-mono font-semibold text-live">{s.ai}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{s.aiRange}</p>
                  </td>
                  <td className="px-4 py-3 font-mono">{s.platform}</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-1 font-mono ${s.delay > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                      {s.delay > 0 ? `+${s.delay} min` : "On time"}
                    </span>
                    <p className="mt-1 text-[9px] text-muted-foreground">↑ {s.reason}</p>
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold ${confColor(s.confidence)}`}>{s.confidence}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* expanded detail row */}
      {(() => {
        const s = selectedStation ? rows.find((r) => r.station === selectedStation) : undefined;
        if (!s) return null;
        return (
          <div className="border-t border-border bg-accent/40 px-4 py-3 text-xs">
            <p className="mb-1 font-semibold text-foreground">{s.station} — Station Detail</p>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
              <span>Scheduled: <b className="text-foreground font-mono">{s.scheduled}</b></span>
              <span>AI ETA: <b className="text-live font-mono">{s.ai}</b></span>
              <span>Delay: <b className={s.delay > 0 ? "text-warning" : "text-success"}>{s.delay > 0 ? `+${s.delay} min` : "On time"}</b></span>
              <span>Range: <b className="text-foreground font-mono">{s.aiRange}</b></span>
              <span>Confidence: <b className={confColor(s.confidence)}>{s.confidence}%</b></span>
              <span>Platform: <b className="text-foreground">{s.platform}</b></span>
            </div>
          </div>
        );
      })()}
      {/* cascade warning */}
      <div className="border-t border-border bg-warning/5 px-4 py-2.5 text-xs">
        ⚠ <b className="text-warning">Cascade effect:</b> Train 12952 (following) predicted to arrive
        <span className="font-semibold text-warning"> +12 min late</span> based on this train's delay propagation.
        Source: <span className="font-mono text-muted-foreground">calculate_route_eta()</span>
      </div>
    </Panel>
  );
}

// ─── Search box ───────────────────────────────────────────────────────────────
function SearchBox({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <div className="border-b border-border p-3">
      <div className="flex items-center gap-2 border border-input bg-background px-3">
        <Search className="size-4 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder="Search train number, name or station…" />
        <Button size="icon" variant="ghost"><ChevronDown /></Button>
      </div>
    </div>
  );
}

// ─── Live trains view ─────────────────────────────────────────────────────────
function LiveTrainsView({ allTrains, onSelect }: {
  allTrains: Train[]; onSelect: (t: Train) => void;
}) {
  const [query,      setQuery]      = useState("");
  const [zone,       setZone]       = useState("All Zones");
  const [trainType,  setTrainType]  = useState("All Types");
  const [delayStatus,setDelayStatus]= useState("All Status");
  const [route,      setRoute]      = useState("All Routes");
  const [confidence, setConfidence] = useState("All Confidence");

  // ── Build dynamic filter options from actual data ──────────────────────────
  const zones       = useMemo(() => ["All Zones",      ...Array.from(new Set(allTrains.map((t) => t.zone).filter(Boolean))).sort()], [allTrains]);
  const trainTypes  = useMemo(() => ["All Types",      ...Array.from(new Set(allTrains.map((t) => t.trainType).filter(Boolean))).sort()], [allTrains]);
  const routes      = useMemo(() => ["All Routes",     ...Array.from(new Set(allTrains.map((t) => `${t.current.split(" ")[0]} → ${t.destination.split(" ")[0]}`).filter(Boolean))).sort()], [allTrains]);

  // ── Delay status helper (consistent thresholds) ───────────────────────────
  function delayCategory(delay: number): string {
    if (delay === 0)   return "On Time";
    if (delay <= 10)   return "Minor Delay";
    if (delay <= 30)   return "Delayed";
    return "Significant Delay";
  }

  // ── Confidence category ────────────────────────────────────────────────────
  function confCategory(c: number): string {
    if (c >= 90) return "High";
    if (c >= 75) return "Medium";
    return "Low";
  }

  // ── Apply all filters ──────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return allTrains.filter((t) => {
      // search: number, name, current, destination, zone
      if (q && !`${t.number} ${t.name} ${t.shortName} ${t.current} ${t.destination} ${t.zone}`.toLowerCase().includes(q)) return false;
      // zone
      if (zone !== "All Zones" && t.zone !== zone) return false;
      // train type
      if (trainType !== "All Types" && t.trainType !== trainType) return false;
      // delay status
      if (delayStatus !== "All Status" && delayCategory(t.delay) !== delayStatus) return false;
      // route — match if origin or destination word appears
      if (route !== "All Routes") {
        const [fromPart, toPart] = route.split(" → ");
        const routeStr = `${t.current} ${t.destination}`.toLowerCase();
        if (!routeStr.includes((fromPart ?? "").toLowerCase()) &&
            !routeStr.includes((toPart  ?? "").toLowerCase())) return false;
      }
      // confidence
      if (confidence !== "All Confidence" && confCategory(t.confidence) !== confidence) return false;
      return true;
    });
  }, [allTrains, query, zone, trainType, delayStatus, route, confidence]);

  const hasActiveFilter = zone !== "All Zones" || trainType !== "All Types" ||
    delayStatus !== "All Status" || route !== "All Routes" || confidence !== "All Confidence";

  function clearFilters() {
    setZone("All Zones");
    setTrainType("All Types");
    setDelayStatus("All Status");
    setRoute("All Routes");
    setConfidence("All Confidence");
  }

  // ── Reusable select ────────────────────────────────────────────────────────
  function FilterSelect({ value, onChange, options }: {
    value: string; onChange: (v: string) => void; options: string[];
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`border px-2 py-1 text-[11px] font-semibold outline-none focus:border-primary bg-background cursor-pointer ${value === options[0] ? "border-input text-muted-foreground" : "border-primary text-primary"}`}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <Panel title="Live Trains" kicker={`${visible.length} of ${allTrains.length} trains shown`}>

      {/* ── Search ── */}
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2 border border-input bg-background px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder="Search train number, name or station…"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <FilterSelect value={zone}        onChange={setZone}        options={zones} />
        <FilterSelect value={trainType}   onChange={setTrainType}   options={trainTypes} />
        <FilterSelect value={delayStatus} onChange={setDelayStatus} options={["All Status", "On Time", "Minor Delay", "Delayed", "Significant Delay"]} />
        <FilterSelect value={route}       onChange={setRoute}       options={routes} />
        <FilterSelect value={confidence}  onChange={setConfidence}  options={["All Confidence", "High", "Medium", "Low"]} />
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="ml-auto text-[11px] font-semibold text-primary hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Results ── */}
      {visible.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No trains match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Train", "Zone / Type", "Current location", "Destination", "Delay", "Scheduled", "AI ETA ± Range", "Confidence", "Status"].map((h) => (
                  <th className="px-4 py-3" key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((t) => (
                <tr key={t.number} onClick={() => onSelect(t)} className="cursor-pointer hover:bg-accent">
                  <td className="px-4 py-4">
                    <b>{t.number}</b>
                    <p className="mt-1 text-[10px] text-muted-foreground">{t.shortName}</p>
                  </td>
                  <td className="px-4">
                    <p>{t.zone}</p>
                    <p className="text-[9px] text-muted-foreground">{t.trainType}</p>
                  </td>
                  <td className="px-4">{t.current}</td>
                  <td className="px-4">{t.destination}</td>
                  <td className={`px-4 font-mono ${t.delay === 0 ? "text-success" : t.delay <= 10 ? "text-warning" : "text-destructive"}`}>
                    {t.delay === 0 ? "On time" : `+${t.delay} min`}
                  </td>
                  <td className="px-4 font-mono">{t.scheduled}</td>
                  <td className="px-4">
                    <p className="font-mono font-bold text-live">
                      {fmtEtaTime(t.aiEta) === "Not available" ? "No prediction" : t.aiEta}
                    </p>
                    {fmtEtaRange(t.aiEtaLower, t.aiEtaUpper) !== "Not available" && (
                      <p className="text-[9px] text-muted-foreground">{fmtEtaRange(t.aiEtaLower, t.aiEtaUpper)}</p>
                    )}
                  </td>
                  <td className={`px-4 font-mono font-semibold ${confColor(t.confidence)}`}>{t.confidence}%</td>
                  <td className="px-4">
                    <span className="flex items-center gap-2 capitalize"><StatusDot status={t.status} />{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── ETA Prediction view ──────────────────────────────────────────────────────
function PredictionView({ selected, setSelected, allTrains, congestion, triggerCongestion, liveEta, refreshEta, etaLoading }: {
  selected: Train; setSelected: (t: Train) => void; allTrains: Train[];
  congestion: boolean; triggerCongestion: () => void;
  liveEta: EtaResponse | null; refreshEta: () => void; etaLoading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const eta12951 = selected.number === "12951" ? liveEta : null;
  const loading12951 = selected.number === "12951" ? etaLoading : false;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allTrains
      .filter((t) =>
        `${t.number} ${t.name} ${t.shortName} ${t.current} ${t.destination}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, allTrains]);

  function pickTrain(t: Train) {
    setSelected(t);
    setSearchQuery("");
    setShowDropdown(false);
  }

  return (
    <div className="space-y-4">

      {/* ── Train search ── */}
      <div className="relative">
        <div className="flex items-center gap-2 border border-input bg-background px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Search train number or name to view its ETA prediction…"
            className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setShowDropdown(false); }} className="text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 w-full border border-border bg-card shadow-lg">
            {searchResults.map((t) => (
              <button
                key={t.number}
                onMouseDown={() => pickTrain(t)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{t.number} · {t.shortName}</p>
                  <p className="text-[10px] text-muted-foreground">{t.current} → {t.destination}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs text-live">{t.aiEta}</p>
                  <p className={`text-[9px] ${t.delay === 0 ? "text-success" : "text-warning"}`}>
                    {t.delay === 0 ? "On time" : `+${t.delay} min`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <PredictionPanel selected={selected} congestion={congestion} liveEta={eta12951} etaLoading={loading12951} />
        <TrainDetail train={selected} congestion={congestion} triggerCongestion={triggerCongestion} liveEta={eta12951} etaLoading={loading12951} />
      </div>
      <Panel title="ETA Prediction Curve" kicker="Scheduled vs Current vs AI across stations">
        <div className="h-[340px] p-4">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="station" stroke="var(--muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} domain={[18, 34]} />
              <ChartTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 0 }} />
              <Legend />
              <Line dataKey="scheduled" name="Scheduled ETA" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} />
              <Line dataKey="current"   name="Current ETA"   stroke="var(--warning)"          strokeWidth={2}   dot={false} />
              <Line dataKey="ai"        name="AI Predicted"  stroke="var(--live)"             strokeWidth={3}   />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Simulated RTIS — visible on ETA Prediction only */}
      <SimulatedRtisPanel refreshEta={refreshEta} />

      <StationTable trainNumber={selected.number} trainName={selected.shortName} />
    </div>
  );
}

// ─── Passenger card (dashboard widget) ───────────────────────────────────────
function PassengerCard({ selected, liveEta, etaLoading = false }: {
  selected: Train; liveEta: EtaResponse | null; etaLoading?: boolean;
}) {
  const isLive = liveEta !== null;

  // For current/next station, prefer live API → then allJourneyStops → then train object
  const trainStops = allJourneyStops[selected.number];
  const currentStop = trainStops?.find((s) => s.status === "current");
  const nextStop    = trainStops?.find((s) => s.status === "upcoming");

  const currentLocation = isLive
    ? (etaLoading ? "Loading…" : liveEta!.current_station)
    : currentStop?.station ?? selected.current;
  const nextStation = isLive
    ? (etaLoading ? "Loading…" : liveEta!.next_station)
    : nextStop?.station ?? selected.next;

  const expectedArrival = isLive
    ? fmtEtaOrState(liveEta!.predicted_eta, etaLoading)
    : currentStop?.ai ?? selected.aiEta;

  const etaRange = etaLoading
    ? "Calculating..."
    : isLive
      ? fmtEtaRange(liveEta!.eta_lower, liveEta!.eta_upper)
      : fmtEtaRange(
          currentStop?.lower ?? selected.aiEtaLower,
          currentStop?.upper ?? selected.aiEtaUpper,
        );

  const delayMin = isLive ? liveEta!.current_delay : (currentStop?.delay ?? selected.delay);
  const uncertainty = isLive ? `±${liveEta!.uncertainty_minutes} min` : "±5 min";
  const isLiveBadge = isLive || selected.delay > 0;

  return (
    <Panel title="Passenger View" kicker={`${selected.number} · ${selected.shortName}`}>
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-2xl font-bold">{selected.number}</p>
            <p className="text-xs text-muted-foreground">{selected.name}</p>
          </div>
          <span className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold ${isLive ? "bg-live/10 text-live" : "bg-success/10 text-success"}`}>
            <StatusDot status={isLiveBadge ? "minor" : "on-time"} />
            {isLive ? "LIVE · M3 AI" : "On Route"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 border-y border-border py-4">
          <Metric label="Current location" value={currentLocation} />
          <Metric label="Next station"     value={nextStation} />
          <Metric label="Expected arrival" value={expectedArrival} accent />
          <Metric label="ETA range"        value={etaRange} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          <b className="text-live">AI prediction:</b>{" "}
          {etaLoading
            ? "Calculating expected arrival time…"
            : delayMin > 0
              ? `Train is running ${delayMin} min late. Expected arrival ${expectedArrival}.`
              : "Train is running on time. Model predicts on-schedule arrival."}
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Confidence: <span className={`font-semibold ${confColor(selected.confidence)}`}>{selected.confidence}%</span>{" "}
          · Uncertainty: <span className="font-semibold text-warning">{uncertainty}</span> (P90 empirical range)
        </p>
      </div>
    </Panel>
  );
}

// ─── Station display board (dashboard widget) ─────────────────────────────────
function StationDisplayBoard() {
  return (
    <Panel title="Station Display Board" kicker="Vadodara Junction · PIDS">
      <div className="bg-zinc-950 p-4 font-mono">
        <div className="mb-3 grid grid-cols-[1.4fr_.6fr_.6fr_.5fr_.4fr] gap-2 text-[9px] uppercase text-zinc-500">
          <span>Train / Destination</span><span>Scheduled</span><span>AI ETA</span><span>PF</span><span>Status</span>
        </div>
        {pidsRows.slice(0, 4).map((r) => {
          const statusColor = r.status === "on-time" ? "text-green-400" : r.status === "minor" ? "text-yellow-400" : r.status === "significant" ? "text-orange-400" : "text-red-400";
          const statusLabel = r.status === "on-time" ? "ON TIME" : `+${r.delay}m DELAY`;
          return (
            <div key={r.number} className="grid grid-cols-[1.4fr_.6fr_.6fr_.5fr_.4fr] items-center gap-2 border-t border-zinc-800 py-3 text-[10px] text-zinc-200">
              <span>
                <b className="text-yellow-400">{r.number} {r.name}</b>
                <small className="block text-zinc-500">{r.nameHi} · TO {r.route.split("→")[1]?.trim()}</small>
              </span>
              <span className="text-zinc-400">{r.scheduled}</span>
              <span className="text-yellow-300 font-bold">{r.aiEta}</span>
              <span>{r.platform}</span>
              <span className={`text-[9px] font-bold ${statusColor}`}>{statusLabel}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Delay analytics view ─────────────────────────────────────────────────────
function AnalyticsView() {
  const dist = [{ n: "0–10", v: 48 }, { n: "10–30", v: 31 }, { n: "30–60", v: 15 }, { n: "60+", v: 6 }];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartPanel title="Delay Distribution (min)" data={dist} dataKey="v" />
      <ChartPanel title="Avg Delay by Railway Zone" data={zones} dataKey="delay" />
      <Panel title="Historical vs AI Predicted Delay" kicker="Rolling 8-hour window" className="lg:col-span-2">
        <div className="h-72 p-4">
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="station" stroke="var(--muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} />
              <ChartTooltip />
              <Legend />
              <Area dataKey="current" name="Current ETA" stroke="var(--warning)" fill="rgba(234,179,8,.1)" />
              <Area dataKey="ai"      name="AI Predicted" stroke="var(--live)"   fill="rgba(59,130,246,.1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <FactorsPanel congestion={false} />
      <Panel title="Top Delay-Causing Sections" kicker="Operational ranking">
        <div className="divide-y divide-border">
          {[["Vadodara → Ratlam", "17", "22", "19"], ["Kota → Mathura", "14", "18", "16"], ["Surat → Bharuch", "11", "14", "12"]].map((r) => (
            <div key={r[0]} className="grid grid-cols-[1fr_repeat(3,auto)] gap-5 p-4 text-xs">
              <b>{r[0]}</b>
              <span className="font-mono text-muted-foreground">H {r[1]}m</span>
              <span className="font-mono text-warning">C {r[2]}m</span>
              <span className="font-mono text-live">AI {r[3]}m</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ChartPanel({ title, data, dataKey }: { title: string; data: Array<{ n?: string; name?: string; [key: string]: string | number | undefined }>; dataKey: string }) {
  const axisKey = data[0]?.n ? "n" : "name";
  return (
    <Panel title={title} kicker="Corridor network data">
      <div className="h-64 p-4">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey={axisKey} stroke="var(--muted-foreground)" fontSize={10} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} />
            <ChartTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            <Bar dataKey={dataKey} fill="var(--live)" radius={[2, 2, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={i % 3 === 0 ? "var(--destructive)" : i % 2 === 0 ? "var(--warning)" : "var(--live)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ─── Network monitor view ─────────────────────────────────────────────────────
function NetworkView({ congestion }: { congestion: boolean }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KpiCard label="Network status"     value="Operational"           change="Stable"  tone="success"  data={[5,5,5,5]} />
        <KpiCard label="Active sections"    value="1,842"                 change="1.1%"               data={[20,22,23,24]} />
        <KpiCard label="Congested sections" value={congestion ? "127" : "126"} change="+3.2%" tone="warning" data={[10,12,11,14]} />
        <KpiCard label="Critical sections"  value={congestion ? "19" : "18"}   change="+5.6%" tone="danger"  data={[3,4,3,5]} />
        <KpiCard label="Avg section delay"  value="14.7m"                 change="-2.1%"   tone="success"  data={[18,17,16,14]} />
      </div>

      <Panel title="Railway Corridor Section Occupancy & Line Capacity" kicker="Real-time line utilisation index">
        <div className="overflow-x-auto p-4">
          <div className="grid min-w-[900px] grid-cols-4 gap-2 xl:grid-cols-6">
            {networkSections.map((s) => {
              const bg = s.cap >= 90 ? "border-destructive/50 bg-destructive/10"
                : s.cap >= 75 ? "border-warning/50 bg-warning/10"
                  : "border-success/30 bg-success/5";
              const textCol = s.cap >= 90 ? "text-destructive" : s.cap >= 75 ? "text-warning" : "text-success";
              return (
                <div key={s.name} className={`border p-2.5 ${bg}`}>
                  <p className="text-[10px] font-bold">{s.name}</p>
                  <p className={`font-mono text-lg font-semibold ${textCol}`}>{s.cap}%<span className="text-[9px] text-muted-foreground"> Cap</span></p>
                  <p className="text-[9px] text-muted-foreground">{s.speed} km/h · MPS {s.mps}</p>
                  <div className="mt-1.5 h-1 bg-muted"><div className={`h-full ${textCol.replace("text-", "bg-")}`} style={{ width: `${s.cap}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-4 border-t border-border p-3 text-[10px]">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-success" /> Optimal (&lt;75%)</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-warning" /> Moderate (75–89%)</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-destructive" /> Heavy (≥90%)</span>
        </div>
      </Panel>
    </>
  );
}

// ─── Model Performance view ───────────────────────────────────────────────────
function ModelView() {
  const maxGain = featureImportance[0]?.gain ?? 1;
  return (
    <>
      {/* Three-tier model comparison */}
      <Panel title="Model Evolution" kicker="Network-awareness impact" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Model Tier", "Features", "MAE", "RMSE", "vs Baseline"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {modelTiers.map((m, i) => (
                <tr key={m.tier} className={i === 2 ? "bg-live/5" : ""}>
                  <td className="px-5 py-3">
                    <p className={`font-semibold ${i === 2 ? "text-live" : ""}`}>{m.tier}</p>
                    <p className="text-[10px] text-muted-foreground">{m.subtitle}</p>
                  </td>
                  <td className="px-5 py-3 font-mono">{m.features}</td>
                  <td className={`px-5 py-3 font-mono font-semibold ${i === 2 ? "text-live" : i === 1 ? "text-success" : "text-destructive"}`}>{m.mae} min</td>
                  <td className={`px-5 py-3 font-mono font-semibold ${i === 2 ? "text-live" : i === 1 ? "text-success" : "text-destructive"}`}>{m.rmse} min</td>
                  <td className="px-5 py-3">
                    {m.improvement
                      ? <span className="rounded border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">{m.improvement}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* KPI cards — correct values */}
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KpiCard label="MAE"              value="4.34 min" change="-0.7"  tone="success" data={[10.08, 8, 6, 4.34]} />
        <KpiCard label="RMSE"             value="5.92 min" change="-1.1"  tone="success" data={[14.16, 10, 7, 5.92]} />
        <KpiCard label="P90 uncertainty"  value="±9.98 min" change="band"              data={[12,11,10.5,9.98]} />
        <KpiCard label="Within ±10 min"   value="90.0%"    change="1.7%"  tone="success" data={[68,75,85,90]} />
        <KpiCard label="Confidence cal."  value="95.8%"    change="2.1%"  tone="success" data={[88,90,93,96]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Feature importance */}
        <Panel title="ML Feature Importance Weights" kicker="Gain score · Network-aware XGBoost v2">
          <div className="space-y-2 p-4">
            {featureImportance.map(({ feature, gain, group }) => {
              const pct = Math.round((gain / maxGain) * 100);
              const color = group === "weather" ? "bg-blue-500" : group === "network" ? "bg-orange-500" : group === "history" ? "bg-purple-500" : "bg-live";
              const tag = group === "weather" ? "WEATHER" : group === "network" ? "NETWORK" : group === "history" ? "HISTORY" : "";
              return (
                <div key={feature}>
                  <div className="mb-1 flex justify-between text-[10px]">
                    <span className="flex items-center gap-2">
                      {feature}
                      {tag && <span className="rounded border border-current px-1 py-0.5 text-[8px] font-bold opacity-60">{tag}</span>}
                    </span>
                    <span className="font-mono text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Actual vs predicted */}
        <Panel title="Actual vs AI Predicted ETA" kicker="Model evaluation — test set">
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="station" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                <ChartTooltip />
                <Legend />
                <Line dataKey="current" name="Actual" stroke="var(--warning)" strokeWidth={2} dot />
                <Line dataKey="ai"      name="AI Predicted" stroke="var(--live)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        Model: Network-aware XGBoost v2 · 29 features · 20,000 training rows · Trained Sep 2026
      </p>
    </>
  );
}

// ─── Alerts view ──────────────────────────────────────────────────────────────
function AlertsView({ alerts }: { alerts: typeof initialAlerts }) {
  return (
    <Panel title="Real-Time Alert Centre" kicker={`${alerts.length} active operational alerts`}>
      <div className="divide-y divide-border">
        {alerts.map((a, i) => (
          <div key={`${a.time}-${i}`} className="grid gap-4 p-4 sm:grid-cols-[80px_1fr_auto]">
            <div><StatusDot status={a.severity} /><p className="mt-2 font-mono text-[10px] text-muted-foreground">{a.time}</p></div>
            <div>
              <p className="text-xs font-semibold">{a.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
              <p className="mt-2 text-[10px] uppercase text-live">Recommended · {a.action}</p>
            </div>
            <div className="font-mono text-sm text-warning">{a.impact}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Architecture / API view ──────────────────────────────────────────────────
// All data comes from the real FastAPI M4 backend — no fake endpoints.
const ACTUAL_ENDPOINTS = [
  {
    method: "GET",
    path: "/health",
    desc: "Backend health check — returns status and API version.",
    example: 'curl http://localhost:8000/health',
  },
  {
    method: "GET",
    path: "/api/trains",
    desc: "List all trains in the database with origin/destination/zone info.",
    example: 'curl http://localhost:8000/api/trains',
  },
  {
    method: "GET",
    path: "/api/trains/{train_id}",
    desc: "Detailed train record including origin and destination station objects.",
    example: 'curl http://localhost:8000/api/trains/12951',
  },
  {
    method: "POST",
    path: "/api/trains/{train_id}/update",
    desc: "Submit a simulated RTIS movement event. Writes to train_movements → updates train_runs → triggers M3 XGBoost → persists ETA prediction.",
    example: 'curl -X POST http://localhost:8000/api/trains/12951/update \\\n  -H "Content-Type: application/json" \\\n  -d \'{"train_id":"12951","latitude":22.307,"longitude":73.181,"speed":104,"timestamp":"2026-09-28T18:00:00+05:30","current_delay_min":18,"current_section":"BRC_SECTION","distance_to_next_station_km":8}\'',
  },
  {
    method: "GET",
    path: "/api/trains/{train_id}/eta",
    desc: "Get the latest AI-predicted ETA for the train's next significant station. Calls M3 → XGBoost and returns scheduled_eta, predicted_eta, eta_lower, eta_upper, uncertainty_minutes.",
    example: 'curl http://localhost:8000/api/trains/12951/eta',
  },
  {
    method: "GET",
    path: "/api/trains/{train_id}/route-eta",
    desc: "Get AI ETA predictions for every remaining stop on today's run. Returns an array of per-station ETA objects with uncertainty bands.",
    example: 'curl http://localhost:8000/api/trains/12951/route-eta',
  },
] as const;

function ArchitectureView() {
  const steps = [
    { label: "Live Train Location (GPS / NTES)", tier: "input" },
    { label: "Operational Data (Speed, Delay, Signal)", tier: "input" },
    { label: "Historical Delay Data (Section-level)", tier: "input" },
    { label: "Network & Weather Conditions", tier: "input" },
    { label: "POST /api/trains/{id}/update  →  PostgreSQL", tier: "api" },
    { label: "Feature Engineering (29 features)", tier: "ml" },
    { label: "Network-aware XGBoost v2 (M3 Engine)", tier: "ml" },
    { label: "GET /api/trains/{id}/eta  →  Uncertainty Band", tier: "api" },
    { label: "React Frontend · Passenger · Station PIDS", tier: "output" },
  ];

  // ── Live health check ────────────────────────────────────────────────────
  const [health, setHealth] = useState<{ status: string; version: string } | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function checkHealth() {
    setHealthLoading(true);
    setHealthErr(null);
    try {
      const data = await api.health();
      setHealth(data);
    } catch (e) {
      setHealthErr(String(e));
    } finally {
      setHealthLoading(false);
    }
  }

  // ── Live train list ──────────────────────────────────────────────────────
  const [trainList, setTrainList] = useState<import("@/lib/api").ApiTrain[] | null>(null);
  const [trainListErr, setTrainListErr] = useState<string | null>(null);
  const [trainListLoading, setTrainListLoading] = useState(false);

  async function fetchTrains() {
    setTrainListLoading(true);
    setTrainListErr(null);
    try {
      const data = await api.listTrains();
      setTrainList(data);
    } catch (e) {
      setTrainListErr(String(e));
    } finally {
      setTrainListLoading(false);
    }
  }

  // ── Live ETA demo (train 12951) ──────────────────────────────────────────
  const [etaResult, setEtaResult] = useState<import("@/lib/api").EtaResponse | null>(null);
  const [etaErr, setEtaErr] = useState<string | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);

  async function fetchEta() {
    setEtaLoading(true);
    setEtaErr(null);
    try {
      const data = await api.getEta("12951");
      setEtaResult(data);
    } catch (e) {
      setEtaErr(String(e));
    } finally {
      setEtaLoading(false);
    }
  }

  // ── Live POST update + ETA refresh demo ─────────────────────────────────
  const [updateSpeed, setUpdateSpeed] = useState(104);
  const [updateDelay, setUpdateDelay] = useState(18);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  async function sendUpdate() {
    setUpdateLoading(true);
    setUpdateResult(null);
    setEtaErr(null);
    try {
      const res = await api.postMovementUpdate("12951", {
        train_id: "12951",
        latitude: 22.307,
        longitude: 73.181,
        speed: updateSpeed,
        timestamp: new Date().toISOString(),
        current_delay_min: updateDelay,
        current_section: "BRC_SECTION",
        distance_to_next_station_km: 8,
      });
      setUpdateResult(`✓ movement_id=${res.movement_id} recorded. Fetching fresh ETA…`);
      await new Promise((r) => setTimeout(r, 400));
      await fetchEta();
      toast.success("Movement posted + ETA refreshed", {
        description: `movement_id=${res.movement_id} · delay=${updateDelay} min · speed=${updateSpeed} km/h`,
      });
    } catch (e) {
      setUpdateResult(`Error: ${String(e)}`);
      toast.error("Update failed", { description: String(e) });
    } finally {
      setUpdateLoading(false);
    }
  }

  // ── Expanded endpoint state ──────────────────────────────────────────────
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  const tierStyle = (tier: string) => {
    if (tier === "api")    return "border-primary/60 bg-primary/5 text-primary";
    if (tier === "ml")     return "border-live/60 bg-live/10 text-live";
    if (tier === "output") return "border-success/60 bg-success/10 text-success";
    return "border-border bg-card text-foreground";
  };

  return (
    <div className="space-y-4">

      {/* ── Top row: pipeline + health + model ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_.9fr]">

        {/* Pipeline */}
        <Panel title="System Architecture" kicker="React → FastAPI M4 → PostgreSQL → M3 XGBoost">
          <div className="p-5">
            {steps.map((s, i) => (
              <div key={s.label} className="flex flex-col items-center">
                <div className={`w-full border px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${tierStyle(s.tier)}`}>
                  {s.label}
                </div>
                {i < steps.length - 1 && <div className="h-4 w-px bg-primary/40" />}
              </div>
            ))}
            <div className="mt-4 flex flex-wrap gap-2 text-[9px]">
              {[
                { color: "bg-border", label: "Data input" },
                { color: "bg-primary/60", label: "API layer" },
                { color: "bg-live/60", label: "ML engine (M3)" },
                { color: "bg-success/60", label: "Output" },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-muted-foreground">
                  <i className={`inline-block size-2 rounded-sm ${color}`} />{label}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          {/* Health check */}
          <Panel title="GET /health" kicker="Backend health check">
            <div className="p-4">
              <p className="mb-3 text-[10px] text-muted-foreground">
                Verifies the FastAPI backend is reachable and returns its version.
              </p>
              <Button size="sm" onClick={checkHealth} disabled={healthLoading} className="gap-1.5">
                <Cpu className={healthLoading ? "animate-spin" : ""} />
                {healthLoading ? "Checking…" : "Run Health Check"}
              </Button>
              {health && (
                <pre className="mt-3 rounded bg-muted p-3 text-[10px] leading-relaxed text-success">
{JSON.stringify(health, null, 2)}
                </pre>
              )}
              {healthErr && (
                <p className="mt-2 text-[10px] text-destructive">{healthErr}</p>
              )}
            </div>
          </Panel>

          {/* ML Model info — static, sourced from M3 training artifacts */}
          <Panel title="ML Model (M3 Engine)" kicker="Network-aware XGBoost — trained artifacts">
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                <span className="text-xs font-bold text-success">ONLINE — artifacts loaded</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                {([
                  ["Model",         "Network-aware XGBoost v2"],
                  ["Features",      "29"],
                  ["Training rows", "20,000"],
                  ["MAE",           "4.34 min"],
                  ["RMSE",          "5.92 min"],
                  ["P90 band",      "±9.98 min"],
                  ["vs Baseline",   "+57% improvement"],
                  ["Artifact",      "network_xgb_model.pkl"],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-muted-foreground">{k}</p>
                    <p className={`font-mono font-semibold ${k === "vs Baseline" ? "text-success" : k === "MAE" || k === "RMSE" ? "text-live" : ""}`}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Endpoint reference (real endpoints only) ── */}
      <Panel title="M4 FastAPI — REST Endpoints" kicker="All 6 real endpoints · click to expand">
        <div className="divide-y divide-border">
          {ACTUAL_ENDPOINTS.map((ep) => {
            const isOpen = expandedPath === ep.path;
            return (
              <div key={ep.path}>
                <button
                  onClick={() => setExpandedPath(isOpen ? null : ep.path)}
                  className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-accent"
                >
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${ep.method === "GET" ? "bg-success/10 text-success" : "bg-live/10 text-live"}`}>
                    {ep.method}
                  </span>
                  <div className="min-w-0 flex-1">
                    <code className="font-mono text-[11px] text-foreground">{ep.path}</code>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{ep.desc}</p>
                  </div>
                  <ChevronDown className={`mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-muted/40 px-4 py-3">
                    <p className="mb-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">Example</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 text-[9px] leading-relaxed text-foreground">
{ep.example}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ── Live demos ── */}
      <div className="grid gap-4 xl:grid-cols-2">

        {/* GET /api/trains live */}
        <Panel title="GET /api/trains" kicker="Live — fetches from PostgreSQL via FastAPI">
          <div className="p-4">
            <p className="mb-3 text-[10px] text-muted-foreground">
              Returns the list of all trains registered in the database.
            </p>
            <Button size="sm" onClick={fetchTrains} disabled={trainListLoading} className="gap-1.5">
              <Cpu className={trainListLoading ? "animate-spin" : ""} />
              {trainListLoading ? "Fetching…" : "Fetch Train List"}
            </Button>
            {trainListErr && <p className="mt-2 text-[10px] text-destructive">{trainListErr}</p>}
            {trainList && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded border border-border">
                <table className="w-full text-[10px]">
                  <thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trainList.map((t) => (
                      <tr key={t.id} className="hover:bg-accent/50">
                        <td className="px-3 py-2 font-mono font-semibold">{t.number}</td>
                        <td className="px-3 py-2">{t.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{t.train_type ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        {/* GET /api/trains/12951/eta live */}
        <Panel title="GET /api/trains/12951/eta" kicker="Live M3 XGBoost prediction — Train 12951">
          <div className="p-4">
            <p className="mb-3 text-[10px] text-muted-foreground">
              Triggers the M3 engine: builds ETAInput from PostgreSQL → XGBoost inference → persists EtaPrediction → returns JSON.
            </p>
            <Button size="sm" onClick={fetchEta} disabled={etaLoading} className="gap-1.5">
              <Cpu className={etaLoading ? "animate-spin" : ""} />
              {etaLoading ? "Calling M3…" : "Fetch Live ETA"}
            </Button>
            {etaErr && <p className="mt-2 text-[10px] text-destructive">{etaErr}</p>}
            {etaResult && (
              <div className="mt-3 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  {([
                    ["Current station",   etaResult.current_station],
                    ["Next station",      etaResult.next_station],
                    ["Current delay",     `${etaResult.current_delay} min`],
                    ["Speed",             `${etaResult.current_speed} km/h`],
                    ["Scheduled ETA",     fmtEtaOrState(etaResult.scheduled_eta, false)],
                    ["AI Predicted ETA",  fmtEtaOrState(etaResult.predicted_eta, false)],
                    ["ETA lower",         fmtEtaOrState(etaResult.eta_lower, false)],
                    ["ETA upper",         fmtEtaOrState(etaResult.eta_upper, false)],
                    ["Uncertainty",       `±${etaResult.uncertainty_minutes} min`],
                    ["Predicted delay",   `+${etaResult.predicted_delay} min`],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="rounded bg-muted/40 px-2 py-1">
                      <p className="text-[9px] text-muted-foreground">{k}</p>
                      <p className={`font-mono font-semibold ${k === "AI Predicted ETA" ? "text-live" : k === "Uncertainty" ? "text-warning" : ""}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Last updated: {new Date(etaResult.last_updated).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── POST update → ETA refresh demo ── */}
      <Panel
        title="POST /api/trains/12951/update  →  GET /api/trains/12951/eta"
        kicker="Full pipeline demo — RTIS movement → PostgreSQL → M3 → ETA response"
      >
        <div className="p-4">
          <p className="mb-4 text-[10px] text-muted-foreground">
            Post a simulated RTIS position event for Train 12951. The backend writes to{" "}
            <code className="text-foreground">train_movements</code>, refreshes{" "}
            <code className="text-foreground">train_runs</code>, calls{" "}
            <code className="text-foreground">M3 ETAService.calculate_eta()</code>,
            persists the result to <code className="text-foreground">eta_predictions</code>,
            then immediately fetches the new ETA and renders it below.
          </p>
          <div className="mb-4 flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Speed (km/h)</span>
              <input
                type="number" min={0} max={160} step={5}
                value={updateSpeed}
                onChange={(e) => setUpdateSpeed(Number(e.target.value))}
                className="w-28 border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Delay (min)</span>
              <input
                type="number" min={0} max={120} step={1}
                value={updateDelay}
                onChange={(e) => setUpdateDelay(Number(e.target.value))}
                className="w-28 border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
              />
            </label>
          </div>
          <Button onClick={sendUpdate} disabled={updateLoading} className="gap-2">
            <Cpu className={updateLoading ? "animate-spin" : ""} />
            {updateLoading ? "Posting…" : "POST Movement → Refresh ETA"}
          </Button>
          {updateResult && (
            <p className={`mt-2 text-[10px] ${updateResult.startsWith("Error") ? "text-destructive" : "text-success"}`}>
              {updateResult}
            </p>
          )}
          {etaResult && !updateLoading && (
            <div className="mt-4 rounded border border-live/30 bg-live/5 p-3">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-live">
                Live ETA response from M3 engine
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] sm:grid-cols-3">
                {([
                  ["Current station",  etaResult.current_station],
                  ["Next station",     etaResult.next_station],
                  ["Scheduled ETA",    fmtEtaOrState(etaResult.scheduled_eta, false)],
                  ["AI ETA",           fmtEtaOrState(etaResult.predicted_eta, false)],
                  ["Range",            fmtEtaRange(etaResult.eta_lower, etaResult.eta_upper)],
                  ["Predicted delay",  `+${etaResult.predicted_delay} min`],
                  ["Uncertainty",      `±${etaResult.uncertainty_minutes} min`],
                  ["Speed",            `${etaResult.current_speed} km/h`],
                  ["Delay in",         `${etaResult.current_delay} min`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-muted-foreground">{k}</p>
                    <p className={`font-mono font-semibold ${k === "AI ETA" ? "text-live" : k === "Uncertainty" ? "text-warning" : ""}`}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ─── Station PIDS full view ───────────────────────────────────────────────────
function StationPIDSView() {
  const [station, setStation] = useState("VADODARA (BRC)");
  const [chimeOn, setChimeOn] = useState(true);
  const stations_list = ["VADODARA (BRC)", "NEW DELHI (NDLS)", "MUMBAI CENTRAL (BCT)", "SURAT (ST)", "KOTA (KOTA)", "RATLAM (RTM)"];

  // Extract the station code from the display name, e.g. "KOTA (KOTA)" → "KOTA"
  const selectedCode = station.match(/\(([^)]+)\)/)?.[1] ?? "";

  // Filter pidsRows to only trains that call at the selected station
  const filteredRows = pidsRows.filter((r) => {
    const stops: string[] | undefined = (r as { stations?: string[] }).stations;
    return !stops || stops.includes(selectedCode);
  });

  function announceText(r: typeof pidsRows[0]) {
    const statusPart = r.delay > 0 ? `approximately ${r.delay} minutes behind schedule` : "on time";
    return `Attention passengers. Train number ${r.number}, ${r.name}, arriving at Platform ${r.platform}. Expected arrival ${r.aiEta}. Train is running ${statusPart}.`;
  }

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Select Station Display:</span>
          <select
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="border border-input bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          >
            {stations_list.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST
          </span>
          <Button size="sm" variant={chimeOn ? "default" : "outline"} onClick={() => setChimeOn((v) => !v)} className="gap-1.5">
            🔔 Station Chime {chimeOn ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      {/* PIDS header */}
      <div className="flex items-center justify-between border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wide">{station}</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-live">
          <span className="size-2 animate-pulse rounded-full bg-live" />
          PASSENGER INFORMATION DISPLAY SYSTEM · LIVE
        </div>
      </div>

      {/* PIDS table */}
      <div className="border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Train No", "Train Name / गाड़ी का नाम", "Route", "Scheduled", "AI Dynamic ETA", "Conf", "Platform", "Status", "Broadcast"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No trains scheduled at {station}.
                  </td>
                </tr>
              ) : filteredRows.map((r) => {
                const statusColor = r.status === "on-time" ? "bg-success/10 text-success border-success/30"
                  : r.status === "minor" ? "bg-warning/10 text-warning border-warning/30"
                  : r.status === "significant" ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                  : "bg-destructive/10 text-destructive border-destructive/30";
                const statusLabel = r.status === "on-time" ? "ON TIME · समय पर"
                  : r.status === "minor" ? `+${r.delay}m · थोड़ा विलंब`
                  : r.status === "significant" ? `+${r.delay}m · विलंबित`
                  : `+${r.delay}m · अत्यंत विलंब`;
                const confOk = r.confidence >= 90;

                return (
                  <tr key={r.number} className="hover:bg-accent">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{r.number}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.nameHi}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.route}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{r.scheduled}</td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-base font-bold text-yellow-400">{r.aiEta}</p>
                      {r.delay > 0 && (
                        <p className="text-[9px] text-muted-foreground">±5 min range</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${confOk ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}>
                        {r.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">{r.platform}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded border px-2 py-1 text-[9px] font-bold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={confOk ? "default" : "outline"}
                        className={`gap-1 text-[10px] ${!confOk ? "border-warning/30 text-warning" : ""}`}
                        title={confOk ? "Safe to announce" : `Confidence ${r.confidence}% — wait for update`}
                        onClick={() => {
                          if (chimeOn) {
                            // In production: play chime audio then TTS
                          }
                          alert(`Announcement: ${announceText(r)}`);
                        }}
                      >
                        {confOk ? "🔊 Announce" : "⏳ Hold"}
                      </Button>
                      {!confOk && (
                        <p className="mt-0.5 text-[8px] text-warning">Low conf — wait</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* cascade warning */}
        <div className="border-t border-border bg-warning/5 px-4 py-2.5 text-xs">
          ⚠ <b className="text-warning">Platform conflict risk:</b> Trains 12951 and 12952 both predicted for arrival within 6 min.
          Review platform assignment before announcing.
          &nbsp;|&nbsp;
          <b className="text-warning">Cascade:</b> Train 19037 (+76 min) — downstream trains may be affected.
        </div>
      </div>

      {/* Announcement preview panel */}
      <Panel title="Announcement Preview" kicker="Auto-generated from AI ETA">
        <div className="p-4">
          <div className="rounded border border-border bg-muted/30 p-4">
            <p className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">English</p>
            <p className="text-sm leading-relaxed text-foreground">"{pidsRows[0] ? announceText(pidsRows[0]) : ""}"</p>
          </div>
          <div className="mt-3 rounded border border-border bg-muted/30 p-4">
            <p className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">Hindi · हिंदी</p>
            <p className="text-sm leading-relaxed text-foreground">
              {pidsRows[0] ? `"यात्रियों का ध्यान। गाड़ी संख्या ${pidsRows[0].number}, ${pidsRows[0].nameHi}, प्लेटफ़ॉर्म ${pidsRows[0].platform} पर आ रही है। अपेक्षित आगमन ${pidsRows[0].aiEta}। गाड़ी ${pidsRows[0].delay > 0 ? `${pidsRows[0].delay} मिनट विलंब से` : "समय पर"} चल रही है।"` : ""}
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline">🔊 Play English</Button>
            <Button size="sm" variant="outline">🔊 हिंदी सुनें</Button>
            <Button size="sm" variant="default">📢 Broadcast Live</Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
