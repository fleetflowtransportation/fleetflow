# Implementation Plan: Compact Collapsible Fleet Odometer Reference

Convert the "Fleet Vehicles & Last Recorded Odometers" section into a sleek, space-saving collapsible toggle banner. Completely remove the "Log Meter for..." action buttons so the section functions strictly as a compact, read-only reference without cluttering the Driver Dashboard.

---

## 1. UI & UX Architecture

### Collapsible Header Banner (Default State: Collapsed)
- **Minimal Footprint**: A single, clean card (~44px–48px tall) with rounded corners, subtle border, and soft hover effect.
- **Header Elements**:
  - Gauge icon in a soft indigo container.
  - Title: **Fleet Vehicle Odometers** with a small badge displaying `{vehicles.length} Vehicles`.
  - Right indicator: Interactive toggle badge with label (`"Show"` / `"Hide"`) and an animated `ChevronDownIcon` / `ChevronUpIcon`.
- **Space Savings**: Frees up vertical screen space so drivers immediately see today's booking cards upon opening the portal.

### Expanded State (When Tapped)
- Smooth expansion displaying a compact, high-contrast grid of vehicle reference tiles.
- **Each Compact Tile Contains**:
  - **License Plate**: Clean automotive black plate badge (`bg-slate-900 text-white font-mono font-bold text-xs px-2 py-0.5 rounded`).
  - **Vehicle Name**: Truncated readable name with truck icon.
  - **Vehicle Status**: Subtle status pill/dot (Active or Under Maintenance).
  - **Mileage Value**: Crisp, bold number e.g. `142,500 KM`.
  - **Last Updated Date**: Small secondary text (e.g. `Updated 02 Oct 2026`).
  - **NO Action Buttons**: All "Log Meter for..." buttons are completely removed.

---

## 2. Changes to `components/DriverDashboard.tsx`

1. Add state:
   ```tsx
   const [isFleetOdoExpanded, setIsFleetOdoExpanded] = useState(false);
   ```
2. Replace the large fleet vehicle section with:
   - An interactive header that toggles `isFleetOdoExpanded`.
   - A conditional or animated collapsible container rendering the compact read-only vehicle tiles without action buttons.
3. Keep the Floating Speed Dial (+ button) as the unified place to log odometers, fuels, issues, and feedbacks.

---

## 3. Verification & Testing

1. **Space Savings**: Verify the Driver Dashboard is compact on mobile viewports and bookings are immediately visible without excessive scrolling.
2. **Toggle Behavior**: Verify clicking anywhere on the header expands and collapses the vehicle list smoothly.
3. **Information Integrity**: Verify plate numbers, vehicle names, latest kilometer readings, and status indicators render correctly.
4. **Code Quality**: Verify with `lint_applet` and `compile_applet` with zero TypeScript errors.
