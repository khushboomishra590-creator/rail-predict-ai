import { useEffect, useMemo, useState } from "react";
import { useTrainEta } from "@/hooks/use-train-eta";
import { useTrainList } from "@/hooks/use-train-list";
import { useRouteEta } from "@/hooks/use-route-eta";
import { api, fmtEtaTime, type EtaResponse, type RouteEtaResponse } from "@/lib/api";
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
                Dynamic ETA Intelligence · SIH-26028
              </small>
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* live clock */}
            <span className="hidden font-mono text-[11px] text-foreground lg:block">
              {String(11 + Math.floor((tick * 3) / 3600) % 12).padStart(2, "0")}:
              {String((14 + Math.floor((tick * 3) / 60)) % 60).padStart(2, "0")}:
              {String((tick * 3) % 60).padStart(2, "0")} IST
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell /><i className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
            </Button>
            <CircleUserRound className="hidden size-6 text-muted-foreground sm:block" />
          </div>
        </div>

        {/* simulation bar */}
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

          {view === "Dashboard"        && <DashboardView selected={liveSelected} setSelected={setSelected} tick={tick} congestion={congestion} triggerCongestion={triggerCongestion} query={query} setQuery={setQuery} filtered={filtered} liveEta={liveEta} refreshEta={refreshEta} allTrains={sourceTrains} />}
          {view === "Live Trains"      && <LiveTrainsView query={query} setQuery={setQuery} filtered={filtered} onSelect={(t) => { setSelected(t); setView("Dashboard"); }} />}
          {view === "ETA Prediction"   && <PredictionView selected={liveSelected} congestion={congestion} triggerCongestion={triggerCongestion} />}
          {view === "Passenger Tracker"&& <PassengerTrackerView />}
          {view === "Station PIDS"     && <StationPIDSView />}
          {view === "Scenario Sandbox" && <ScenarioSandboxView activeScenarios={activeScenarios} onInject={injectScenario} onClear={clearScenarios} alerts={alerts} />}
          {view === "Network Monitor"  && <NetworkView congestion={congestion} />}
          {view === "Delay Analytics"  && <AnalyticsView />}
          {view === "Model Performance"&& <ModelView />}
          {view === "Alerts"           && <AlertsView alerts={alerts} />}
          {view === "API / Integration"&& <ArchitectureView />}

          <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-border py-5 text-[10px] uppercase tracking-wider text-muted-foreground sm:flex-row">
            <span>RailPredict AI · SIH-26028</span>
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
function DashboardView({ selected, setSelected, tick, congestion, triggerCongestion, query, setQuery, filtered, liveEta, refreshEta, allTrains }: {
  selected: Train; setSelected: (t: Train) => void; tick: number; congestion: boolean;
  triggerCongestion: () => void; query: string; setQuery: (v: string) => void; filtered: Train[];
  liveEta: EtaResponse | null; refreshEta: () => void; allTrains: Train[];
}) {
  const spark = (n: number) => Array.from({ length: 8 }, (_, i) => n + Math.sin(i + tick) * n * 0.05);
  const eta12951 = selected.number === "12951" ? liveEta : null;
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
        <TrainDetail train={selected} congestion={congestion} triggerCongestion={triggerCongestion} liveEta={eta12951} />
      </div>

      {/* Capability strip */}
      <CapabilityStrip />

      {/* Prediction + Factors */}
      <div className="my-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <PredictionPanel selected={selected} congestion={congestion} liveEta={eta12951} />
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
                  <p className="font-mono text-xs text-live">AI {t.aiEta}</p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">{t.aiEtaLower}–{t.aiEtaUpper}</p>
                  <p className={`mt-1 text-[9px] ${confColor(t.confidence)}`}>{t.confidence}% CONF.</p>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* Bottom widgets */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <PassengerCard selected={selected} />
        <StationDisplayBoard />
      </div>
    </>
  );
}

// ─── Train detail panel ───────────────────────────────────────────────────────
function TrainDetail({ train, congestion, triggerCongestion, liveEta }: { train: Train; congestion: boolean; triggerCongestion: () => void; liveEta: EtaResponse | null }) {
  return (
    <Panel title={`${train.number} · ${train.shortName}`} kicker="Selected train" action={<StatusDot status={train.status} />} className="h-full">
      <div className="p-4">
        {/* header */}
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <div className="flex size-10 items-center justify-center bg-primary/10 text-primary"><TrainFront /></div>
          <div>
            <p className="text-sm font-semibold">{liveEta ? liveEta.current_station : train.current}</p>
            <p className="text-[10px] text-muted-foreground">Next · {liveEta ? liveEta.next_station : train.next}</p>
            <p className="text-[9px] text-muted-foreground">{train.zone} · {train.trainType} · MPS {train.mps} km/h</p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-lg font-semibold">{liveEta ? liveEta.current_speed : train.speed} <span className="text-[10px] text-muted-foreground">km/h</span></p>
            <p className="text-[9px] uppercase text-live">Movement verified</p>
          </div>
        </div>

        {/* metrics grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Metric label="Current delay"      value={liveEta ? `+${liveEta.current_delay} min` : `+${train.delay} min`} />
          <Metric label="Scheduled ETA"      value={liveEta ? fmtEtaTime(liveEta.scheduled_eta) : train.scheduled} />
          <Metric label="Current ETA"        value={liveEta ? fmtEtaTime(liveEta.predicted_eta) : train.currentEta} />
          <Metric label="AI Predicted ETA"   value={liveEta ? fmtEtaTime(liveEta.predicted_eta) : train.aiEta} accent />
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
          <p className="mt-1 font-mono text-sm">{liveEta ? `${fmtEtaTime(liveEta.eta_lower)} - ${fmtEtaTime(liveEta.eta_upper)}` : `${train.aiEtaLower} - ${train.aiEtaUpper}`}</p>
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">{liveEta ? fmtEtaTime(liveEta.eta_lower) : train.aiEtaLower}</span>
            <div className="relative h-1.5 flex-1 rounded bg-muted">
              <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-live bg-background" />
              <div className="h-full w-1/2 rounded bg-live/40" />
            </div>
            <span className="text-[9px] text-muted-foreground">{liveEta ? fmtEtaTime(liveEta.eta_upper) : train.aiEtaUpper}</span>
          </div>
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
function PredictionPanel({ selected, congestion, liveEta }: { selected: Train; congestion: boolean; liveEta: EtaResponse | null }) {
  const aiEta = liveEta ? fmtEtaTime(liveEta.predicted_eta) : (congestion && selected.number === "12951" ? "22:01" : selected.aiEta);
  const improvement = liveEta ? `${liveEta.delay_adjustment > 0 ? "+" : ""}${liveEta.delay_adjustment} min vs schedule` : (congestion ? "-1 min" : "-7 min");
  return (
    <Panel title="AI ETA Prediction" kicker="Dynamic comparison"
      action={<span className={`font-mono text-xs ${confColor(selected.confidence)}`}>CONF {selected.confidence}%</span>}>
      <div className="grid border-b border-border sm:grid-cols-3">
        <div className="p-4"><Metric label="Scheduled ETA" value={liveEta ? fmtEtaTime(liveEta.scheduled_eta) : "18:40"} /></div>
        <div className="border-y border-border p-4 sm:border-x sm:border-y-0"><Metric label="Current Railway ETA" value={liveEta ? fmtEtaTime(liveEta.scheduled_eta) : "18:56"} /></div>
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
          <span>Scheduled {liveEta ? fmtEtaTime(liveEta.scheduled_eta) : "18:40"}</span><span>Current {liveEta ? fmtEtaTime(liveEta.scheduled_eta) : "18:56"}</span>
          <span className="text-live">AI {aiEta}</span>
        </div>
        {/* range bar */}
        <div className="mt-3 flex items-center gap-2 rounded border border-live/20 bg-live/5 px-3 py-2">
          <span className="text-[9px] text-muted-foreground">{liveEta ? fmtEtaTime(liveEta.eta_lower) : selected.aiEtaLower}</span>
          <div className="relative h-1 flex-1 rounded bg-muted">
            <div className="absolute inset-0 rounded bg-live/30" />
            <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-live bg-background" />
          </div>
          <span className="text-[9px] text-muted-foreground">{liveEta ? fmtEtaTime(liveEta.eta_upper) : selected.aiEtaUpper}</span>
          <span className={`ml-1 text-[10px] font-semibold ${confColor(selected.confidence)}`}>{liveEta ? `±${liveEta.uncertainty_minutes} min` : "±5 min"}</span>
        </div>
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

  // Build rows: live API data when available, demo fallback otherwise
  const rows = useMemo(() => {
    if (routeData && routeData.stations.length > 0) {
      return routeData.stations.map((s) => ({
          station: s.next_station,
          stationCode: (s.next_station.split(" ")[0] ?? s.next_station).toUpperCase().slice(0, 4),
          scheduled: fmtEtaTime(s.scheduled_eta),
          current: fmtEtaTime(s.predicted_eta),
          ai: fmtEtaTime(s.predicted_eta),
          aiLower: fmtEtaTime(s.eta_lower),
          aiUpper: fmtEtaTime(s.eta_upper),
          delay: s.predicted_delay,
          confidence: Math.max(70, Math.min(99, 97 - Math.round(s.uncertainty_minutes * 1.5))),
          reason: s.predicted_delay > 10 ? "Cumulative section delay" : s.predicted_delay > 5 ? "Preceding train delay" : "Section congestion",
          platform: "—",
          isLive: true,
        }));
    }
    // fallback to demo data
    return stations.map((s) => ({ ...s, isLive: false }));
  }, [routeData]);

  const isLive = state.status === "ok";
  const isLoading = state.status === "loading" || state.status === "idle";

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
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{s.aiLower} – {s.aiUpper}</p>
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
              <span>Range: <b className="text-foreground font-mono">{s.aiLower} – {s.aiUpper}</b></span>
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
function LiveTrainsView({ query, setQuery, filtered, onSelect }: {
  query: string; setQuery: (v: string) => void; filtered: Train[]; onSelect: (t: Train) => void;
}) {
  return (
    <Panel title="Live Train Search" kicker="1,248 active movements">
      <SearchBox query={query} setQuery={setQuery} />
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        {["Zone", "Train Type", "Delay Status", "Route", "Prediction Confidence"].map((f) => (
          <Button key={f} variant="outline" size="sm">{f}<ChevronDown /></Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-left text-xs">
          <thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground">
            <tr>{["Train", "Zone / Type", "Current location", "Destination", "Delay", "Scheduled", "AI ETA ± Range", "Confidence", "Status"].map((h) => (
              <th className="px-4 py-3" key={h}>{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => (
              <tr key={t.number} onClick={() => onSelect(t)} className="cursor-pointer hover:bg-accent">
                <td className="px-4 py-4"><b>{t.number}</b><p className="mt-1 text-[10px] text-muted-foreground">{t.shortName}</p></td>
                <td className="px-4"><p>{t.zone}</p><p className="text-[9px] text-muted-foreground">{t.trainType}</p></td>
                <td className="px-4">{t.current}</td>
                <td className="px-4">{t.destination}</td>
                <td className="px-4 font-mono text-warning">+{t.delay} min</td>
                <td className="px-4 font-mono">{t.scheduled}</td>
                <td className="px-4">
                  <p className="font-mono font-bold text-live">{t.aiEta}</p>
                  <p className="text-[9px] text-muted-foreground">{t.aiEtaLower}–{t.aiEtaUpper}</p>
                </td>
                <td className={`px-4 font-mono font-semibold ${confColor(t.confidence)}`}>{t.confidence}%</td>
                <td className="px-4"><span className="flex items-center gap-2 capitalize"><StatusDot status={t.status} />{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─── ETA Prediction view ──────────────────────────────────────────────────────
function PredictionView({ selected, congestion, triggerCongestion }: { selected: Train; congestion: boolean; triggerCongestion: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <PredictionPanel selected={selected} congestion={congestion} liveEta={null} />
        <TrainDetail train={selected} congestion={congestion} triggerCongestion={triggerCongestion} liveEta={null} />
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
      <StationTable trainNumber={selected.number} trainName={selected.shortName} />
    </div>
  );
}

// ─── Passenger card (dashboard widget) ───────────────────────────────────────
function PassengerCard({ selected }: { selected: Train }) {
  return (
    <Panel title="Passenger View" kicker="Live prediction for travellers">
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-2xl font-bold">{selected.number}</p>
            <p className="text-xs text-muted-foreground">{selected.name}</p>
          </div>
          <span className="flex items-center gap-1.5 bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
            <StatusDot status="on-time" /> On Route
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 border-y border-border py-4">
          <Metric label="Current location" value={selected.current} />
          <Metric label="Next station"     value={selected.next} />
          <Metric label="Expected arrival" value={selected.aiEta} accent />
          <Metric label="ETA range"        value={`${selected.aiEtaLower} – ${selected.aiEtaUpper}`} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          <b className="text-live">AI prediction:</b> {selected.delay > 0 ? `Train is running ${selected.delay} min late. Model predicts partial recovery — expected arrival ${selected.aiEta}.` : "Train is running on time. Model predicts on-schedule arrival."}
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Confidence: <span className={`font-semibold ${confColor(selected.confidence)}`}>{selected.confidence}%</span> · Uncertainty: ±5 min (P90 empirical range)
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
function ArchitectureView() {
  const steps = [
    "Live Train Location (GPS / NTES)",
    "Operational Data (Speed, Delay, Signal)",
    "Historical Delay Data (Section-level)",
    "Network & Weather Conditions",
    "Data Processing (Pandas / NumPy)",
    "Feature Engineering (29 features)",
    "Network-aware XGBoost v2 Model",
    "Dynamic ETA + Uncertainty Band",
    "Passenger · Station PIDS · Control Room",
  ];
  const apis = [
    { method: "POST", path: "/api/predict",         desc: "Predict next-station delay — returns predicted_delay (float, minutes)" },
    { method: "POST", path: "/api/predict/range",   desc: "Prediction with uncertainty — returns predicted_delay, lower_bound, upper_bound, uncertainty (P90)" },
    { method: "POST", path: "/api/predict/explain", desc: "Local explanation — returns top contributing features with plain-text descriptions" },
    { method: "GET",  path: "/api/model/status",    desc: "Model health — version, MAE, RMSE, feature count, training date" },
    { method: "GET",  path: "/api/trains",          desc: "All live trains with dynamic ETA and confidence bands" },
    { method: "GET",  path: "/api/stations/:code/pids", desc: "Station PIDS feed — arrivals with AI ETA and announcement text" },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_.85fr]">
      <Panel title="How RailPredict AI Works" kicker="Continuous prediction pipeline">
        <div className="p-5">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-col items-center">
              <div className={`w-full border p-3 text-center text-xs font-semibold uppercase tracking-wider ${i === 7 ? "border-live bg-live/10 text-live" : i === 6 ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>{s}</div>
              {i < steps.length - 1 && <div className="h-5 w-px animate-pulse bg-primary" />}
            </div>
          ))}
        </div>
      </Panel>

      <div className="space-y-4">
        {/* ML Model Status */}
        <Panel title="ML Model Status" kicker="Live prediction engine">
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-2 relative"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-success" /></span>
              <span className="text-xs font-bold text-success">ONLINE — Model active</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                ["Model",         "Network-aware XGBoost v2"],
                ["Features",      "29"],
                ["Training rows", "20,000"],
                ["MAE",           "4.34 min"],
                ["RMSE",          "5.92 min"],
                ["P90 band",      "±9.98 min"],
                ["vs Baseline",   "+57% improvement"],
                ["Trained",       "September 2026"],
                ["Model size",    "1,872 KB"],
                ["Status",        "Trained: YES"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted-foreground">{k}</p>
                  <p className={`font-mono font-semibold ${k === "vs Baseline" ? "text-success" : k === "MAE" || k === "RMSE" ? "text-live" : ""}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* API endpoints */}
        <Panel title="Indian Railways Dynamic ETA API" kicker="REST endpoints · FastAPI backend">
          <div className="divide-y divide-border">
            {apis.map((a) => (
              <div key={a.path} className="p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${a.method === "GET" ? "bg-success/10 text-success" : "bg-live/10 text-live"}`}>{a.method}</span>
                  <code className="font-mono text-[11px] text-foreground">{a.path}</code>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{a.desc}</p>
                <code className="mt-1.5 block rounded bg-muted px-2 py-1 text-[9px] text-muted-foreground">
                  curl -X {a.method} http://localhost:8000{a.path}
                </code>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Station PIDS full view ───────────────────────────────────────────────────
function StationPIDSView() {
  const [station, setStation] = useState("VADODARA (BRC)");
  const [chimeOn, setChimeOn] = useState(true);
  const stations_list = ["VADODARA (BRC)", "NEW DELHI (NDLS)", "MUMBAI CENTRAL (BCT)", "SURAT (ST)", "KOTA (KOTA)", "RATLAM (RTM)"];

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
              {pidsRows.map((r) => {
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
