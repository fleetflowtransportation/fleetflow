# Organization Owner Account Protection & Settings UI Simplification

Protect the primary organization owner account from accidental deletion and streamline the Settings page by removing internal database testing and diagnostic log panels from the UI.

### User Review & Critical Decisions

> [!IMPORTANT]
> The primary tenant owner (the original registered administrator for each organization) will be safeguarded:
> - **Owner Protection**: Owner accounts display an "Owner" badge and have their Delete button disabled (only editing details/passwords is allowed).
> - **Settings Simplification**: The raw Supabase Cloud Database panel and Calendar Diagnostic Logs table are removed from the Settings UI to keep the interface focused on operational fleet management and Google Workspace integrations.

- **Confirmed Decision**: The organization owner account will display an "Owner" badge with the delete button disabled.
- **Backend Safety**: Database/context delete operations will explicitly prevent deleting the primary organization owner.

---

## 1. Overview & Core Concept

- **What It Does**: 
  1. Ensures that every organization's founding admin/owner account is protected from deletion so organization access is never lost.
  2. Simplifies the **Settings & Integrations** page by removing technical database testing panels and raw calendar diagnostic log monitors, presenting a clean and user-friendly interface.
- **Target Audience**: Organization Administrators and Fleet Managers.
- **Key Value**: Prevents accidental lockouts from organization accounts while providing an uncluttered, professional Settings experience.

---

## 2. User Experience & Visual Design

### A. User Management (`UserManagement.tsx` & `UserForm.tsx`)
- **Owner Badge**: Primary organization administrators display an "Owner" badge alongside their role.
- **Disabled Delete Control**: For owner accounts, the Delete button is visually disabled (`opacity-40 cursor-not-allowed`) with an informative tooltip (`Organization Owner (Cannot be deleted)`).
- **Safe Editing**: Editing owner details (Name, Contact, Phone, Address, Password) remains fully accessible; role downgrade or account deactivation is prevented to preserve login access.
- **Subsequent Users**: Staff and drivers added later can be deleted or edited as normal.

### B. Settings & Integrations (`IntegrationsSettings.tsx`)
- **Removed**: Supabase Cloud Database connection cards, credentials modal, and raw diagnostic log console.
- **Retained & Streamlined**: 
  - Organization Profile settings (Company details, PIC, address, registration).
  - Google Calendar Integration (Calendar ID & Sync).
  - Google Drive Folder ID & Apps Script Webhook.
  - Public Booking & Driver Roster links.
  - Apps Script Code Generator modal with copy-to-clipboard functionality.

---

## 3. Key Product Decisions & Trade-Offs

- **Owner Identification Strategy**:
  - *Chosen Approach*: Identify the owner via `isOwner: true` flag in the User model, automatically designated for the founding admin during organization registration or default primary admin.
  - *Why*: Clear, explicit, and deterministic across reloads without requiring complex database schema migrations.
- **Settings UI Cleanup**:
  - *Chosen Approach*: Keep Supabase credentials and health check logic in background utility services while removing raw DB credential fields and technical diagnostic logs from the user-facing UI.
  - *Why*: Eliminates clutter and prevents confusion for end users while retaining automated database connectivity.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       SettingsView                          │
├──────────────────────────────┬──────────────────────────────┤
│      User Management         │    Integrations & System     │
│  ┌────────────────────────┐  │  ┌────────────────────────┐  │
│  │ Owner: [Edit] [Disabled]│  │  │ Google Calendar & Drive │  │
│  │ Driver: [Edit] [Delete]│  │  │ Public Booking Link    │  │
│  │ Staff:  [Edit] [Delete]│  │  │ Apps Script Webhook    │  │
│  └────────────────────────┘  │  └────────────────────────┘  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
    ┌──────────────────────┐      ┌──────────────────────┐
    │  deleteUser Guard    │      │  Background DB Sync  │
    │ (Blocks Owner Delete)│      │  (Supabase Singapore)│
    └──────────────────────┘      └──────────────────────┘
```

### Component & State Mapping:
- **`types.ts`**: Update `User` interface with `isOwner?: boolean`.
- **`services/storage.ts`**:
  - Set `isOwner: true` for the primary admin in `signUpTenant` and when loading tenant users.
  - Guard `deleteUser` against deleting tenant owners.
- **`components/UserManagement.tsx`**:
  - Render Owner badge and disable the Delete button for owner accounts.
- **`components/UserForm.tsx`**:
  - Enforce active admin status for owner accounts during edits.
- **`components/IntegrationsSettings.tsx`**:
  - Clean up database test cards and calendar diagnostic logs from the UI.
