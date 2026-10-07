# Professional Browser URL Routing & Deep-Linking Navigation Plan

Implement standard, clean browser URL paths (e.g. `/dashboard`, `/bookings`, `/calendar`, `/reports`, `/maintenance`, `/vehicles`, `/settings`, `/book`, `/odometer`) with full browser history (Back / Forward button) and deep-link bookmarking support across all desktop and mobile devices.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> We will upgrade the navigation architecture so each page and module has its own distinct, clean URL path:
> 1. **Clean Route Structure**:
>    - `/dashboard` → Main Fleet Analytics & Activity
>    - `/bookings` → Dispatch & Booking Management List
>    - `/calendar` → Interactive Live Trip Schedule Calendar
>    - `/reports` / `/fuel` → Fuel, Mileage & Odometer Reports
>    - `/maintenance` → Maintenance Schedules & Issue Tracker
>    - `/vehicles` → Fleet Vehicles & Road Tax / Insurance Expiries
>    - `/users` → Drivers & Staff User Management
>    - `/schedule` → Driver Duty Roster & Leave Planner
>    - `/settings` (and `/settings/integrations`) → Organization & Google Sync Settings
>    - `/driver` → Dedicated Driver Portal View
>    - `/book` (or `/book?tenant_id=...`) → Public Reservation Form
>    - `/odometer` (or `/odometer?tenant_id=...`) → Public Driver Odometer Submission Form
> 2. **Browser Back & Forward Buttons (`popstate`)**: Full mobile swipe-back and browser Back/Forward navigation support.
> 3. **Backward Compatibility**: Existing query URLs (`?action=book`, `?action=odometer`) and QR codes will continue to work seamlessly.

- **Confirmed Decision**: Implement clean URL routing, browser history integration, and bookmarkable deep links.

---

### 1. Overview & Core Concept

- **What It Does**:
  - Updates the browser address bar dynamically as users switch between tabs and views.
  - Allows managers and drivers to bookmark or share exact links directly (e.g. sending `https://armadaflow.vercel.app/calendar` or `https://armadaflow.vercel.app/reports` in a message).
  - Enables smooth back-button navigation on mobile smartphones without exiting the web app.
- **Target Audience / Persona**: All fleet managers, dispatchers, drivers, and external booking staff.
- **Key Value**: Professional SaaS user experience matching modern web apps like SimplyFleet, Notion, and Google Calendar.

---

### 2. User Experience & Visual Design

- **Address Bar Feedback**:
  - Visiting `/calendar` opens the calendar immediately.
  - Visiting `/reports` opens fuel and odometer reports directly.
  - Visiting `/settings/integrations` opens the Super Admin Google Drive & Calendar configuration directly.
- **Navigation Interaction**:
  - Zero page-flicker or full-page reload on route changes (smooth client-side transition $< 50\text{ms}$).
  - Active navigation state in the Header reflects the current URL path.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native HTML5 History Router vs. Heavy External Router Library**
  - *Chosen Approach*: Lightweight HTML5 History API (`window.history.pushState` + `popstate` listener + route parser).
  - *Why*: Zero additional bundle overhead, 100% compatible with existing Vite SPA setup and Vercel hosting, and supports existing query parameters without breaking legacy links.
- **Decision 2: Automatic Role Guarding & Fallback**
  - *Chosen Approach*: If an unauthenticated user or driver visits an admin-only path (`/settings`), the router gracefully redirects to `/login` or `/driver`.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Address Bar                    │
│   (e.g. /dashboard, /calendar, /reports, /settings/vehicles)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  App Navigation & Route Parser              │
│   - Reads window.location.pathname & search parameters      │
│   - Listens to 'popstate' for browser back/forward buttons  │
│   - Exports navigate(path) helper for Header & Links        │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
┌────────────────────┐┌─────────────────┐┌────────────────────┐
│   Admin Views      ││   Driver View   ││   Public Portals   │
│ - /dashboard       ││ - /driver       ││ - /book            │
│ - /bookings        ││                 ││ - /odometer        │
│ - /calendar        ││                 ││ - /calendar        │
│ - /reports         ││                 ││                    │
│ - /maintenance     ││                 ││                    │
│ - /settings/*      ││                 ││                    │
└────────────────────┘└─────────────────┘└────────────────────┘
```

- **Implementation Details**:
  1. Add route resolution and `navigate` helper in `App.tsx` and `Header.tsx`.
  2. Map routes to respective components and sub-tabs.
  3. Ensure Vercel / dev server single-page app rewrites work seamlessly.
