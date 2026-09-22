export type TrainStatus = "on-time" | "minor" | "significant" | "critical";

export type Train = {
  number: string;
  name: string;
  shortName: string;
  current: string;
  next: string;
  destination: string;
  speed: number;
  delay: number;
  scheduled: string;
  currentEta: string;
  aiEta: string;
  confidence: number;
  range: string;
  progress: number;
  status: TrainStatus;
  x: number;
  y: number;
};

export const trains: Train[] = [
  { number: "12951", name: "Mumbai Central – New Delhi Rajdhani", shortName: "Mumbai Rajdhani", current: "Vadodara Junction", next: "Ratlam Junction", destination: "New Delhi", speed: 104, delay: 18, scheduled: "21:42", currentEta: "21:42", aiEta: "21:31", confidence: 94, range: "21:27 – 21:35", progress: 44, status: "minor", x: 38, y: 54 },
  { number: "12952", name: "New Delhi – Mumbai Central Rajdhani", shortName: "Mumbai Rajdhani", current: "Kota Junction", next: "Ratlam Junction", destination: "Mumbai Central", speed: 92, delay: 42, scheduled: "08:35", currentEta: "09:17", aiEta: "09:09", confidence: 88, range: "09:04 – 09:14", progress: 61, status: "significant", x: 53, y: 31 },
  { number: "12932", name: "Ahmedabad – Mumbai Central Double Decker", shortName: "Double Decker", current: "Bharuch Junction", next: "Surat", destination: "Mumbai Central", speed: 87, delay: 9, scheduled: "22:12", currentEta: "22:21", aiEta: "22:18", confidence: 96, range: "22:16 – 22:20", progress: 36, status: "minor", x: 34, y: 64 },
  { number: "12009", name: "Mumbai Central – Ahmedabad Shatabdi", shortName: "Shatabdi Express", current: "Surat", next: "Bharuch Junction", destination: "Ahmedabad", speed: 110, delay: 0, scheduled: "12:45", currentEta: "12:45", aiEta: "12:43", confidence: 97, range: "12:41 – 12:45", progress: 57, status: "on-time", x: 30, y: 72 },
  { number: "19037", name: "Bandra Terminus – Barauni Avadh Express", shortName: "Avadh Express", current: "Ratlam Junction", next: "Kota Junction", destination: "Barauni", speed: 61, delay: 76, scheduled: "02:18", currentEta: "03:34", aiEta: "03:27", confidence: 82, range: "03:19 – 03:35", progress: 49, status: "critical", x: 45, y: 42 },
];

export const stations = [
  { station: "Surat", scheduled: "19:10", current: "19:18", ai: "19:15", delay: 5, confidence: 95 },
  { station: "Vadodara", scheduled: "20:45", current: "20:58", ai: "20:51", delay: 6, confidence: 93 },
  { station: "Ratlam", scheduled: "23:20", current: "23:42", ai: "23:31", delay: 11, confidence: 89 },
  { station: "Kota", scheduled: "02:05", current: "02:31", ai: "02:18", delay: 13, confidence: 87 },
  { station: "New Delhi", scheduled: "08:35", current: "09:17", ai: "09:09", delay: 34, confidence: 84 },
];

export const initialAlerts = [
  { severity: "critical", time: "11:12", title: "Vadodara → Ratlam", reason: "High section congestion detected", impact: "+8 min", action: "Review precedence plan" },
  { severity: "warning", time: "11:08", title: "Train 12951", reason: "ETA revised after dwell-time event", impact: "+4 min", action: "Notify downstream stations" },
  { severity: "operational", time: "10:54", title: "Bharuch → Surat", reason: "Temporary speed restriction", impact: "+3 min", action: "Monitor section clearance" },
  { severity: "info", time: "10:41", title: "Western Railway", reason: "Rainfall may affect sectional run time", impact: "+2–5 min", action: "No action required" },
];

export const delayFactors = [
  ["Track congestion", 34], ["Preceding train delay", 22], ["Station dwell", 16],
  ["Speed restriction", 12], ["Weather", 8], ["Other", 8],
] as const;

export const chartData = [
  { station: "Surat", scheduled: 19.17, current: 19.3, ai: 19.25 },
  { station: "Vadodara", scheduled: 20.75, current: 20.97, ai: 20.85 },
  { station: "Ratlam", scheduled: 23.33, current: 23.7, ai: 23.52 },
  { station: "Kota", scheduled: 26.08, current: 26.52, ai: 26.3 },
  { station: "Delhi", scheduled: 32.58, current: 33.28, ai: 33.15 },
];

export const zones = [
  { name: "Western", delay: 14, accuracy: 93 }, { name: "Northern", delay: 21, accuracy: 89 },
  { name: "Central", delay: 17, accuracy: 91 }, { name: "West Central", delay: 24, accuracy: 87 },
  { name: "North Western", delay: 12, accuracy: 94 },
];