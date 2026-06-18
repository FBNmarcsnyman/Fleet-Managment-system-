# FBN Fleet — Architecture Baseline

_Snapshot of the live system as of 2026-06-18. Maintained as the reference for any structural change._

## Stack & deploy
- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind. SPA.
- **Backend:** Supabase project `kyosepbdxjwugunylvyo` ("fbn-fleet"), org `00000000-0000-0000-0000-000000000001` — Postgres + Auth + Storage + Edge Functions + pg_cron.
- **Live host:** Cloudflare Workers — `fleet-managment-system.marcsnyman.workers.dev`, auto-built from **`main`** (config `wrangler.jsonc`, assets = `./dist`). A Vercel mirror also exists. 
- **Branch model:** work on `migration/supabase`; deploy = promote to `main` (`git push origin migration/supabase:main`) → Cloudflare rebuilds. Verify by CONTENT (grep the live bundle), not bundle hash.
- **Pre-commit:** `npx tsc --noEmit` + `npx vite build` must pass.

## Routing (App.tsx → currentView)
Top-level views, each gated by a permission (sidebar `components/shared/navConfig.tsx`):

| view | component | permission |
|---|---|---|
| management | ManagementPortal | access_management |
| fleet | FleetPortal | access_fleet |
| fuel | FuelPortal | access_fuel |
| operations (Broking) | OperationsPortal | access_operations |
| partners (Clients & Subbies) | PartnersPortal | access_operations |
| quotes | QuotesPortal | access_operations |
| workshop | WorkshopPortal | access_workshop |
| finance | FinancePortal | access_finance |
| incidentManagement | IncidentManagement | access_incidents |
| hr | HRPortal | access_hr |
| userManagement | UserManagement | access_user_management |
| settings | Settings | access_settings |
| driverDashboard | DriverDashboard | (role Driver) |

**Public, no-login routes** (query param): `?track=` (client tracking), `?accept=` (carrier accept), `?update=` (supplier portal), `?pod=` (POD upload), `?viewQuote=`, `?tcs=`, `?checklist=`. Served by the `load-public` / `submit-pod` edge functions.

## State (React Context, contexts/)
- **AuthContext** — login (email/password + Google OAuth, domain-restricted), permissions, role→module matrix (`role_permissions`), per-user override. Profile loaded via `directSelect` (freeze-proof).
- **RawDataContext** — master reducer; hydrates ALL tables on init via `hydrateFromSupabase()` using `directSelect` (freeze-proof).
- **OperationsContext** — LoadCon create/update/status + all the email/WhatsApp senders + clients/suppliers/quotes.
- **FleetContext** — vehicles+health, fuel entries+cost, service status, CPK/consumption (`vehiclePerformanceMap`), bowsers/refills.
- **WorkshopContext** — job cards, parts/tyres, POs, planned services.
- **CommonDataContext** — add/update user (via admin edge fns), nav prefs, notifications.
- **UIContext** — currentView, per-portal sub-tabs, modal state, toasts.

### Freeze-proof write layer (lib/supabase.ts) — CRITICAL
The supabase-js client can *wedge* (the #1 historical bug). Everything user-triggered uses plain-fetch helpers that read the token from localStorage and can't wedge:
`directInsert` / `directUpdate` / `directDelete` / `directSelect` / `directInvoke` / `invokeFn` (drop-in for `supabase.functions.invoke`). `send-email` calls MUST use `invokeFn`.

## Edge functions (supabase/functions, all deployed)
- **send-email** — Gmail SMTP. Normalises to/cc (splits comma/semicolon lists → separate addresses), honours TEST MODE, logs to `email_log` + injects open-pixel.
- **send-whatsapp** — Twilio (sandbox). TEST MODE redirect. Optional load logging.
- **email-open** — 1×1 pixel → stamps `email_log.opened_at`.
- **load-public** — public track / accept / request / status (supplier portal). Notifies client + driver on status; logs status; "loaded" confirmation (packages/issues).
- **whatsapp-inbound** — driver chatbot state machine; advances status; logs `whatsapp_messages`; notifies client + supplier.
- **whatsapp-chase** — cron: driver nudges + supplier delivery-ETA chase.
- **ops-daily-checks** — cron: daily compliance/POD/collections digest to admins.
- **submit-pod** — POD upload → storage + Drive filing + notify client (POD attached) + supplier + driver.
- **drive-file** — files PDFs/PODs to company Google Drive (Year/Month/Branch/LoadCon folders) via service account.
- **fuel-sheet-sync** — reads a Google Drive folder of monthly fuel sheets, imports current month, dedup-safe.
- **admin-create-user** / **admin-update-user** — service-role user management.

## Scheduled jobs (pg_cron + pg_net)
- `whatsapp-chase-30min` (*/30) · `ops-daily-checks` (daily 05:00 UTC) · `fuel-sheet-sync-6h` (every 6h).

## DB triggers ("hooks")
- `handle_new_auth_user` — auto-provisions a profile for new @fbn-transport.co.za Google sign-ins.
- `log_load_status_change` — writes every load status change to `load_status_history` (the timeline).
- `set_updated_at`, `log_load_status_change`, search_path-pinned helper fns.

## Key lib/ files
`supabase.ts` (client + freeze-proof helpers) · `mappers.ts` (row↔model, both directions) · `loadEmails.ts` (LoadCon/Order senders + routing) · `loadStatus.ts` (lifecycle stageFlow: DIRECT vs DEPOT) · `loadconPdf.ts` (jsPDF docs) · `emailTemplate.ts` (branded HTML) · `fuelImport.ts` + `csvVehicleMapping.ts` (fuel CSV) · `database.types.ts` (typed schema).

## Comms routing (who gets which email)
Client emails → client side only; subbie emails → subbie side only. Per-contact `getsDocs`/`getsUpdates` flags derive three CC lists on the load at create: `cc_email` (docs: LoadCon+POD), `cc_updates` (status updates), `client_cc` (client team). `loadcons@fbn-transport.co.za` (operations) is copied on everything. All client emails share subject `FBN Transport Order <num>` (threading).

## Core domain doc — LoadCon (Transport Order)
Margin rule: LoadCon (to subbie) shows transport rate + no client data; Client Order (to client) shows client rate + no subbie data; POD/Delivery Note is rate-free. A load with a subbie + buy-rate is assigned for dispatch. Back-dated loads (both dates past) go straight to Delivered (POD-first flow).
