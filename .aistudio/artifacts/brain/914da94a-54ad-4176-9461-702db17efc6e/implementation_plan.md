# Implementation Plan - Driver Mobile UI Optimization

Optimize card layouts, spacing, touch targets, and visual hierarchy specifically for mobile viewports in the Driver Portal (`DriverDashboard.tsx`, `DriverScheduleManager.tsx`, and associated modal forms).

## Proposed Changes

### 1. Driver Dashboard Layout & Spacing (`components/DriverDashboard.tsx`)
- **Header & Metrics Strip**: Restructure header padding and metrics counters into responsive single/two-row grids optimized for small screens (iPhone/Android portrait).
- **Quick Utility Actions**: Refine grid spacing (`grid-cols-2 sm:grid-cols-4 gap-2`) with larger touch targets and clearer icons for mobile thumbs.
- **Fleet Vehicles Odometer Cards**: Optimize card padding (`p-3 sm:p-4`), text truncation, and action button positioning so numbers don't wrap awkwardly on narrow mobile screens.
- **Trip Card Layouts**: Streamline trip details, pickup/dropoff route steps, and action buttons (`Accept`, `Log Odo`, `Complete`) with comfortable vertical stacking on mobile devices.

### 2. Driver Schedule & Calendar (`components/DriverScheduleManager.tsx`)
- Ensure calendar grid and daily trip items stack gracefully on mobile screens without horizontal clipping.

### 3. Verification
- Compile applet (`compile_applet`) and verify build succeeds.
