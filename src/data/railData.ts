// ─── Train types ────────────────────────────────────────────────────────────
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
  aiEtaLower: string;
  aiEtaUpper: string;
  confidence: number;
  range: string;
  progress: number;
  status: TrainStatus;
  x: number;
  y: number;
  zone: string;
  trainType: string;
  rake: string;
  mps: number;
};

export const trains: [Train, ...Train[]] = [
  {
    number: "12951", name: "Mumbai Central – New Delhi Rajdhani Express", shortName: "Mumbai Rajdhani",
    current: "Vadodara Junction", next: "Ratlam Junction", destination: "New Delhi",
    speed: 104, delay: 18, scheduled: "21:42", currentEta: "22:00", aiEta: "21:53",
    aiEtaLower: "21:48", aiEtaUpper: "21:58", confidence: 94, range: "21:48 – 21:58",
    progress: 44, status: "minor", x: 38, y: 54, zone: "WR", trainType: "Rajdhani", rake: "LHB", mps: 130,
  },
  {
    number: "12952", name: "New Delhi – Mumbai Central Rajdhani Express", shortName: "Delhi Rajdhani",
    current: "Kota Junction", next: "Ratlam Junction", destination: "Mumbai Central",
    speed: 92, delay: 42, scheduled: "08:35", currentEta: "09:17", aiEta: "09:09",
    aiEtaLower: "09:04", aiEtaUpper: "09:14", confidence: 88, range: "09:04 – 09:14",
    progress: 61, status: "significant", x: 53, y: 31, zone: "WR", trainType: "Rajdhani", rake: "LHB", mps: 130,
  },
  {
    number: "12932", name: "Ahmedabad – Mumbai Central Double Decker", shortName: "Double Decker",
    current: "Bharuch Junction", next: "Surat", destination: "Mumbai Central",
    speed: 87, delay: 9, scheduled: "22:12", currentEta: "22:21", aiEta: "22:18",
    aiEtaLower: "22:16", aiEtaUpper: "22:20", confidence: 96, range: "22:16 – 22:20",
    progress: 36, status: "minor", x: 34, y: 64, zone: "WR", trainType: "Superfast", rake: "LHB", mps: 110,
  },
  {
    number: "12009", name: "Mumbai Central – Ahmedabad Shatabdi Express", shortName: "Shatabdi Express",
    current: "Surat", next: "Bharuch Junction", destination: "Ahmedabad",
    speed: 110, delay: 0, scheduled: "12:45", currentEta: "12:45", aiEta: "12:43",
    aiEtaLower: "12:41", aiEtaUpper: "12:45", confidence: 97, range: "12:41 – 12:45",
    progress: 57, status: "on-time", x: 30, y: 72, zone: "WR", trainType: "Shatabdi", rake: "LHB", mps: 150,
  },
  {
    number: "19037", name: "Bandra Terminus – Barauni Avadh Express", shortName: "Avadh Express",
    current: "Ratlam Junction", next: "Kota Junction", destination: "Barauni",
    speed: 61, delay: 76, scheduled: "02:18", currentEta: "03:34", aiEta: "03:27",
    aiEtaLower: "03:19", aiEtaUpper: "03:35", confidence: 82, range: "03:19 – 03:35",
    progress: 49, status: "critical", x: 45, y: 42, zone: "WCR", trainType: "Mail/Express", rake: "ICF", mps: 110,
  },
];

// ─── Station ETA table ───────────────────────────────────────────────────────
export const stations = [
  { station: "Surat",     stationCode: "ST",   scheduled: "19:10", current: "19:18", ai: "19:15", aiLower: "19:12", aiUpper: "19:18", delay: 5,  confidence: 95, reason: "Section congestion",       platform: "2" },
  { station: "Vadodara",  stationCode: "BRC",  scheduled: "20:45", current: "20:58", ai: "20:51", aiLower: "20:46", aiUpper: "20:56", delay: 6,  confidence: 93, reason: "Preceding train delay",    platform: "3" },
  { station: "Ratlam",    stationCode: "RTM",  scheduled: "23:20", current: "23:42", ai: "23:31", aiLower: "23:26", aiUpper: "23:36", delay: 11, confidence: 89, reason: "Speed restriction (TSR)",  platform: "1" },
  { station: "Kota",      stationCode: "KOTA", scheduled: "02:05", current: "02:31", ai: "02:18", aiLower: "02:11", aiUpper: "02:25", delay: 13, confidence: 87, reason: "High line utilisation",    platform: "4" },
  { station: "New Delhi", stationCode: "NDLS", scheduled: "08:35", current: "09:17", ai: "09:09", aiLower: "09:01", aiUpper: "09:17", delay: 34, confidence: 84, reason: "Cumulative section delay",  platform: "9" },
];

// ─── Journey stop type ───────────────────────────────────────────────────────
export type JourneyStop = {
  station: string; code: string; km: number;
  sch: string; ai: string | null; lower: string | null; upper: string | null;
  status: "departed" | "arrived" | "current" | "upcoming";
  delay: number | null; platform: string;
};

// ─── Per-train journey stops ──────────────────────────────────────────────────
export const allJourneyStops: Record<string, JourneyStop[]> = {
  // 12951 — Mumbai Rajdhani (currently at Vadodara Jn, heading to New Delhi)
  "12951": [
    { station: "Mumbai Central", code: "BCT",  km: 0,    sch: "16:35", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "8" },
    { station: "Surat",          code: "ST",   km: 263,  sch: "19:10", ai: "19:15", lower: "19:12",upper: "19:18",status: "arrived",  delay: 5,  platform: "2" },
    { station: "Vadodara Jn",    code: "BRC",  km: 391,  sch: "20:45", ai: "20:51", lower: "20:46",upper: "20:56",status: "current",  delay: 6,  platform: "3" },
    { station: "Ratlam Jn",      code: "RTM",  km: 614,  sch: "23:20", ai: "23:31", lower: "23:26",upper: "23:36",status: "upcoming", delay: 11, platform: "1" },
    { station: "Kota Jn",        code: "KOTA", km: 846,  sch: "02:05", ai: "02:18", lower: "02:11",upper: "02:25",status: "upcoming", delay: 13, platform: "4" },
    { station: "Mathura Jn",     code: "MTJ",  km: 1177, sch: "05:05", ai: "05:21", lower: "05:14",upper: "05:28",status: "upcoming", delay: 16, platform: "2" },
    { station: "New Delhi",      code: "NDLS", km: 1384, sch: "08:35", ai: "09:09", lower: "09:01",upper: "09:17",status: "upcoming", delay: 34, platform: "9" },
  ],
  // 12952 — Delhi Rajdhani (currently at Kota Jn, heading to Mumbai Central)
  "12952": [
    { station: "New Delhi",      code: "NDLS", km: 0,    sch: "16:55", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "2" },
    { station: "Mathura Jn",     code: "MTJ",  km: 207,  sch: "18:14", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "1" },
    { station: "Kota Jn",        code: "KOTA", km: 538,  sch: "22:10", ai: "22:52", lower: "22:46",upper: "22:58",status: "current",  delay: 42, platform: "3" },
    { station: "Ratlam Jn",      code: "RTM",  km: 770,  sch: "01:10", ai: "01:54", lower: "01:48",upper: "02:00",status: "upcoming", delay: 44, platform: "2" },
    { station: "Vadodara Jn",    code: "BRC",  km: 993,  sch: "04:05", ai: "04:51", lower: "04:44",upper: "04:58",status: "upcoming", delay: 46, platform: "4" },
    { station: "Surat",          code: "ST",   km: 1121, sch: "05:35", ai: "06:18", lower: "06:12",upper: "06:24",status: "upcoming", delay: 43, platform: "1" },
    { station: "Mumbai Central", code: "BCT",  km: 1384, sch: "08:35", ai: "09:09", lower: "09:04",upper: "09:14",status: "upcoming", delay: 34, platform: "6" },
  ],
  // 12932 — Double Decker (currently at Bharuch Jn, heading to Mumbai Central)
  "12932": [
    { station: "Ahmedabad Jn",   code: "ADI",  km: 0,    sch: "19:55", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "3" },
    { station: "Anand Jn",       code: "ANND", km: 46,   sch: "20:27", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "1" },
    { station: "Bharuch Jn",     code: "BH",   km: 127,  sch: "21:30", ai: "21:39", lower: "21:37",upper: "21:41",status: "current",  delay: 9,  platform: "2" },
    { station: "Surat",          code: "ST",   km: 200,  sch: "22:12", ai: "22:18", lower: "22:16",upper: "22:20",status: "upcoming", delay: 6,  platform: "4" },
    { station: "Mumbai Central", code: "BCT",  km: 463,  sch: "00:35", ai: "00:42", lower: "00:40",upper: "00:44",status: "upcoming", delay: 7,  platform: "5" },
  ],
  // 12009 — Shatabdi Express (currently at Surat, heading to Ahmedabad)
  "12009": [
    { station: "Mumbai Central", code: "BCT",  km: 0,    sch: "06:25", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "1" },
    { station: "Surat",          code: "ST",   km: 263,  sch: "12:45", ai: "12:43", lower: "12:41",upper: "12:45",status: "current",  delay: 0,  platform: "2" },
    { station: "Bharuch Jn",     code: "BH",   km: 336,  sch: "13:25", ai: "13:23", lower: "13:21",upper: "13:25",status: "upcoming", delay: 0,  platform: "1" },
    { station: "Vadodara Jn",    code: "BRC",  km: 391,  sch: "14:05", ai: "14:03", lower: "14:01",upper: "14:05",status: "upcoming", delay: 0,  platform: "3" },
    { station: "Ahmedabad Jn",   code: "ADI",  km: 493,  sch: "15:30", ai: "15:28", lower: "15:26",upper: "15:30",status: "upcoming", delay: 0,  platform: "4" },
  ],
  // 19037 — Avadh Express (currently at Ratlam Jn, heading to Barauni)
  "19037": [
    { station: "Bandra Terminus", code: "BDTS", km: 0,    sch: "12:55", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "2" },
    { station: "Vadodara Jn",     code: "BRC",  km: 391,  sch: "18:10", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "1" },
    { station: "Ratlam Jn",       code: "RTM",  km: 614,  sch: "21:00", ai: "22:16", lower: "22:08",upper: "22:24",status: "current",  delay: 76, platform: "3" },
    { station: "Kota Jn",         code: "KOTA", km: 846,  sch: "00:05", ai: "01:21", lower: "01:13",upper: "01:29",status: "upcoming", delay: 76, platform: "2" },
    { station: "Agra Cantt",      code: "AGC",  km: 1092, sch: "04:20", ai: "05:36", lower: "05:28",upper: "05:44",status: "upcoming", delay: 76, platform: "1" },
    { station: "Barauni Jn",      code: "BJU",  km: 1884, sch: "02:18", ai: "03:34", lower: "03:27",upper: "03:41",status: "upcoming", delay: 76, platform: "4" },
  ],

  // 12010 — Ahmedabad–Mumbai Central Shatabdi (en route, currently near Vadodara)
  "12010": [
    { station: "Ahmedabad Jn",   code: "ADI",  km: 0,    sch: "06:25", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "4" },
    { station: "Anand Jn",       code: "ANND", km: 46,   sch: "07:00", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "1" },
    { station: "Vadodara Jn",    code: "BRC",  km: 100,  sch: "07:48", ai: "07:51", lower: "07:49",upper: "07:53",status: "current",  delay: 3,  platform: "3" },
    { station: "Bharuch Jn",     code: "BH",   km: 173,  sch: "08:30", ai: "08:34", lower: "08:32",upper: "08:36",status: "upcoming", delay: 4,  platform: "1" },
    { station: "Surat",          code: "ST",   km: 246,  sch: "09:18", ai: "09:22", lower: "09:20",upper: "09:24",status: "upcoming", delay: 4,  platform: "2" },
    { station: "Mumbai Central", code: "BCT",  km: 493,  sch: "13:00", ai: "13:04", lower: "13:02",upper: "13:06",status: "upcoming", delay: 4,  platform: "5" },
  ],

  // 12931 — Mumbai Central–Delhi Hazrat Nizamuddin Double Decker (en route)
  "12931": [
    { station: "Mumbai Central", code: "BCT",  km: 0,    sch: "23:55", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "6" },
    { station: "Surat",          code: "ST",   km: 263,  sch: "03:20", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "3" },
    { station: "Vadodara Jn",    code: "BRC",  km: 391,  sch: "04:58", ai: "05:07", lower: "05:04",upper: "05:10",status: "current",  delay: 9,  platform: "2" },
    { station: "Ratlam Jn",      code: "RTM",  km: 614,  sch: "07:45", ai: "07:54", lower: "07:51",upper: "07:57",status: "upcoming", delay: 9,  platform: "4" },
    { station: "Kota Jn",        code: "KOTA", km: 846,  sch: "10:30", ai: "10:39", lower: "10:36",upper: "10:42",status: "upcoming", delay: 9,  platform: "1" },
    { station: "Mathura Jn",     code: "MTJ",  km: 1177, sch: "14:05", ai: "14:14", lower: "14:11",upper: "14:17",status: "upcoming", delay: 9,  platform: "3" },
    { station: "Hazrat Nizamuddin", code: "NZM", km: 1384, sch: "16:35", ai: "16:44", lower: "16:41",upper: "16:47",status: "upcoming", delay: 9,  platform: "2" },
  ],

  // 22953 — Mumbai Central–Gandhinagar Capital SF Express (en route)
  "22953": [
    { station: "Mumbai Central", code: "BCT",  km: 0,    sch: "08:10", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "2" },
    { station: "Surat",          code: "ST",   km: 263,  sch: "11:25", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "4" },
    { station: "Bharuch Jn",     code: "BH",   km: 336,  sch: "12:18", ai: "12:24", lower: "12:22",upper: "12:26",status: "current",  delay: 6,  platform: "1" },
    { station: "Vadodara Jn",    code: "BRC",  km: 391,  sch: "13:05", ai: "13:11", lower: "13:09",upper: "13:13",status: "upcoming", delay: 6,  platform: "5" },
    { station: "Anand Jn",       code: "ANND", km: 437,  sch: "13:48", ai: "13:54", lower: "13:52",upper: "13:56",status: "upcoming", delay: 6,  platform: "2" },
    { station: "Gandhinagar Capital", code: "GNC", km: 494, sch: "14:45", ai: "14:51", lower: "14:49",upper: "14:53",status: "upcoming", delay: 6,  platform: "1" },
  ],

  // 22954 — Gandhinagar Capital–Mumbai Central SF Express (en route)
  "22954": [
    { station: "Gandhinagar Capital", code: "GNC", km: 0,   sch: "08:00", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "1" },
    { station: "Ahmedabad Jn",   code: "ADI",  km: 25,   sch: "08:30", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "3" },
    { station: "Anand Jn",       code: "ANND", km: 71,   sch: "09:05", ai: null,    lower: null,   upper: null,   status: "departed", delay: 0,  platform: "2" },
    { station: "Vadodara Jn",    code: "BRC",  km: 117,  sch: "09:47", ai: "10:01", lower: "09:58",upper: "10:04",status: "current",  delay: 14, platform: "4" },
    { station: "Bharuch Jn",     code: "BH",   km: 190,  sch: "10:40", ai: "10:54", lower: "10:51",upper: "10:57",status: "upcoming", delay: 14, platform: "1" },
    { station: "Surat",          code: "ST",   km: 263,  sch: "11:35", ai: "11:49", lower: "11:46",upper: "11:52",status: "upcoming", delay: 14, platform: "3" },
    { station: "Mumbai Central", code: "BCT",  km: 494,  sch: "15:15", ai: "15:28", lower: "15:25",upper: "15:31",status: "upcoming", delay: 13, platform: "7" },
  ],
};

// ─── Passenger journey timeline (kept for backward compat — train 12951) ─────
export const journeyStops = allJourneyStops["12951"]!;

// ─── Alerts ──────────────────────────────────────────────────────────────────
export const initialAlerts = [
  { severity: "critical",    time: "11:12", title: "Vadodara → Ratlam",  reason: "High section congestion detected — route_congestion_index 8.4", impact: "+8 min",  action: "Review precedence plan" },
  { severity: "warning",     time: "11:08", title: "Train 12951",         reason: "ETA revised after dwell-time event at Vadodara Junction",       impact: "+4 min",  action: "Notify downstream stations" },
  { severity: "operational", time: "10:54", title: "Bharuch → Surat",     reason: "Temporary speed restriction (TSR) active — 65 km/h cap",        impact: "+3 min",  action: "Monitor section clearance" },
  { severity: "info",        time: "10:41", title: "Western Railway",      reason: "Moderate rainfall forecast may affect sectional run time",       impact: "+2–5 min", action: "No action required" },
];

// ─── Delay factors (with minute impact values) ───────────────────────────────
export const delayFactors = [
  { label: "Section Congestion",      impact: "+3.2 min", pct: 34 },
  { label: "Preceding Train Delay",   impact: "+1.8 min", pct: 22 },
  { label: "Station Dwell Time",      impact: "+0.9 min", pct: 16 },
  { label: "Speed Restriction (TSR)", impact: "+0.6 min", pct: 12 },
  { label: "Weather Conditions",      impact: "+0.4 min", pct: 8  },
  { label: "Recovery Absorption",     impact: "−2.1 min", pct: 8  },
] as const;

// ─── Chart data ───────────────────────────────────────────────────────────────
export const chartData = [
  { station: "Surat",     scheduled: 19.17, current: 19.30, ai: 19.25 },
  { station: "Vadodara",  scheduled: 20.75, current: 20.97, ai: 20.85 },
  { station: "Ratlam",    scheduled: 23.33, current: 23.70, ai: 23.52 },
  { station: "Kota",      scheduled: 26.08, current: 26.52, ai: 26.30 },
  { station: "Delhi",     scheduled: 32.58, current: 33.28, ai: 33.15 },
];

// ─── Zone stats ───────────────────────────────────────────────────────────────
export const zones = [
  { name: "Western",      delay: 14, accuracy: 93, punctuality: 87.2 },
  { name: "Northern",     delay: 21, accuracy: 89, punctuality: 69.4 },
  { name: "Central",      delay: 17, accuracy: 91, punctuality: 84.6 },
  { name: "West Central", delay: 24, accuracy: 87, punctuality: 79.8 },
  { name: "North Western",delay: 12, accuracy: 94, punctuality: 85.1 },
];

// ─── Network sections for heatmap ─────────────────────────────────────────────
export const networkSections = [
  { name: "AGC → GWL",   cap: 63, speed: 100, mps: 130, status: "moderate" as const },
  { name: "AJJ → KPD",   cap: 75, speed: 110, mps: 110, status: "moderate" as const },
  { name: "ASN → HWH",   cap: 91, speed:  61, mps: 110, status: "heavy"    as const },
  { name: "BPL → RKMP",  cap: 58, speed: 110, mps: 110, status: "optimal"  as const },
  { name: "BRC → ST",    cap: 93, speed:  87, mps: 110, status: "heavy"    as const },
  { name: "BVI → MMCT",  cap: 82, speed: 120, mps: 130, status: "moderate" as const },
  { name: "BWT → SBC",   cap: 78, speed: 100, mps: 110, status: "moderate" as const },
  { name: "CNB → PRYJ",  cap: 83, speed:  95, mps: 130, status: "heavy"    as const },
  { name: "DOU → GAYA",  cap: 70, speed: 105, mps: 110, status: "moderate" as const },
  { name: "DNH → ASN",   cap: 99, speed:  45, mps:  75, status: "critical" as const },
  { name: "GAYA → DHN",  cap: 87, speed:  80, mps: 110, status: "heavy"    as const },
  { name: "GWL → VGLB",  cap: 73, speed: 115, mps: 130, status: "moderate" as const },
  { name: "JTJ → BWT",   cap: 67, speed: 100, mps: 110, status: "moderate" as const },
  { name: "KOTA → RTM",  cap: 76, speed:  92, mps: 130, status: "moderate" as const },
  { name: "KPD → MAS",   cap: 73, speed: 105, mps: 110, status: "moderate" as const },
  { name: "NDLS → MTJ",  cap: 91, speed: 127, mps: 130, status: "heavy"    as const },
  { name: "PRYJ → BSB",  cap: 88, speed:  72, mps: 110, status: "heavy"    as const },
  { name: "RTM → KOTA",  cap: 84, speed:  61, mps: 130, status: "heavy"    as const },
  { name: "SBC → UBL",   cap: 55, speed: 120, mps: 110, status: "optimal"  as const },
  { name: "ST → BRC",    cap: 68, speed:  87, mps: 110, status: "moderate" as const },
  { name: "WL → GNT",    cap: 62, speed: 110, mps: 110, status: "moderate" as const },
  { name: "YPR → SBC",   cap: 48, speed: 130, mps: 130, status: "optimal"  as const },
];

// ─── PIDS board ───────────────────────────────────────────────────────────────
// stationCodes: which stations this train calls at (for filtering by station)
export const pidsRows = [
  { number: "12951", name: "Mumbai Rajdhani Express",    route: "BCT → NDLS", scheduled: "21:42", aiEta: "21:53", aiEtaLower: "21:48", aiEtaUpper: "21:58", platform: "4", status: "minor"       as const, delay: 18, stations: ["BCT","ST","BRC","RTM","KOTA","MTJ","NDLS"] },
  { number: "12932", name: "Ahmedabad Double Decker",    route: "ADI → BCT",  scheduled: "22:12", aiEta: "22:18", aiEtaLower: "22:16", aiEtaUpper: "22:20", platform: "2", status: "minor"       as const, delay: 9,  stations: ["ADI","ANND","BH","ST","BCT"] },
  { number: "12009", name: "Shatabdi Express",           route: "BCT → ADI",  scheduled: "12:45", aiEta: "12:43", aiEtaLower: "12:41", aiEtaUpper: "12:45", platform: "1", status: "on-time"     as const, delay: 0,  stations: ["BCT","ST","BH","BRC","ADI"] },
  { number: "12952", name: "New Delhi Rajdhani Express", route: "NDLS → BCT", scheduled: "08:35", aiEta: "09:09", aiEtaLower: "09:04", aiEtaUpper: "09:14", platform: "3", status: "significant" as const, delay: 34, stations: ["NDLS","MTJ","KOTA","RTM","BRC","ST","BCT"] },
  { number: "19037", name: "Avadh Express",              route: "BDTS → BJU", scheduled: "02:18", aiEta: "03:27", aiEtaLower: "03:19", aiEtaUpper: "03:35", platform: "5", status: "critical"    as const, delay: 76, stations: ["BDTS","BRC","RTM","KOTA","AGC","BJU"] },
];

// ─── Scenario disruptions ─────────────────────────────────────────────────────
export type Scenario = {
  id: string;
  icon: string;
  label: string;
  labelHi: string;
  description: string;
  impact: string;
  severity: "warning" | "critical";
  field: string;
  value: number;
  deltaMin: number;
};

export const scenarios: Scenario[] = [
  {
    id: "fog",
    icon: "🌫",
    label: "Dense Fog — Delhi–Kanpur",
    labelHi: "घना कोहरा — दिल्ली–कानपुर",
    description: "Visibility drops below 50m. Speed capped at 60 km/h on NCR sections.",
    impact: "+13 min",
    severity: "critical",
    field: "weather_condition",
    value: 3,
    deltaMin: 13,
  },
  {
    id: "freight",
    icon: "🚂",
    label: "Freight Conflict Ahead",
    labelHi: "आगे मालगाड़ी संघर्ष",
    description: "Preceding freight train occupying block section. Headway compressed.",
    impact: "+8 min",
    severity: "warning",
    field: "preceding_freight_conflict",
    value: 1,
    deltaMin: 8,
  },
  {
    id: "signal",
    icon: "⚡",
    label: "Signal Failure — Mathura Jn",
    labelHi: "सिग्नल विफलता — मथुरा जंक्शन",
    description: "Interlocking failure detected. Trains operating on caution.",
    impact: "+22 min",
    severity: "critical",
    field: "interlocking_failure_flag",
    value: 1,
    deltaMin: 22,
  },
  {
    id: "tsr",
    icon: "🛑",
    label: "Emergency TSR 30 km/h",
    labelHi: "आपातकालीन गति प्रतिबंध 30 km/h",
    description: "Track maintenance block active. All trains restricted to 30 km/h.",
    impact: "+15 min",
    severity: "critical",
    field: "route_congestion_index",
    value: 9.5,
    deltaMin: 15,
  },
];

// ─── Model performance ────────────────────────────────────────────────────────
export const modelTiers = [
  { tier: "Baseline",              subtitle: "Carry-forward current delay",  mae: 10.08, rmse: 14.16, features: 1,  improvement: null },
  { tier: "XGBoost",               subtitle: "12 features, no network data", mae: 2.67,  rmse: 3.37,  features: 12, improvement: "+21% vs baseline" },
  { tier: "Network-aware XGBoost", subtitle: "29 features, weather + network", mae: 4.34, rmse: 5.92, features: 29, improvement: "+57% vs baseline" },
];

export const featureImportance = [
  { feature: "Current Station Delay",           gain: 29163, group: "core"    },
  { feature: "Severe Weather Alert",            gain: 22397, group: "weather" },
  { feature: "Line Saturation Penalty",         gain: 15523, group: "network" },
  { feature: "Delay Accumulation Rate",         gain:  8300, group: "network" },
  { feature: "Visibility (km)",                 gain:  4034, group: "weather" },
  { feature: "Line Utilisation Ratio",          gain:  3023, group: "network" },
  { feature: "Season",                          gain:  2214, group: "weather" },
  { feature: "Rolling Stock Recovery",          gain:   917, group: "core"    },
  { feature: "Route Congestion Index",          gain:   841, group: "network" },
  { feature: "Weather Condition",               gain:   547, group: "weather" },
  { feature: "Current Speed",                   gain:   529, group: "core"    },
  { feature: "Zone Punctuality Prior",          gain:   413, group: "network" },
  { feature: "Historical Section Median",       gain:   200, group: "history" },
  { feature: "Historical Section P90",          gain:   163, group: "history" },
];
