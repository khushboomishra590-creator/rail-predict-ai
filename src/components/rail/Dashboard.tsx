import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, BrainCircuit, ChevronDown, CircleUserRound, Moon, Pause, Play, RotateCcw, Search, Sparkles, Sun, TrainFront, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { DemoBadge, KpiCard, Metric, Panel, StatusDot } from "./Primitives";
import { TrainMap } from "./TrainMap";
import { delayFactors, stations, trains as sourceTrains, type Train } from "@/data/demo";

export default function Dashboard() {
  const [selected, setSelected] = useState(sourceTrains[0]);
  const [running, setRunning] = useState(true);
  const [simMode, setSimMode] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [congestion, setCongestion] = useState(false);
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);
  useEffect(() => {
    if (!running || !simMode) return;
    const id = window.setInterval(() => setTick((v) => v + 1), 3000 / speed);
    return () => window.clearInterval(id);
  }, [running, simMode, speed]);

  const liveSelected = useMemo(() => ({ ...selected, speed: Math.max(48, selected.speed + ((tick % 5) - 2)), confidence: Math.max(78, selected.confidence - (congestion ? 6 : 0) + (tick % 2)), delay: selected.delay + (congestion ? 8 : 0), aiEta: congestion && selected.number === "12951" ? "21:39" : selected.aiEta, range: congestion && selected.number === "12951" ? "21:34 – 21:44" : selected.range }), [selected, tick, congestion]);
  const filtered = sourceTrains.filter((t) => `${t.number} ${t.name} ${t.current}`.toLowerCase().includes(query.toLowerCase()));

  function triggerCongestion() {
    if (congestion) return;
    setCongestion(true);
    toast.error("Critical congestion detected", { description: "Train 12951 AI ETA revised to 21:39." });
  }

  return <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
    <Toaster position="top-right" theme={dark ? "dark" : "light"} />
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-border bg-background/95 px-3 backdrop-blur-md lg:px-5">
      <div className="flex min-w-fit items-center gap-3"><span className="flex size-9 items-center justify-center bg-primary text-primary-foreground"><TrainFront className="size-5" /></span><span className="text-left"><b className="block text-sm tracking-wide">RailPredict <span className="text-primary">AI</span></b><small className="hidden text-[9px] uppercase tracking-[.16em] text-muted-foreground sm:block">Railway Operations Dashboard</small></span></div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-1.5 text-[10px] font-bold text-success md:flex"><i className="size-2 animate-pulse rounded-full bg-success" /> LIVE</span><span className="hidden font-mono text-[9px] text-muted-foreground lg:block">UPDATED 11:{14 + (tick % 40)}:{String((tick * 3) % 60).padStart(2, "0")} IST</span><Button variant="ghost" size="icon" onClick={() => setDark((v) => !v)} title="Toggle theme">{dark ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon" title="Notifications" className="relative"><Bell /><i className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" /></Button><CircleUserRound className="size-6 text-muted-foreground" /></div>
    </header>
    <div className="flex">
      <main className="w-0 min-w-0 flex-1 p-3 lg:p-4">
        <div className="mx-auto max-w-[1700px]">
           <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="mb-2 flex flex-wrap items-center gap-2"><DemoBadge /><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SIH 2026 · SIH26028</span></div><h1 className="text-xl font-semibold tracking-normal sm:text-2xl">Dynamic ETA Intelligence & Railway Operations Dashboard</h1></div><SimulationControls running={running} setRunning={setRunning} simMode={simMode} setSimMode={setSimMode} speed={speed} setSpeed={setSpeed} onReset={() => { setTick(0); setCongestion(false); toast.success("Simulation reset"); }} /></div>
           <DashboardView selected={liveSelected} setSelected={setSelected} tick={tick} congestion={congestion} triggerCongestion={triggerCongestion} query={query} setQuery={setQuery} filtered={filtered} />
          <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-border py-5 text-[10px] uppercase tracking-wider text-muted-foreground sm:flex-row"><span>RailPredict AI · Smart India Hackathon 2026</span><span>Prototype using simulated operational data · Not affiliated with live railway systems</span></footer>
        </div>
      </main>
    </div>
  </div>;
}

function SimulationControls({ running, setRunning, simMode, setSimMode, speed, setSpeed, onReset }: { running: boolean; setRunning: (v: boolean) => void; simMode: boolean; setSimMode: (v: boolean) => void; speed: number; setSpeed: (v: number) => void; onReset: () => void }) {
  return <div className="flex flex-wrap items-center gap-1.5 border border-border bg-card p-1.5"><label className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wider"><Switch checked={simMode} onCheckedChange={setSimMode} /> Simulation</label><Button size="sm" variant={running ? "secondary" : "default"} onClick={() => setRunning(!running)}>{running ? <Pause /> : <Play />}{running ? "Pause" : "Start"}</Button><Button size="icon" variant="ghost" onClick={onReset} title="Reset simulation"><RotateCcw /></Button>{[1, 2, 5].map((v) => <Button key={v} size="sm" variant={speed === v ? "default" : "ghost"} onClick={() => setSpeed(v)}>{v}x</Button>)}</div>;
}

function DashboardView({ selected, setSelected, tick, congestion, triggerCongestion, query, setQuery, filtered }: { selected: Train; setSelected: (t: Train) => void; tick: number; congestion: boolean; triggerCongestion: () => void; query: string; setQuery: (v: string) => void; filtered: Train[] }) {
  const spark = (n: number) => Array.from({ length: 8 }, (_, i) => n + Math.sin(i + tick) * n * .05);
  return <>
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"><KpiCard label="Live trains" value="1,248" change="2.4%" data={spark(60)} /><KpiCard label="On-time trains" value="78.6%" change="1.8%" tone="success" data={spark(78)} /><KpiCard label="Delayed trains" value={congestion ? "222" : "214"} change={congestion ? "+3.7%" : "-4.2%"} tone="danger" data={spark(45)} /><KpiCard label="Avg network delay" value={congestion ? "19 min" : "18 min"} change="+1.2%" tone="warning" data={spark(20)} /><KpiCard label="ETA accuracy" value="91.8%" change="2.1%" tone="success" data={spark(88)} /><KpiCard label="Active alerts" value={congestion ? "18" : "17"} change={congestion ? "+5.9%" : "-8.4%"} tone="danger" data={spark(17)} /></div>
    <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]"><Panel title="Live Railway Network" kicker="Western–Northern corridor" action={<span className="flex items-center gap-1.5 text-[10px] text-live"><i className="size-1.5 animate-pulse rounded-full bg-live" /> POSITION STREAM ACTIVE</span>}><TrainMap trains={sourceTrains.map((t, i) => ({ ...t, y: t.y + ((tick + i) % 4) * .25 }))} selected={selected} onSelect={setSelected} congestion={congestion} /></Panel><TrainDetail train={selected} congestion={congestion} triggerCongestion={triggerCongestion} /></div>
    <CapabilityStrip />
    <div className="my-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><PredictionPanel selected={selected} congestion={congestion} /><FactorsPanel congestion={congestion} /></div>
    <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><StationTable /><Panel title="Train Search" kicker="Live operational feed"><SearchBox query={query} setQuery={setQuery} /> <div className="divide-y divide-border">{filtered.slice(0, 4).map((t) => <button onClick={() => setSelected(t)} key={t.number} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-accent"><div><p className="text-xs font-semibold">{t.number} · {t.shortName}</p><p className="mt-1 text-[10px] text-muted-foreground">{t.current} → {t.destination}</p></div><div className="text-right"><p className="font-mono text-xs text-live">AI {t.aiEta}</p><p className="mt-1 text-[9px] text-muted-foreground">{t.confidence}% CONF.</p></div></button>)}</div></Panel></div>
  </>;
}

function TrainDetail({ train, congestion, triggerCongestion }: { train: Train; congestion: boolean; triggerCongestion: () => void }) {
  return <Panel title={`${train.number} · ${train.shortName}`} kicker="Selected train" action={<StatusDot status={train.status} />} className="h-full"><div className="p-4"><div className="mb-4 flex items-center gap-3 border-b border-border pb-4"><div className="flex size-10 items-center justify-center bg-primary/10 text-primary"><TrainFront /></div><div><p className="text-sm font-semibold">{train.current}</p><p className="text-[10px] text-muted-foreground">Next · {train.next}</p></div><div className="ml-auto text-right"><p className="font-mono text-lg font-semibold">{train.speed} <span className="text-[10px] text-muted-foreground">km/h</span></p><p className="text-[9px] uppercase text-live">Movement verified</p></div></div><div className="grid grid-cols-2 gap-x-4 gap-y-4"><Metric label="Current delay" value={`+${train.delay} min`} /><Metric label="Distance remaining" value="684 km" /><Metric label="Scheduled ETA" value={train.scheduled} /><Metric label="Current ETA" value={train.currentEta} /><Metric label="AI Predicted ETA" value={train.aiEta} accent /><Metric label="Prediction improvement" value={congestion ? "-3 min" : "-11 min"} /></div><div className="mt-5"><div className="mb-2 flex justify-between text-[10px]"><span className="uppercase text-muted-foreground">Route progress</span><span className="font-mono">{train.progress}%</span></div><div className="h-1.5 bg-muted"><div className="h-full bg-live transition-all" style={{ width: `${train.progress}%` }} /></div></div><div className="mt-5 border-l-2 border-live bg-live/5 p-3"><div className="flex justify-between"><span className="text-[10px] uppercase text-muted-foreground">Prediction confidence</span><b className="font-mono text-live">{train.confidence}%</b></div><p className="mt-1 font-mono text-sm">Range · {train.range}</p></div><Button onClick={triggerCongestion} disabled={congestion} variant={congestion ? "secondary" : "destructive"} className="mt-4 w-full"><AlertTriangle />{congestion ? "Congestion Event Active" : "Trigger Congestion Event"}</Button></div></Panel>;
}

function CapabilityStrip() { return <div className="grid border border-border bg-card md:grid-cols-3">{[[BrainCircuit, "Predict", "Continuously recalculates arrival time"], [Sparkles, "Explain", "Attributes operational impact by factor"], [Zap, "Respond", "Revises ETAs and creates actionable alerts"]].map(([I, a, b], i) => { const Icon = I as typeof BrainCircuit; return <div key={String(a)} className={`flex items-center gap-3 p-4 ${i < 2 ? "border-b border-border md:border-b-0 md:border-r" : ""}`}><span className="flex size-9 items-center justify-center bg-primary/10 text-primary"><Icon className="size-4" /></span><div><p className="text-xs font-bold uppercase tracking-[.14em]">{String(a)}</p><p className="mt-1 text-[10px] text-muted-foreground">{String(b)}</p></div></div>; })}</div>; }

function PredictionPanel({ selected, congestion }: { selected: Train; congestion: boolean }) {
  return <Panel title="AI ETA Prediction" kicker="Dynamic comparison" action={<span className="font-mono text-xs text-live">CONF {selected.confidence}%</span>}><div className="grid border-b border-border sm:grid-cols-3"><div className="p-4"><Metric label="Scheduled ETA" value="18:40" /></div><div className="border-y border-border p-4 sm:border-x sm:border-y-0"><Metric label="Current Railway ETA" value="18:56" /></div><div className="bg-live/5 p-4"><Metric label="AI Predicted ETA" value={congestion ? "18:55" : "18:49"} accent /><p className="mt-1 text-[10px] text-success">{congestion ? "-1 min" : "-7 min"} vs current</p></div></div><div className="p-4"><div className="mb-4 flex items-center gap-2"><span className="h-1.5 flex-1 bg-muted"><i className="block h-full w-[35%] bg-muted-foreground" /></span><span className="size-2 rounded-full bg-muted-foreground" /><span className="h-1.5 flex-1 bg-orange"><i className="block h-full bg-live transition-all" style={{ width: congestion ? "90%" : "55%" }} /></span><span className="size-3 rounded-full bg-live ring-4 ring-live/15" /></div><div className="flex justify-between text-[9px] uppercase text-muted-foreground"><span>Scheduled 18:40</span><span>Current 18:56</span><span className="text-live">AI {congestion ? "18:55" : "18:49"}</span></div><p className="mt-5 border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted-foreground">AI prediction dynamically updates using real-time train movement, historical sectional delays, congestion and operational conditions.</p></div></Panel>;
}

function FactorsPanel({ congestion }: { congestion: boolean }) { return <Panel title="Operational Factors" kicker="Model-derived · Demo"><div className="space-y-4 p-4">{delayFactors.map(([label, value], i) => { const adjusted = congestion && i === 0 ? 49 : value; return <div key={label}><div className="mb-1.5 flex justify-between text-[10px]"><span>{label}</span><b className="font-mono">{adjusted}%</b></div><div className="h-1.5 bg-muted"><div className={`h-full transition-all duration-700 ${i === 0 ? "bg-destructive" : i < 3 ? "bg-orange" : "bg-live"}`} style={{ width: `${adjusted}%` }} /></div></div>; })}</div></Panel>; }

function StationTable() { return <Panel title="Upcoming Stations" kicker="Train 12951"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-muted/60 text-[9px] uppercase tracking-wider text-muted-foreground"><tr>{["Station", "Scheduled ETA", "Current ETA", "AI ETA", "Delay", "Confidence"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{stations.map((s) => <tr key={s.station} className="hover:bg-accent"><td className="px-4 py-3 font-semibold">{s.station}</td><td className="px-4 py-3 font-mono text-muted-foreground">{s.scheduled}</td><td className="px-4 py-3 font-mono">{s.current}</td><td className="px-4 py-3 font-mono font-semibold text-live">{s.ai}</td><td className="px-4 py-3"><span className="bg-warning/10 px-1.5 py-1 font-mono text-warning">+{s.delay} min</span></td><td className="px-4 py-3 font-mono">{s.confidence}%</td></tr>)}</tbody></table></div></Panel>; }

function SearchBox({ query, setQuery }: { query: string; setQuery: (v: string) => void }) { return <div className="border-b border-border p-3"><div className="flex items-center gap-2 border border-input bg-background px-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" placeholder="Search train number, train name or station..." /><Button size="icon" variant="ghost" title="Filters"><ChevronDown /></Button></div></div>; }
