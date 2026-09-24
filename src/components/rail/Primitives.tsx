import type { ReactNode } from "react";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

export function Panel({ title, kicker, action, children, className = "" }: { title: string; kicker?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`border border-border bg-card ${className}`}>
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{kicker}</p><h2 className="mt-0.5 text-sm font-semibold text-foreground">{title}</h2></div>
      {action}
    </header>
    {children}
  </section>;
}

export function LiveBadge() {
  return <span className="inline-flex items-center gap-1.5 border border-live/30 bg-live/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-live"><Activity className="size-3" /> Live operations feed</span>;
}

export function StatusDot({ status }: { status: string }) {
  const color = status === "on-time" || status === "operational" ? "bg-success" : status === "minor" || status === "operational" ? "bg-warning" : status === "significant" || status === "warning" ? "bg-orange" : status === "info" ? "bg-live" : "bg-destructive";
  return <span className={`inline-block size-2 rounded-full ${color}`} />;
}

export function KpiCard({ label, value, change, tone = "live", data }: { label: string; value: string; change: string; tone?: "live" | "success" | "warning" | "danger"; data: number[] }) {
  const stroke = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--destructive)" : "var(--live)";
  const positive = !change.startsWith("+") || label === "Live trains";
  return <div className="min-w-0 border border-border bg-card p-3.5 transition-colors hover:bg-elevated">
    <div className="flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p><span className={`flex items-center text-[10px] font-semibold ${positive ? "text-success" : "text-destructive"}`}>{positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{change}</span></div>
    <div className="mt-2 flex items-end justify-between gap-2"><p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p><div className="h-8 w-20"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.map((v, i) => ({ i, v }))}><Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.8} dot={false} /></LineChart></ResponsiveContainer></div></div>
    <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">Network metric</p>
  </div>;
}

export function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><p className="text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className={`mt-1 font-mono text-base font-semibold ${accent ? "text-live" : "text-foreground"}`}>{value}</p></div>;
}