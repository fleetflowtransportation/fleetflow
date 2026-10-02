# Armada Flow User & Driver Feedback System (Google Sheets & Developer Email Alert)

A universal feedback submission button and modal form for both Admin and Driver portals in **Armada Flow** that collects structured ratings, categories, suggestions, and auto-captured telemetry, directly syncing to Google Sheets and instantly firing an email notification to the developer (`aziznurmin@gmail.com`).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Specifications & Revisions:**
> - **System Branding**: All system name references updated to **Armada Flow**.
> - **Destination**: Direct Google Apps Script Webhook URL / Google Form endpoint (pre-configured with instant email notification to `aziznurmin@gmail.com` via `MailApp.sendEmail()` upon every submission).
> - **Developer Email Alert**: Automated formatted HTML email dispatched directly to `aziznurmin@gmail.com` featuring submission timestamp, user role, category, star rating, feedback title, full message body, and direct Google Sheet link.
> - **Trigger Button**: Persistent Floating Action Button (FAB) anchored at the bottom-right corner across both Admin Portal and Driver Portal in Armada Flow.
> - **Form Fields**: Category selector, 1–5 Star rating, Feedback Title, Detailed Message/Suggestion, with automatic capture of User Name, Email, Role, Current Portal Route, Device/Browser metadata, and Timestamp.
> - **Zero Page Refresh**: Form state is isolated in an unmounted/mounted modal lifecycle using React asynchronous `fetch` (with `no-cors` mode support for Google Apps Script Webhooks) and resilient local queue fallback so user input is never lost if interrupted.

---

## 1. Overview & Core Concept

- **What It Does**: Adds an accessible, non-intrusive Feedback button accessible to both fleet administrators and drivers in Armada Flow. Clicking opens a modal form allowing users to submit ratings, bug reports, feature requests, and operational feedback. The data is dispatched asynchronously to a Google Sheet AND instantly triggers an email alert to `aziznurmin@gmail.com` without interrupting the active workflow or refreshing the page.
- **Target Audience**:
  - **Fleet Administrators**: Share feedback on dispatching, fuel analytics, vehicle assignment, and reporting features in Armada Flow.
  - **Drivers**: Submit quick field feedback regarding trip logging, vehicle conditions, odometer forms, and mobile usability.
  - **Developer (`aziznurmin@gmail.com`)**: Receives real-time email notifications for instant issue triage and feature prioritization while maintaining an organized audit sheet in Google Sheets.
- **Key Value**: Provides an ongoing communication channel from operators and drivers directly into the administrator's Google Sheet and developer's inbox for continuous system improvement.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Admin / Driver Screen in Armada Flow]
       │
       ▼ (Clicks Floating "Feedback" Button at Bottom Right)
[Feedback Modal Dialog] ──▶ (Fills Category, 1-5 Star Rating, Title, Details)
       │
       ▼ (Clicks "Submit Feedback")
[Async Webhook Dispatch]
       │
       ├──▶ [Google Sheet Ledger (Appends new row)]
       └──▶ [Automated Developer Email to aziznurmin@gmail.com]
       │
       ▼ (Modal Closes with Success Toast; User returns seamlessly to active task without page reload)
```

1. **Floating Trigger Button**:
   - Clean, round or pill button fixed at `bottom-6 right-6` with subtle z-index (below high-priority modals, above page content).
   - Features a messaging icon and "Feedback" text label (compact icon on small mobile screens).
   - Styled with Armada Flow primary indigo/slate accents, hover micro-elevation, and subtle tooltip.

2. **Modal Form Composition**:
   - **Header**: "Share Feedback for Armada Flow" with close (X) button and short subtitle explaining the purpose.
   - **Role & Identity Preview**: Display-only badge showing logged-in user (`John Driver · Driver Portal` or `Admin · Dispatch Portal`).
   - **Category Segmented Grid**:
     - 🐛 Bug / Issue
     - 💡 Feature Request
     - ⚡ System & Speed
     - 🚗 Driver Experience
     - 💬 General Feedback
   - **1–5 Star Rating Control**: Interactive star rating with hover highlight and verbal indicator (`Poor`, `Fair`, `Good`, `Great`, `Exceptional`).
   - **Feedback Title**: Input field with placeholder (e.g., *"Make odometer entry faster on mobile"*).
   - **Detailed Message**: Textarea with character counter and auto-expand.
   - **Recipient & Ledger Footnote**: Quiet footnote indicating *"Submissions sync live to Google Sheets & alert developer (`aziznurmin@gmail.com`)"*.
   - **Action Bar**: "Cancel" and "Send Feedback" with spinner loading state while dispatching.

3. **Google Sheets & Email Webhook Configuration in Admin Settings**:
   - Add a dedicated **Feedback & Developer Notifications** section in `SettingsView.tsx`.
   - Displays developer alert email (`aziznurmin@gmail.com`) and Google Apps Script Webhook URL.
   - Includes a 1-click **Copy Google Apps Script Template** button containing the complete Google Apps Script code (which handles Sheet appending + `MailApp.sendEmail()` to `aziznurmin@gmail.com` with `[Armada Flow Feedback]` subject).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Google Apps Script Webhook with Built-in `MailApp.sendEmail()`**
  - *Chosen Approach*: The Google Apps Script web app acts as the single unified handler: it appends the feedback row into Google Sheets and simultaneously calls `MailApp.sendEmail()` to deliver an immediate formatted email alert to `aziznurmin@gmail.com`.
  - *Why*: Eliminates the need for a separate third-party email service while ensuring 100% deliverability from Google's infrastructure directly to your Gmail inbox.
  - *Alternatives Considered*: Client-side mailto links (interrupts UX by opening user's local email app) or dedicated SMTP servers (requires API keys and ongoing server costs).

- **Decision 2: Form Resilience & Zero-Refresh Policy**
  - *Chosen Approach*: Pure React controlled state inside a managed modal component with `event.preventDefault()` on form submit, optimistic submission feedback, and local queue caching if offline.
  - *Why*: Prevents any browser navigation or form submission page reload, preserving whatever task the driver or admin was working on.

---

## 4. Technical Architecture & Data Strategy

### Component & System Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Armada Flow Container                           │
│  ┌───────────────────────────┐      ┌───────────────────────────────┐  │
│  │   Admin Portal Routes     │      │     Driver Portal Routes      │  │
│  │  (Bookings, Fuel, Odo...) │      │ (My Trips, Odometer, Renewal) │  │
│  └─────────────┬─────────────┘      └──────────────┬────────────────┘  │
│                │                                   │                   │
│                └─────────────────┬─────────────────┘                   │
│                                  │                                     │
│                                  ▼                                     │
│                  ┌───────────────────────────────┐                     │
│                  │     UniversalFeedbackWidget   │                     │
│                  │  • Floating Action Button     │                     │
│                  │  • FeedbackModal Dialog       │                     │
│                  │  • Form Validation & Rating   │                     │
│                  └───────────────┬───────────────┘                     │
│                                  │                                     │
│                                  ▼                                     │
│                  ┌───────────────────────────────┐                     │
│                  │      feedbackService.ts       │                     │
│                  │  • Payload Construction       │                     │
│                  │  • Developer Email Target     │                     │
│                  │  • Google Webhook POST        │                     │
│                  │  • Local Storage Backup Queue │                     │
│                  └───────────────┬───────────────┘                     │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │ HTTP POST (JSON / URLSearchParams)
                                   ▼
            ┌─────────────────────────────────────────────┐
            │         Google Apps Script Webhook          │
            │           (Attached to Google Sheet)        │
            │                                             │
            │  1. Appends row to Google Sheet:            │
            │     [Timestamp, User, Role, Category,       │
            │      Rating, Title, Details, Route, Device] │
            │                                             │
            │  2. Fires MailApp.sendEmail():              │
            │     To: aziznurmin@gmail.com                │
            │     Subject: [Armada Flow Feedback] ...     │
            │     HTML Summary Card with Full Details     │
            └─────────────────────────────────────────────┘
```

### Data Payload Schema (Sent to Google Sheet & Developer Email)

| Field Name | Type | Example Content | Description |
| :--- | :--- | :--- | :--- |
| `timestamp` | ISO String / Formatted | `2026-10-02 10:15:00` | Date and time of submission |
| `systemName` | String | `Armada Flow` | System brand identifier |
| `developerEmail` | String | `aziznurmin@gmail.com` | Notification recipient email |
| `userName` | String | `Ahmad Razif` | Name of user |
| `userEmail` | String | `ahmad@armadaflow.org` | User email |
| `userRole` | String | `driver` or `admin` | User permission role |
| `category` | String | `Feature Request` | Selected category |
| `rating` | Number (1–5) | `5` | Star satisfaction rating |
| `title` | String | `Add quick odometer button` | Feedback subject |
| `message` | String | `Would love a one-tap button...` | Detailed feedback |
| `currentRoute` | String | `/driver/odometer` | Path/view active when opened |
| `deviceInfo` | String | `Mobile (Chrome / Android 14)` | Browser/platform context |
| `tenantId` | String | `armada-flow-transport` | Multi-tenant identifier |

---

## 5. Next Steps Upon Plan Approval

1. Update system branding to **Armada Flow** across the application navigation, headers, and metadata.
2. Create `services/feedbackService.ts` containing the webhook dispatcher, developer email config (`aziznurmin@gmail.com`), default Google Apps Script template with `MailApp.sendEmail()`, and fallback local backup queue.
3. Create `components/FeedbackModal.tsx` containing the interactive modal form, star ratings, category grid, and validation.
4. Create `components/FeedbackButton.tsx` (Floating Action Widget) and mount it seamlessly in `App.tsx` and `DriverDashboard.tsx`.
5. Add the **Google Sheets & Developer Notification Integration** configuration section in `SettingsView.tsx` with copyable Apps Script setup instructions.
6. Verify build integrity via `compile_applet` and test form submissions.
