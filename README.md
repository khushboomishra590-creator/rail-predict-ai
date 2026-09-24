# RailPredict AI

Create a production-quality, modern web dashboard for Smart India Hackathon 2026 Problem Statement SIH26028:

“Dynamic Forecast of Expected Time of Arrival (ETA) for Coaching Trains”

Organization: Ministry of Railways

Category: Software

Domain: Smart Automation / Railway Operations

Goal: AI-powered dynamic ETA prediction for passenger/coaching trains.

IMPORTANT:

This is NOT a generic train-tracking website.

The core purpose is to demonstrate an AI/ML-based Dynamic ETA Prediction System that continuously updates predicted arrival times using current train status, historical delay patterns, sectional running times, congestion, speed, weather and operational conditions.

The UI should look like a real Indian Railways control-room / railway intelligence platform suitable for an SIH jury demonstration.

==================================================

1. OVERALL DESIGN

==================================================

Create a professional railway-tech dashboard with:

- Dark navy / charcoal background

- White/light text

- Railway-inspired red accents

- Subtle blue/cyan accents for live data

- Clean cards with glassmorphism used minimally

- Modern typography

- High information density but NOT cluttered

- Smooth animations

- Responsive design for desktop, tablet and mobile

- Professional charts and data visualizations

- Clear hierarchy between LIVE DATA and AI PREDICTIONS

Use a polished enterprise dashboard aesthetic similar to modern aviation/railway operations control systems.

Avoid:

- Excessive gradients

- Cartoonish graphics

- Overly rounded UI

- Huge unnecessary headings

- Fake-looking futuristic interfaces

- Excessive animations

==================================================

2. MAIN DASHBOARD / CONTROL ROOM

==================================================

Create a main page called:

“RailPredict AI”

Subtitle:

“Dynamic ETA Intelligence & Railway Operations Dashboard”

Top navigation:

- Dashboard

- Live Trains

- ETA Prediction

- Network Monitor

- Delay Analytics

- Model Performance

- Alerts

- API / Integration

Top-right:

- LIVE indicator

- Last data update timestamp

- Notification icon

- User/profile icon

==================================================

3. KPI CARDS

==================================================

At the top display:

LIVE TRAINS

Example: 1,248

ON-TIME TRAINS

Example: 78.6%

DELAYED TRAINS

Example: 214

AVG NETWORK DELAY

Example: 18 min

ETA PREDICTION ACCURACY

Example: 91.8%

ACTIVE ALERTS

Example: 17

Each card should contain:

- Large number

- Small descriptive label

- Percentage/change indicator

- Small sparkline chart where appropriate

Make it obvious that these are DEMO/SIMULATED values.

==================================================

4. LIVE TRAIN MAP

==================================================

Create a large interactive railway network map as the central dashboard component.

Show:

- Railway routes

- Stations

- Train markers

- Train direction

- Congested sections

- Delayed sections

- Major railway junctions

Train markers should have different states:

GREEN = On time

YELLOW = Minor delay

ORANGE = Significant delay

RED = Critical delay

Clicking a train marker should open a detail panel containing:

Train Number

Train Name

Current Station

Next Station

Current Speed

Current Delay

Scheduled ETA

AI Predicted ETA

ETA Difference

Distance Remaining

Route Progress

Prediction Confidence

Example:

12951 — Mumbai Rajdhani

Current: Vadodara Junction

Next: Ratlam

Speed: 104 km/h

Current Delay: +18 min

Scheduled ETA: 21:42

AI ETA: 21:31

Prediction Improvement: -11 min

Confidence: 94%

==================================================

5. TRAIN SEARCH

==================================================

Add a prominent search bar:

“Search train number, train name or station...”

Filters:

- Zone

- Train Type

- Delay Status

- Route

- Date

- Prediction Confidence

Search results should show:

Train Number

Train Name

Current Location

Destination

Current Delay

AI ETA

Scheduled ETA

Confidence

Status

Clicking a train opens its detailed prediction page.

==================================================

6. AI ETA PREDICTION PANEL

==================================================

Create a dedicated “AI ETA Prediction” section.

Show:

Scheduled Arrival

Current Estimated Arrival

AI Predicted Arrival

Example:

Scheduled ETA

18:40

Current Railway ETA

18:56

AI Predicted ETA

18:49

Difference

-7 min

Confidence

93%

Add a visual comparison bar showing:

Scheduled → Current ETA → AI Prediction

Clearly explain:

“AI prediction dynamically updates using real-time train movement, historical sectional delays, congestion and operational conditions.”

==================================================

7. UPCOMING STATIONS TABLE

==================================================

For the selected train display:

Station | Scheduled ETA | Current ETA | AI ETA | Delay | Confidence

Example:

Surat

19:10

19:18

19:15

+5 min

95%

Vadodara

20:45

20:58

20:51

+6 min

93%

Ratlam

23:20

23:42

23:31

+11 min

89%

Indore

01:10

01:34

01:21

+11 min

87%

Use visual indicators for delay.

==================================================

8. ETA PREDICTION GRAPH

==================================================

Create an interactive line chart:

X-axis:

Upcoming Stations

Y-axis:

Arrival Time

Lines:

1. Scheduled ETA

2. Current Railway ETA

3. AI Predicted ETA

Use tooltips.

Allow users to hover over stations and see:

Station

Scheduled Time

Predicted Time

Prediction Error

Confidence

==================================================

9. DELAY ANALYTICS

==================================================

Create a dedicated analytics section.

Charts:

A. Delay distribution

- 0–10 min

- 10–30 min

- 30–60 min

- 60+ min

B. Delay by railway zone

C. Delay by time of day

D. Delay by train type

E. Historical vs predicted delay

F. Top delay-causing sections

Example:

Section:

Vadodara → Ratlam

Average Historical Delay:

17 min

Current Delay:

22 min

Predicted Delay:

19 min

==================================================

10. DELAY CAUSE ANALYSIS

==================================================

Create an “Operational Factors” panel.

Show factors affecting ETA:

- Track congestion

- Signal delays

- Preceding train delays

- Station dwell time

- Speed restrictions

- Weather conditions

- Maintenance blocks

- Level crossing delays

- Historical sectional performance

- Recovery time

Use horizontal bars to show estimated contribution.

Example:

Track Congestion       34%

Preceding Train Delay  22%

Station Dwell          16%

Speed Restriction      12%

Weather                 8%

Other                   8%

Label these as model-derived/demo values.

==================================================

11. NETWORK HEALTH

==================================================

Create a railway network monitoring page.

Show:

Network Status:

● Operational

Active Sections:

1,842

Congested Sections:

126

Critical Sections:

18

Average Section Delay:

14.7 min

Create a heatmap-style railway network visualization.

Allow filtering by:

- Railway Zone

- State

- Section

- Severity

- Train density

==================================================

12. ALERT CENTER

==================================================

Create a real-time alert panel.

Example alerts:

🔴 Critical:

High congestion detected between Vadodara and Ratlam.

🟠 Warning:

Train 12951 ETA revised by +8 minutes.

🟡 Operational:

Temporary speed restriction detected.

🔵 Information:

Weather conditions may affect sectional running time.

Each alert should contain:

Time

Train/Section

Severity

Reason

Predicted Impact

Recommended Action

==================================================

13. AI MODEL PERFORMANCE

==================================================

Create a page showing how well the prediction model performs.

KPIs:

MAE

RMSE

Prediction Accuracy

Within ±5 min

Within ±10 min

Within ±15 min

Charts:

- Actual vs Predicted ETA

- Prediction error distribution

- Accuracy by railway zone

- Accuracy by train type

- Accuracy by distance remaining

- Model performance over time

Example:

MAE: 6.8 min

RMSE: 9.4 min

Within ±10 min: 89.2%

Clearly mark these as demo/model evaluation metrics unless connected to a real model.

==================================================

14. PREDICTION CONFIDENCE

==================================================

Every AI ETA prediction should display a confidence score.

Example:

AI ETA

21:31

Confidence

94%

Also show:

Prediction Range:

21:27 – 21:35

This demonstrates that the system understands prediction uncertainty rather than simply displaying one fixed ETA.

==================================================

15. PASSENGER VIEW

==================================================

Create a simplified passenger-facing page.

Passenger enters:

Train Number / Train Name

Then show:

Train 12951

Mumbai Rajdhani

Current Location:

Vadodara Junction

Next Station:

Ratlam

Expected Arrival:

21:31

Scheduled:

21:42

AI Prediction:

11 min earlier than current schedule-adjusted estimate

Status:

On Route

Also show upcoming stations and their predicted arrival times.

The passenger interface should be much simpler than the control-room dashboard.

==================================================

16. STATION DISPLAY SIMULATION

==================================================

Create a page simulating a railway station digital display.

Columns:

Train

Destination

Platform

Scheduled

Expected

Status

Example:

12951 Mumbai Rajdhani

Platform 4

21:42

21:31

Expected

12932 Garib Rath

Platform 2

21:55

22:04

Delayed

This should look like a real railway station LED/display board but modernized.

==================================================

17. DATA PIPELINE VISUALIZATION

==================================================

Create a “How RailPredict AI Works” section.

Show a visual pipeline:

LIVE TRAIN LOCATION

        ↓

OPERATIONAL DATA

        ↓

HISTORICAL DELAY DATA

        ↓

NETWORK CONDITIONS

        ↓

WEATHER / EXTERNAL FACTORS

        ↓

DATA PROCESSING

        ↓

ML / STATISTICAL MODEL

        ↓

DYNAMIC ETA PREDICTION

        ↓

PASSENGER + STATION + CONTROL ROOM

Use animated flow lines.

==================================================

18. TECHNOLOGY / ARCHITECTURE PAGE

==================================================

Create a technical architecture diagram.

Frontend:

React + Tailwind CSS

Backend:

FastAPI / Node.js

Database:

PostgreSQL

ML:

Python + Scikit-learn / XGBoost

Data Processing:

Pandas + NumPy

Maps:

Leaflet / Mapbox

APIs:

REST API

Architecture:

Data Sources

↓

API Gateway

↓

Data Processing Layer

↓

Feature Engineering

↓

ETA Prediction Model

↓

Prediction Service

↓

Dashboard / Passenger App / Station Display

Keep this visually impressive but easy for a jury to understand.

==================================================

19. DEMO DATA

==================================================

Use realistic Indian railway demo data.

Include trains such as:

12951 Mumbai Central – New Delhi Rajdhani

12952 New Delhi – Mumbai Central Rajdhani

12932 Ahmedabad – Mumbai Central Double Decker

12009 Mumbai Central – Ahmedabad Shatabdi

19037 Bandra Terminus – Barauni Avadh Express

Use realistic station names such as:

Mumbai Central

Surat

Vadodara

Ahmedabad

Ratlam

Kota

Delhi

Bharuch

Anand

IMPORTANT:

Do NOT claim that demo data is real-time railway data.

Add a small badge:

“DEMO DATA • SIMULATED LIVE FEED”

Make the application architecture ready to replace simulated data with real APIs later.

==================================================

20. SIMULATION MODE

==================================================

This is VERY IMPORTANT for the SIH demonstration.

Create a “Simulation Mode” toggle.

When enabled:

Train positions move automatically.

Current delays change.

ETA predictions update.

Charts update.

Alerts appear.

Prediction confidence changes.

Add controls:

▶ Start Simulation

⏸ Pause

↻ Reset

Simulation speed:

1x

2x

5x

This will make the prototype impressive during the jury demo.

==================================================

21. INTERACTIVE JURY DEMO FLOW

==================================================

Design the application so we can demonstrate this scenario:

1. Select Train 12951.

2. Show its current location.

3. Show current delay.

4. Show upcoming stations.

5. Show scheduled ETA.

6. Show conventional/current ETA.

7. Show AI predicted ETA.

8. Explain why the AI prediction changed.

9. Show confidence interval.

10. Trigger a simulated congestion event.

11. Show the ETA automatically changing.

12. Show the alert being generated.

13. Show the updated prediction on the map.

14. Show how the passenger view changes.

15. Show model performance metrics.

The entire demo should feel like a real-time AI railway intelligence system.

==================================================

22. UI DETAILS

==================================================

Use:

- Lucide icons

- Interactive charts

- Tooltips

- Hover states

- Smooth transitions

- Skeleton loading states

- Toast notifications

- Status badges

- Responsive tables

- Expandable cards

- Dark/light theme toggle

Use consistent terminology:

“Scheduled ETA”

“Current ETA”

“AI Predicted ETA”

“Prediction Confidence”

“Current Delay”

“Historical Delay”

“Network Congestion”

“Operational Impact”

==================================================

23. IMPORTANT PRODUCT POSITIONING

==================================================

The dashboard should communicate three major capabilities:

1. PREDICT

AI predicts arrival time dynamically.

2. EXPLAIN

The system explains which factors are affecting the prediction.

3. RESPOND

The system updates ETA and generates alerts when conditions change.

Make these three capabilities visually prominent on the dashboard.

==================================================

24. TECHNICAL REQUIREMENTS

==================================================

Build this as a functional frontend prototype, not just static mockups.

Use:

React

Vite

Tailwind CSS

Recharts

Lucide React

Leaflet for maps if practical

Use reusable components.

Create clean component structure.

Use mock JSON data stored separately so it can later be replaced with APIs.

Do NOT hardcode every UI element into one huge component.

Create reusable components such as:

Navbar

Sidebar

KPICard

TrainMap

TrainSearch

TrainDetails

ETAPredictionCard

PredictionChart

StationTable

DelayAnalytics

AlertPanel

NetworkHealth

ModelPerformance

PassengerView

StationDisplay

SimulationControls

==================================================

25. FINAL DESIGN GOAL

==================================================

The final result should look like:

“An AI-powered Railway Operations Intelligence Platform”

rather than:

“a normal train tracking website.”

The most important visual element should be the difference between:

SCHEDULED ETA

vs

CURRENT ETA

vs

AI PREDICTED ETA

The jury should immediately understand:

“Instead of simply telling us where the train is, this system predicts where and when the train will actually arrive, continuously updates that prediction, explains why it changed, and communicates the result to passengers and railway operations.”

Make the UI polished enough for a Smart India Hackathon 2026 final-round demonstration.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a579a528-2f12-4fe8-9677-550976e46cd0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
