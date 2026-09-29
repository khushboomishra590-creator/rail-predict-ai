# RailPredict AI 🚆

> AI-powered dynamic ETA prediction and railway operations intelligence for Indian Railways corridors.

**Live:** https://rail-predict-ai.vercel.app  
**Hackathon:** Smart India Hackathon 2026 · Problem Statement SIH-26028

---

## Overview

RailPredict AI predicts train arrival times in real time using a machine learning model trained on Indian Railways operational data. Unlike static timetables, it continuously adjusts ETAs based on live section congestion, weather conditions, preceding train delays, speed restrictions, and network-wide cascading effects.

The platform serves three audiences simultaneously — operations control rooms, station PIDS boards, and passengers — all from a single prediction pipeline.

---

## Live Demo

🌐 **https://rail-predict-ai.vercel.app**

---

## Features

### Dashboard
- Live KPI cards (trains tracked, punctuality, avg delay, ETA accuracy)
- Interactive railway network map with clickable train markers
- AI ETA prediction panel with scheduled vs predicted comparison
- Delay factor attribution (ML-derived, with minute-level impact values)
- Upcoming stations table synced to selected train
- Passenger View widget and Station Display Board

### Live Trains
- Full filterable table of all tracked trains
- Filter by zone, train type, and delay status
- ETA range column showing lower–upper prediction bounds

### ETA Prediction
- Per-train prediction curve (scheduled vs AI predicted across stations)
- Inline train selector — switch trains without leaving the view
- ETA range bar with uncertainty window

### Passenger View
- Station-by-station journey timeline
- Expected arrival shown as a range (e.g. 20:46 – 20:56)
- Route progress bar with live position indicator
- Syncs automatically with the train selected in the operational feed

### Station PIDS
- Passenger Information Display System per station
- Station selector filters trains that call at that station
- Expected time range, platform, status badge, and announce button

### Scenario Planner
- Inject real-world disruptions: Dense Fog, Freight Conflict, Signal Failure, Emergency TSR
- Custom disruption creator with section, type, severity, and delay minutes
- Before vs after ETA recalculation results
- Active network advisories panel

### Network Monitor
- Section occupancy heatmap across the Western–Northern corridor
- Capacity utilisation per section with colour-coded risk levels

### Delay Analytics
- Delay distribution charts
- Average delay by railway zone
- Historical vs predicted delay (rolling window)
- Top delay-causing sections ranked

### Model Performance
- Three-tier model comparison (Baseline → XGBoost → Network-aware XGBoost)
- Feature importance weights with gain scores
- Actual vs predicted ETA chart
- Full model metrics panel

### API / Integration
- Full prediction pipeline diagram
- ML model status panel (live)
- REST API endpoint documentation

---

## ML Model

| Metric | Value |
|--------|-------|
| Model | Network-aware XGBoost v2 |
| Features | 29 |
| Training rows | 20,000 |
| MAE | 4.34 min |
| RMSE | 5.92 min |
| P90 uncertainty band | ±9.98 min |
| Improvement over baseline | +57% |

**Feature groups:** Current delay, weather conditions, line saturation, delay accumulation rate, visibility, historical section medians, route congestion index, zone punctuality priors.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 + TypeScript | UI framework |
| TanStack Start | SSR framework |
| TanStack Router | File-based routing |
| Tailwind CSS v4 | Styling |
| Recharts | Charts and visualisations |
| Radix UI | Accessible component primitives |
| Lucide Icons | Icon set |
| Sonner | Toast notifications |
| Vercel | Deployment |

### Backend
| Technology | Purpose |
|------------|---------|
| Python 3 + FastAPI | REST API |
| XGBoost | ML prediction model |
| PostgreSQL | Database |
| SQLAlchemy + Alembic | ORM and migrations |
| Pandas / NumPy | Data processing |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL

### Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000

### Backend

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env and set your DATABASE_URL

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn main:app --reload
```

API runs at http://localhost:8000

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/predict` | Predict next-station delay — returns `predicted_delay` (minutes) |
| `POST` | `/api/predict/range` | Prediction with uncertainty — returns lower bound, upper bound, P90 |
| `POST` | `/api/predict/explain` | Local explanation — top contributing features |
| `GET` | `/api/model/status` | Model health, version, MAE, RMSE, feature count |
| `GET` | `/api/trains` | All live trains with dynamic ETA and status |
| `GET` | `/api/stations/:code/pids` | Station PIDS feed with AI ETA and announcement text |

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── rail/
│   │   │   ├── Dashboard.tsx        # Main application shell + all views
│   │   │   ├── PassengerTracker.tsx # Passenger View component
│   │   │   ├── TrainMap.tsx         # Interactive SVG train map
│   │   │   ├── ScenarioSandbox.tsx  # Disruption planning tool
│   │   │   └── Primitives.tsx       # Shared UI building blocks
│   │   └── ui/                      # Radix-based component library
│   ├── data/
│   │   └── railData.ts              # Static train + journey stop data
│   ├── hooks/
│   │   ├── use-train-eta.ts         # Polls live ETA from FastAPI
│   │   ├── use-train-list.ts        # Fetches train list from API
│   │   └── use-route-eta.ts         # Fetches per-route ETA data
│   ├── lib/
│   │   └── api.ts                   # FastAPI client (VITE_API_BASE_URL)
│   └── routes/
│       ├── __root.tsx               # App shell, fonts, meta
│       └── index.tsx                # Root route → Dashboard
├── backend/
│   ├── main.py                      # FastAPI entry point
│   ├── routes/                      # API route handlers
│   ├── services/                    # Business logic + ML inference
│   ├── models/                      # SQLAlchemy models
│   ├── schemas/                     # Pydantic schemas
│   ├── ETA_dynamicengine/           # Core ML prediction engine
│   └── requirements.txt
└── README.md
```

---

## Environment Variables

### Frontend (`.env`)
```
VITE_API_BASE_URL=http://localhost:8000
```

### Backend (`.env`)
```
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/railpredict_db
DEBUG=false
```

---

## Team

Built by **Team SIH-26028** for Smart India Hackathon 2026.

---

## License

Private repository — Smart India Hackathon 2026 submission.
