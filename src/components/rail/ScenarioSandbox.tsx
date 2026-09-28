import { useState } from "react";
import { AlertTriangle, Zap, RotateCcw, ChevronRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./Primitives";
import { scenarios, trains, type Scenario } from "@/data/demo";

// ─── Types ────────────────────────────────────────────────────────────────────
type Advisory = {
  id: string;
  time: string;
  section: string;
  type: string;
  severity: "critical" | "warning";
  impact: string;
  status: "active" | "cleared";
};

type BeforeAfter = {
  scenarioId: string;
  label: string;
  trainNumber: string;
  beforeEta: string;
  afterEta: string;
  beforeDelay: number;
  afterDelay: number;
  delta: number;
  impact: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total  = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ScenarioSandboxView({
  activeScenarios,
  onInject,
  onClear,
  alerts,
}: {
  activeScenarios: string[];
  onInject: (id: string) => void;
  onClear: () => void;
  alerts: readonly { severity: string; time: string; title: string; reason: string; impact: string; action: string }[];
}) {
  const [advisories, setAdvisories]   = useState<Advisory[]>([]);
  const [results, setResults]         = useState<BeforeAfter[]>([]);
  const [customDesc, setCustomDesc]   = useState("");
  const [customSection, setCustomSection] = useState("SEC-AGC-GWL (AGC → GWL)");
  const [customType, setCustomType]   = useState("Signal Failure");
  const [customSeverity, setCustomSeverity] = useState("High Severity");
  const [customMinutes, setCustomMinutes]   = useState("15");

  const selectedTrain = trains[0]; // 12951 as demo target

  function inject(s: Scenario) {
    if (activeScenarios.includes(s.id)) return;
    onInject(s.id);

    // compute before / after
    const beforeEta   = selectedTrain.aiEta;
    const afterEta    = addMinutes(selectedTrain.aiEta, s.deltaMin);
    const beforeDelay = selectedTrain.delay;
    const afterDelay  = selectedTrain.delay + s.deltaMin;

    setResults((prev) => [
      {
        scenarioId:   s.id,
        label:        s.label,
        trainNumber:  selectedTrain.number,
        beforeEta,
        afterEta,
        beforeDelay,
        afterDelay,
        delta:        s.deltaMin,
        impact:       s.impact,
      },
      ...prev.filter((r) => r.scenarioId !== s.id),
    ]);

    setAdvisories((prev) => [
      {
        id:       s.id,
        time:     now(),
        section:  s.id === "fog"     ? "NCR: Delhi–Kanpur"
                : s.id === "freight" ? "WR: BRC–RTM"
                : s.id === "signal"  ? "NR: MTJ Junction"
                : "WCR: BPL–RKMP",
        type:     s.id === "fog" ? "Dense Fog" : s.id === "freight" ? "Freight Conflict" : s.id === "signal" ? "Signal Failure" : "Emergency TSR",
        severity: s.severity,
        impact:   s.impact,
        status:   "active",
      },
      ...prev,
    ]);
  }

  function injectCustom() {
    if (!customDesc.trim()) return;
    const mins = parseInt(customMinutes) || 10;
    const afterEta = addMinutes(selectedTrain.aiEta, mins);

    setResults((prev) => [{
      scenarioId:   `custom-${Date.now()}`,
      label:        customDesc,
      trainNumber:  selectedTrain.number,
      beforeEta:    selectedTrain.aiEta,
      afterEta,
      beforeDelay:  selectedTrain.delay,
      afterDelay:   selectedTrain.delay + mins,
      delta:        mins,
      impact:       `+${mins} min`,
    }, ...prev]);

    setAdvisories((prev) => [{
      id:       `custom-${Date.now()}`,
      time:     now(),
      section:  customSection,
      type:     customType,
      severity: customSeverity === "High Severity" ? "critical" : "warning",
      impact:   `+${mins} min`,
      status:   "active",
    }, ...prev]);

    setCustomDesc("");
  }

  function clearAll() {
    onClear();
    setAdvisories((prev) => prev.map((a) => ({ ...a, status: "cleared" as const })));
    setResults([]);
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FlaskConical className="size-5 text-primary" />
            Scenario Disruption Injector
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Inject real-world operational bottlenecks to test the dynamic ML model's downstream ETA recalculation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
          <RotateCcw className="size-3.5" /> Clear All Active Disruptions
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_.55fr]">
        {/* ── Left column ── */}
        <div className="space-y-4">

          {/* Preset scenarios */}
          <Panel title="Preset Disruption Scenarios" kicker="One-click injection">
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {scenarios.map((s) => {
                const active = activeScenarios.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => inject(s)}
                    disabled={active}
                    className={`group relative flex flex-col gap-2 border p-4 text-left transition-all ${
                      active
                        ? "border-destructive/40 bg-destructive/5 opacity-80"
                        : s.severity === "critical"
                        ? "border-border hover:border-destructive/50 hover:bg-destructive/5"
                        : "border-border hover:border-warning/50 hover:bg-warning/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xl">{s.icon}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                        s.severity === "critical"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-warning/30 bg-warning/10 text-warning"
                      }`}>
                        {active ? "ACTIVE" : s.severity.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-snug">{s.label}</p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">{s.labelHi}</p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">{s.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-sm font-bold ${
                        s.severity === "critical" ? "text-destructive" : "text-warning"
                      }`}>{s.impact}</span>
                      {!active && (
                        <span className="flex items-center gap-1 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          Inject <ChevronRight className="size-3" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Custom disruption creator */}
          <Panel title="Create Custom Disruption Event" kicker="Define and inject">
            <div className="space-y-3 p-4">
              <input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Event description…"
                className="w-full border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  className="border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  {["SEC-AGC-GWL (AGC → GWL)", "SEC-NDLS-MTJ (NDLS → MTJ)", "SEC-BRC-ST (BRC → ST)", "SEC-RTM-KOTA (RTM → KOTA)", "SEC-BPL-RKMP (BPL → RKMP)"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  {["Signal Failure", "Dense Fog", "Emergency TSR", "Freight Conflict", "Track Maintenance", "Interlocking Failure"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={customSeverity}
                  onChange={(e) => setCustomSeverity(e.target.value)}
                  className="border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  {["High Severity", "Medium Severity", "Low Severity"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Delay minutes"
                  className="border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  min={1} max={120}
                />
              </div>
              <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={injectCustom}>
                <Zap className="size-4" /> Inject Disruption &amp; Recalculate Network ETAs
              </Button>
              <Button variant="outline" className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={clearAll}>
                <RotateCcw className="size-4" /> Clear All Active Disruptions (Restore Optimal Schedule)
              </Button>
            </div>
          </Panel>

          {/* Before / After results */}
          {results.length > 0 && (
            <Panel title="ETA Recalculation Results" kicker="Before vs after model response">
              <div className="divide-y divide-border">
                {results.map((r) => (
                  <div key={r.scenarioId} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold">{r.label}</p>
                      <span className="font-mono text-sm font-bold text-destructive">{r.impact}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="rounded border border-border bg-muted/30 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground">BEFORE</p>
                        <p className="font-mono font-bold">{r.beforeEta}</p>
                        <p className="text-[9px] text-muted-foreground">+{r.beforeDelay} min delay</p>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-destructive">
                            <ChevronRight className="size-4" />
                          </div>
                          <p className="mt-1 font-mono text-xs font-bold text-destructive">+{r.delta} min</p>
                        </div>
                      </div>
                      <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground">AFTER</p>
                        <p className="font-mono font-bold text-destructive">{r.afterEta}</p>
                        <p className="text-[9px] text-muted-foreground">+{r.afterDelay} min delay</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Train {r.trainNumber} · ETA recalculated by Network-aware XGBoost v2
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ── Right column: Active advisories ── */}
        <div className="space-y-4">
          <Panel
            title="Active Network Advisories & Cautions"
            kicker="Live disruptions integrated into prediction pipeline"
          >
            {advisories.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <FlaskConical className="size-8 opacity-30" />
                <p className="text-xs">No active disruptions</p>
                <p className="text-[10px]">Inject a scenario to begin</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {advisories.map((a, i) => (
                  <div key={`${a.id}-${i}`} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full shrink-0 ${a.status === "cleared" ? "bg-success" : a.severity === "critical" ? "bg-destructive" : "bg-warning"}`} />
                        <p className="text-xs font-semibold truncate">{a.section}</p>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{a.type} · Severity: {a.severity === "critical" ? "High" : "Medium"}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {a.status === "cleared"
                          ? "✓ CLEARED"
                          : `Active since ${a.time}`}
                      </p>
                    </div>
                    <span className={`shrink-0 font-mono text-xs font-bold ${a.status === "cleared" ? "text-success" : "text-destructive"}`}>
                      {a.status === "cleared" ? "CLEARED" : a.impact}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* How it works */}
          <Panel title="How Scenario Injection Works" kicker="ML model pipeline">
            <div className="space-y-2 p-4 text-xs text-muted-foreground">
              {[
                ["1", "Select or create a disruption event"],
                ["2", "Feature values updated (e.g. route_congestion_index, weather_condition, interlocking_failure_flag)"],
                ["3", "update_train_prediction() called with new state"],
                ["4", "Network-aware XGBoost v2 recalculates predicted_delay"],
                ["5", "ETA, lower_bound, upper_bound updated in real time"],
                ["6", "Delta shown: before → after with minute impact"],
              ].map(([n, text]) => (
                <div key={n} className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{n}</span>
                  <p className="leading-relaxed">{text}</p>
                </div>
              ))}
              <p className="mt-3 rounded border border-border bg-muted/30 p-2 text-[9px] font-mono text-muted-foreground">
                Source: model/dynamic_eta.py → update_train_prediction()
              </p>
            </div>
          </Panel>

          {/* Alerts feed */}
          {alerts.length > 0 && (
            <Panel title="Recent Alerts" kicker={`${alerts.length} total`}>
              <div className="divide-y divide-border">
                {alerts.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3">
                    <span className={`mt-0.5 size-2 shrink-0 rounded-full ${
                      a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-warning" : "bg-live"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{a.reason}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-warning">{a.impact}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
