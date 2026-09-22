import { ChevronRight, LocateFixed, Navigation, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Train } from "@/data/demo";

const hubs = [{ n: "New Delhi", x: 62, y: 15 }, { n: "Kota", x: 55, y: 30 }, { n: "Ratlam", x: 45, y: 43 }, { n: "Vadodara", x: 38, y: 55 }, { n: "Surat", x: 31, y: 70 }, { n: "Mumbai", x: 23, y: 88 }, { n: "Ahmedabad", x: 27, y: 45 }];

export function TrainMap({ trains, selected, onSelect, congestion }: { trains: Train[]; selected: Train; onSelect: (t: Train) => void; congestion: boolean }) {
  return <div className="relative min-h-[430px] overflow-hidden bg-map-grid">
    <div className="absolute left-3 top-3 z-10 flex gap-1"><Button size="icon" variant="secondary" title="Zoom in"><ZoomIn /></Button><Button size="icon" variant="secondary" title="Zoom out"><ZoomOut /></Button><Button size="icon" variant="secondary" title="Locate selected train"><LocateFixed /></Button></div>
    <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-success" /> On time</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-warning" /> Minor</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-orange" /> Significant</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-destructive" /> Critical</span></div>
    <svg aria-label="Western and Northern railway corridor network" className="absolute inset-0 h-full w-full text-border" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M23 88 C27 76 29 74 31 70 S35 61 38 55 S43 47 45 43 S52 35 55 30 S59 20 62 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 1" />
      <path d="M27 45 C32 48 34 50 38 55" fill="none" stroke="currentColor" strokeWidth=".8" />
      <path d="M45 43 C56 49 68 51 78 43" fill="none" stroke="currentColor" strokeWidth=".7" />
      <path d="M31 70 C47 77 59 76 75 68" fill="none" stroke="currentColor" strokeWidth=".7" />
      {congestion && <path d="M38 55 C41 50 43 47 45 43" fill="none" stroke="var(--destructive)" strokeWidth="2.4" className="animate-pulse" />}
      {hubs.map((h) => <g key={h.n}><circle cx={h.x} cy={h.y} r="1.1" fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth=".45" /><text x={h.x + 1.8} y={h.y - 1} fill="var(--muted-foreground)" fontSize="2.1">{h.n}</text></g>)}
    </svg>
    {trains.map((train) => {
      const tone = train.status === "on-time" ? "bg-success" : train.status === "minor" ? "bg-warning" : train.status === "significant" ? "bg-orange" : "bg-destructive";
      return <Tooltip key={train.number}><TooltipTrigger asChild><button onClick={() => onSelect(train)} aria-label={`Select train ${train.number}`} className={`absolute z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-status-foreground shadow-lg transition-transform hover:scale-125 ${tone} ${selected.number === train.number ? "ring-4 ring-live/20" : ""}`} style={{ left: `${train.x}%`, top: `${train.y}%` }}><Navigation className="size-3.5 rotate-45" /></button></TooltipTrigger><TooltipContent><p className="font-semibold">{train.number} · {train.shortName}</p><p>{train.delay > 0 ? `+${train.delay} min delay` : "On time"}</p></TooltipContent></Tooltip>;
    })}
    <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between border border-border bg-card/90 px-3 py-2 backdrop-blur-md">
      <div className="flex items-center gap-3"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-live" /></span><div><p className="text-xs font-semibold text-foreground">{selected.number} · {selected.shortName}</p><p className="text-[10px] text-muted-foreground">{selected.current} → {selected.next}</p></div></div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </div>
  </div>;
}