# Fleet Vehicle Fuel Tank Capacity & Comprehensive Fuel Analytics Suite

Implement vehicle fuel tank capacity (liters) configuration and an advanced, enterprise-grade Fuel & Efficiency analytics suite in FleetFlow to transform raw fuel receipts and odometer logs into actionable operational intelligence.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following core design decisions were confirmed via interactive consultation:

- **Confirmed Decision 1 (Analytics Scope)**: Deploy a **Comprehensive Suite with All Fuel Metrics**, including estimated remaining driving range (km), tank fullness levels (%), true consumption (L/100km & km/L), cost per km (RM/km), refuel volume vs. tank capacity sanity checks, and sudden consumption anomaly alerts.
- **Confirmed Decision 2 (Data Configuration)**: Vehicle fuel tank capacity is configured per vehicle in **Liters (L)** within Step 3 of the **Vehicle Profile / Vehicle Form**, equipped with quick-fill presets based on vehicle category (e.g. 50L for Sedan, 70L for Van/Hiace, 100L for Lorry).
- **Confirmed Decision 3 (Interface Location)**: Delivered in a dedicated **Fuel & Efficiency Analytics** workspace inside the **Reports** module, accessible to fleet managers alongside trip odometer audit logs.

---

### 1. Overview & Core Concept

- **What It Does**: Enhances the fleet management system with tank capacity awareness. Fleet managers and supervisors can specify exact fuel tank capacities for every vehicle in the fleet. The analytics engine combines tank volume with historical odometer entries and fuel purchase logs to estimate real-time vehicle range, detect abnormal refuels (such as receipts exceeding physical tank limits or sudden drops in fuel economy), and deliver precision cost-efficiency breakdowns per vehicle and per driver.
- **Target Audience / Persona**: Fleet managers, logistics coordinators, accountants, and drivers monitoring vehicle readiness and operational operating costs.
- **Key Value**:
  - Eliminates fuel theft / receipt tampering risks through tank capacity sanity checks.
  - Improves dispatch safety by knowing estimated range autonomy before assigning long-distance trips.
  - Optimizes maintenance scheduling by flagging vehicles with degrading fuel efficiency (>15% drop from baseline).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Vehicle Tank Setup*: When adding or editing a vehicle in `VehicleForm`, the user enters the fuel tank capacity in Liters (with one-click suggestion chips: `45L`, `55L`, `70L`, `100L`).
  2. *Refuel Entry Validation*: When entering fuel logs in `FuelLogForm`, entering liters greater than the vehicle's tank capacity immediately triggers an advisory warning (*"Warning: 85L exceeds vehicle tank capacity of 70L"*).
  3. *Fuel Analytics Exploration*: Navigating to `Reports > Fuel & Efficiency` presents:
     - **Fleet Fuel Overview Strip**: Total fuel expenditure, fleet average efficiency (km/L & L/100km), active vehicles tracked, and detected anomaly alerts.
     - **Vehicle Tank & Autonomy Gauges**: High-contrast, interactive cards showing each vehicle's physical tank capacity, estimated current fuel level, and projected remaining driving range (km).
     - **Refuel Volume & Tank Utilization Chart**: Chronological timeline of refills mapped against vehicle capacity limits.
     - **Anomaly & Risk Feed**: Clear, unboxed tabular log highlighting any overfills or steep efficiency drops (>15% deviation).
     - **Trip Cost & Autonomy Estimator**: Interactive calculator allowing dispatchers to simulate route distance and view estimated fuel liters needed and cost for any vehicle.

- **Visual Identity & Theme**:
  - *Design System*: Follows the SaaS & Dashboard visual constitution (neutral dark slate `#0F172A` / clean `#FFFFFF` canvas, `border border-slate-200/80` hairline dividers, single-elevation depth).
  - *Typography*: Clean sans display pairings (`Plus Jakarta Sans` / `DM Sans`), strictly enforcing monospace tabular figures (`font-mono tabular-nums`) for all volumes (L), distances (km), rates (RM/km), and currency values.
  - *Zero-Pill Discipline*: Unboxed metadata with quiet typographic separators (`·`, `/`) instead of candy badge sandwiches.
  - *Palette*:
    - Nominal / High Efficiency: Emerald (`text-emerald-700 bg-emerald-50/70 border-emerald-200/80`)
    - Warning / Near Empty / Moderate Drop: Amber (`text-amber-700 bg-amber-50/70 border-amber-200/80`)
    - Alert / Overfill / Anomaly: Crimson (`text-rose-700 bg-rose-50/70 border-rose-200/80`)
    - Primary Accents: Indigo / Slate (`text-indigo-600 bg-indigo-50/50`)

- **Interactive Feedback & Empty States**:
  - Rich shimmer skeleton loaders matching exact metric card geometry during data loading.
  - Informative empty states when a vehicle has no tank capacity configured, with a 1-click `"Configure Tank Capacity"` direct action button.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Graceful Tank Capacity Fallback**:
  - *Chosen Approach*: If a vehicle's tank capacity has not yet been specified, default to a category-based baseline estimate (e.g. Sedan = 50L, Van = 70L, Lorry = 100L) with a visual indicator prompting the user to confirm the exact value.
  - *Why*: Prevents analytics breakdown or divide-by-zero errors for existing fleets while encouraging data completeness.
  - *Alternatives Considered*: Blocking analytics until all vehicles are manually updated (rejected as disruptive to daily operations).

- **Decision 2: Refuel Volume vs. Full Tank Validation (Soft Warning)**:
  - *Chosen Approach*: Soft warning and flagged anomaly status rather than hard blocking form submission.
  - *Why*: Real-world edge cases exist (e.g. filling extra jerrycans for heavy machinery or remote trips); flagging as an anomaly preserves data while giving managers transparency.

- **Decision 3: Range & Fuel Level Estimation Algorithm**:
  - *Chosen Approach*: Combine the vehicle's rolling median km/L efficiency with the last known refuel date/odometer and subsequent trip logs to project realistic remaining range and tank level.
  - *Why*: Significantly more accurate than static manufacturer claims, reflecting real driver habits and vehicle load conditions.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FLEETFLOW APP STATE                           │
│  AppContext (Vehicles, FuelLogs, OdometerLogs, Bookings, Users)        │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌────────────────────────────────────┐ ┌─────────────────────────────────┐
│     Vehicle Form & Management      │ │   Fuel & Efficiency Analytics   │
│  - fuelTankCapacityLiters (number) │ │   Engine (Reports Module)       │
│  - Quick presets (45, 55, 70, 100) │ │                                 │
│  - Realtime validation on edit     │ │  ┌───────────────────────────┐  │
└────────────────────────────────────┘ │  │  Derived Metrics Pipeline │  │
                                       │  │  - Chronological Sorting  │  │
                                       │  │  - Tank Fullness (%)      │  │
                                       │  │  - Range Remaining (KM)   │  │
                                       │  │  - True km/L & L/100km    │  │
                                       │  │  - Overfill & Drop Audits │  │
                                       │  │  - Cost / KM (RM)         │  │
                                       │  └─────────────┬─────────────┘  │
                                       │                │                │
                                       │  ┌─────────────▼─────────────┐  │
                                       │  │ UI Visualizations:        │  │
                                       │  │ - Fleet Summary KPIs      │  │
                                       │  │ - Vehicle Autonomy Gauges │  │
                                       │  │ - Refuel Sanity Feed      │  │
                                       │  │ - Trip Cost Estimator     │  │
                                       │  └───────────────────────────┘  │
                                       └─────────────────────────────────┘
```

#### A. Data Model Enhancements (`types.ts`)
- Add `fuelTankCapacityLiters?: number;` to the `Vehicle` interface.
- Add `tankCapacityLiters?: number;`, `estimatedRemainingRangeKm?: number;`, `tankFullnessPercent?: number;`, and `isOverfillAnomaly?: boolean;` to `DerivedFuelMetric`.

#### B. Component Modifications
1. `types.ts`: Update `Vehicle` and metric types.
2. `components/VehicleForm.tsx`: Add field `fuelTankCapacityLiters` to Section 3 (Technical & Fuel Specifications) with numeric input and quick-suggestion badges.
3. `components/VehicleManagement.tsx`: Render fuel tank capacity in vehicle detail view and vehicle table chips.
4. `components/FuelLogForm.tsx` & `components/FuelAnalyticsDashboard.tsx`: Add tank capacity sanity checks and warning indicators when entered liters exceed vehicle capacity.
5. `components/FuelAnalyticsDashboard.tsx` & `components/Reports.tsx`:
   - Upgrade the Fuel Analytics Dashboard with the comprehensive suite:
     - Real-time vehicle fuel tank fullness meters.
     - Projected remaining range calculations based on current odometer and fuel delta.
     - Refuel volume sanity checks (detecting overfill anomalies).
     - Vehicle efficiency leaderboards (best/worst km/L).
     - Interactive Trip Fuel Cost & Autonomy Estimator.
