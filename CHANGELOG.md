# Changelog

All notable changes to the FBN Fleet Management System. Newest first.

## [2026-06-22] — continued (later same day)

### Added
- **LCL per-depot collection grouping**: "Ready to collect" panel on the Status Report
  groups unpacked shipments per depot; "Book collection" creates one consolidated
  collection load (notifies branch ops) and marks shipments Collected + linked (`load_id`).
- **Controller column** + `lcl_controllers` table (per agent: name/email/cell); click a
  controller to add/edit/delete — to push updates to the right person.
- **App-as-master for LCL**: `lcl_shipments.app_locked`; sheet sync now **3×/day**
  (07:00/13:00/19:00 UTC = 9am/3pm/9pm SAST) and **skips app-managed shipments** so
  in-app changes are never overwritten.
- **Daily data-health digest**: `fbn_health_digest()` SQL fn + `daily-health-digest`
  edge fn + 06:00 cron — emails the owner storage-risk / POD-outstanding / stalled-transit
  / hidden-load / stale-import counts.
- **Quote ops**: CC `quotes@` on all quote emails (send/intake/more-info); record + show
  the "more info requested" date and warn before re-requesting within 2 days.
- **Flow guard-rails**: back-dated-load confirm (Transport Order); negative-margin warning
  + red LOSS card + save confirm; open-client-requests alert on the Daily Overview.
- **Operations tabs grouped** into Dashboard / Work / Track / Reports (Broking + Operations
  remain separate). `lib/format.ts` shared money/date/datetime formatters.
- Client CRM "Pull controllers from status report"; client-facing app set to **noindex**.
- Local Claude tooling (gitignored): `deploy-verify` + `load-audit` agents, `/new-form` +
  `/new-email` skills, save-time guard hooks; docs `validation-loop.md`, `context-reread-rule.md`.

### Changed
- **Transit load flow corrected**: marking received at the FBN depot now sets **At
  Collection Depot** (line-haul ready) — was wrongly "At Destination Depot" (skipped the
  line-haul). Flow: depot → line-haul manifest → destination depot → local delivery.
- **Client track page**: At-depot/Unloaded show as **In Transit**, not a premature "Out
  for Delivery". Transit panel relabelled "FBN planned delivery" / "Reroute with subbie".
- **Transit subbie comms**: once at the FBN depot the subbie gets no onward updates/POD
  request — FBN owns the onward leg + final POD.

### Fixed
- Crash: "Onward on FBN fleet" opened the wrong modal (AssignDriverModal) → now `assignFbn`;
  AssignDriverModal hardened against a missing vehicle.

### Database
- New table `lcl_controllers` (RLS=org). New columns `lcl_shipments` (agent, client_id,
  damaged, damage_notes, cra_received, app_locked). New: `fbn_health_digest()`,
  edge fn `daily-health-digest` + cron; LCL crons rescheduled to 3×/day.

## [2026-06-22]

### Added
- **LCL groupage Status Report** (Operations → Status Report): per-client report from
  the 4 status sheets (13,796 shipments, daily cron `import-lcl-status` 05:45–05:54),
  free-time clock (3 days / HAZ 1 day), DRO/release-doc AI scan, **Agent (bill-to) vs
  Consignee (end client)** + link to a billing client, **bulk select + bulk update**
  (unpacked / collected / delivered), DateField dates, and **CRA + damages** capture
  (notes, photos, "email report to client"). New tables/cols: `lcl_shipments` (+ `agent`,
  `client_id`, `damaged`, `damage_notes`, `cra_received`); BEFORE INSERT trigger
  `lcl_set_agent`.
- **Operations dashboards**: Daily Overview (live pipeline + FCL panel), Month View of
  LoadCons (with branch/client/transporter/route filters + Print/PDF), **By Transporter**
  LoadCon viewer, **Deliveries / POD Day View** (grouped by date, POD-outstanding, one-tap
  Get POD).
- **FCL container flow model**: route plan (yard / supplier-unpack / storage depot /
  direct), unpack who+where+date, storage depot in/out, empty turn-in, consol ref
  (`containers` new cols). Containers sort/group + FCL panel on Daily Overview.
- **Transit-depot multi-leg broking** (CPT → FBN JHB → DBN): "route via transit depot"
  on Broking Collection AND Transport Order; subbie LoadCon delivers to the transit depot;
  received-at-depot + onward planning (fleet/subbie + date/time) + dwell indicator;
  auto-notify the transit depot ops. `load_confirmations` new cols `transit_depot`,
  `transit_received_at`, `onward_carrier_type`, `onward_planned_date/time`.
- **FBN DI / Waybill** manual number on booking forms + LoadCon / Order / POD docs.
- **Client CRM**: "Based (city/branch)" per contact; "Pull controllers from status report"
  (Bongumusa → DHL, accurate, no scraping).
- **"Upload POD" contact role** (`getsPodUpload`) — reminded to upload the POD (e.g.
  accounts) without being sent the POD-to-sign; `load_confirmations.pod_upload_email`.
- **Capture cargo**: label photos (Loading / Offloading / Damages) + camera or gallery.
- **PWA install** (manifest + icon) and an **auto-update watcher** (VersionWatcher) that
  detects a new deploy and offers one-tap reload.
- Client **track page** now offers "Download signed POD" once uploaded.
- **Global search** across loads/quotes/clients/subbies/vehicles.

### Changed
- LoadCon/Order emails are **delivered-aware** (no "accept this load" after delivery) and
  routed through the **one shared builder** (`lib/loadEmails`) — both auto-send and the
  resend buttons (removed duplicate email HTML in SubcontractorLoadsView).
- Email subjects: client = "FBN Transport Client Order &lt;no&gt; - &lt;CPT&gt; to &lt;DBN&gt;";
  subbie = "FBN Load Confirmation &lt;no&gt; - &lt;CPT&gt; to &lt;JHB&gt;" (their leg). Threaded.
- Edit-load form uses address autocomplete + restores pick-lists (client/transporter/
  commodity/packaging).
- Depot/Bulk collection moved from Containers (FCL) to **Imports** (LCL groupage).
- New Transport Order **requires a delivery date** (time optional; ETA driver-updated).
- Client order no longer shows internal transit routing.

### Fixed
- **Deploy pipeline**: Cloudflare deploy command was `wrangler versions upload` (uploaded
  but never went live) → changed to `wrangler deploy`. This had masked saves/updates as
  "not working" for the whole session.
- **Brokered loads** with a typed transporter (no `supplier_id`) vanished from the LoadCons
  board — now shown by name OR id; backfilled 45.
- Edit form silently dropped fields not in the update mapper; global search dropdown was
  unreadable on the light theme.

### Database
- New table `lcl_shipments` (+ trigger `lcl_set_agent`). New columns on `containers`,
  `load_confirmations`. New edge fn `import-lcl-status` (+ 4 daily crons). RLS = org on all.
