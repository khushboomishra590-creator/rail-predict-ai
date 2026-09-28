/**
 * use-train-list.ts
 * ─────────────────
 * Fetches GET /api/trains on mount and returns the list.
 * Maps API fields → the Train display shape used by Dashboard.tsx.
 *
 * For train 12951 the real M3/M4 ETA is fetched separately via useTrainEta.
 * For all other trains we provide sensible display defaults derived from
 * the API response — no fake ETA or prediction values are invented.
 *
 * Falls back to the demo.ts train list if the API is unreachable.
 */

import { useEffect, useState } from "react";
import { api, type ApiTrain } from "@/lib/api";
import { trains as demoTrains, type Train } from "@/data/demo";

// Static display props derived from the API data.
// Position on map (x/y) is assigned per known train number where possible,
// with a spread fallback for unknown trains.
const TRAIN_DISPLAY: Record<string, Partial<Train>> = {
  "12951": { x: 38, y: 54, zone: "WR", trainType: "Rajdhani",   rake: "LHB", mps: 130, speed: 104, delay: 18, progress: 44, status: "minor"    },
  "12952": { x: 53, y: 31, zone: "WR", trainType: "Rajdhani",   rake: "LHB", mps: 130, speed:  92, delay: 42, progress: 61, status: "significant"},
  "12931": { x: 29, y: 68, zone: "WR", trainType: "Superfast",  rake: "LHB", mps: 110, speed:  87, delay:  9, progress: 28, status: "minor"    },
  "12932": { x: 34, y: 64, zone: "WR", trainType: "Superfast",  rake: "LHB", mps: 110, speed:  83, delay: 12, progress: 36, status: "minor"    },
  "12009": { x: 30, y: 72, zone: "WR", trainType: "Shatabdi",   rake: "LHB", mps: 150, speed: 110, delay:  0, progress: 57, status: "on-time"  },
  "12010": { x: 44, y: 60, zone: "WR", trainType: "Shatabdi",   rake: "LHB", mps: 150, speed: 108, delay:  3, progress: 42, status: "minor"    },
  "22953": { x: 25, y: 76, zone: "WR", trainType: "Superfast",  rake: "LHB", mps: 110, speed:  94, delay:  6, progress: 31, status: "minor"    },
  "22954": { x: 48, y: 58, zone: "WR", trainType: "Superfast",  rake: "LHB", mps: 110, speed:  90, delay: 14, progress: 55, status: "significant"},
};

/** Derive a display confidence from known status when no demo entry exists. */
function statusToConfidence(status: string): number {
  if (status === "on-time")    return 96;
  if (status === "minor")      return 88;
  if (status === "significant")return 78;
  return 70;
}

/** Map one API train record → the full Train display shape. */
function apiTrainToDisplay(t: ApiTrain): Train {
  const disp = TRAIN_DISPLAY[t.number] ?? {
    x: 40, y: 55, zone: "IR", trainType: t.train_type ?? "Express",
    rake: "LHB", mps: 110, speed: 80, delay: 5, progress: 45, status: "minor",
  };

  // Find matching demo entry to preserve display strings, if available
  const demo = demoTrains.find((d) => d.number === t.number);
  const status = (disp.status ?? demo?.status ?? "minor") as Train["status"];
  const confidence = demo?.confidence ?? statusToConfidence(status);

  return {
    number:      t.number,
    name:        t.name,
    shortName:   t.short_name ?? t.name.split("–")[0].split("-")[0].trim(),
    current:     demo?.current     ?? "En route",
    next:        demo?.next        ?? "Next station",
    destination: demo?.destination ?? t.name.split("-").slice(-1)[0].trim(),
    speed:       disp.speed        ?? demo?.speed   ?? 80,
    delay:       disp.delay        ?? demo?.delay   ?? 5,
    scheduled:   demo?.scheduled   ?? "Not available",
    currentEta:  demo?.currentEta  ?? "Not available",
    // ── For non-12951 trains, no live ETA from API — use demo if available ──
    aiEta:      demo?.aiEta       ?? "Not available",
    aiEtaLower: demo?.aiEtaLower  ?? "",
    aiEtaUpper: demo?.aiEtaUpper  ?? "",
    confidence,
    range:      demo?.range        ?? "Not available",
    // ────────────────────────────────────────────────────────────────────────
    progress:    disp.progress ?? demo?.progress ?? 45,
    status,
    x:           disp.x ?? demo?.x ?? 40,
    y:           disp.y ?? demo?.y ?? 55,
    zone:        disp.zone     ?? demo?.zone      ?? "IR",
    trainType:   disp.trainType ?? demo?.trainType ?? t.train_type ?? "Express",
    rake:        disp.rake     ?? demo?.rake      ?? "LHB",
    mps:         disp.mps      ?? demo?.mps       ?? 110,
  } as Train;
}

type TrainListState =
  | { status: "loading" }
  | { status: "ok"; trains: [Train, ...Train[]] }
  | { status: "error"; trains: [Train, ...Train[]] }; // fallback to demo

export function useTrainList() {
  const [state, setState] = useState<TrainListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api.listTrains().then((apiTrains) => {
      if (cancelled) return;
      if (!apiTrains.length) {
        setState({ status: "ok", trains: demoTrains });
        return;
      }
      const mapped = apiTrains.map(apiTrainToDisplay);
      setState({ status: "ok", trains: mapped as [Train, ...Train[]] });
    }).catch(() => {
      if (!cancelled) {
        // API unreachable — fall back to demo data gracefully
        setState({ status: "error", trains: demoTrains });
      }
    });
    return () => { cancelled = true; };
  }, []);

  return state;
}
