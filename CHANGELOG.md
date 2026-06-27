# Changelog

All notable changes to the FBN Fleet Management System. Newest first.

## [2026-06-27]

### Added
- **Carrier routing — vetted-first steering.** Subbie-selection pickers now lead with
  vetted carriers and flag un-vetted ones (`lib/carrierEligibility.ts`). `AssignLoadConModal`
  gets a "Vetted only" toggle (default on) + a warning when an un-vetted carrier is chosen;
  `OfferLoadModal` uses vetting as a tiebreak after its lane/type score; the quote subbie
  rate picker and `RfqBoard` list vetted-first and flag the rest. Never hard-blocks (the
  currently-assigned carrier always stays selectable). Gate is `isVetted` because
  `complianceStatus` is unmaintained (0 carriers Compliant) and `regions` has no data yet.
- **Quote line truck type.** Each quote line can now state the vehicle class its rate is for
  (Superlink 34t / Tri-Axle 28t / 15t / 12t / 8t / 5t / 2t / Tautliner / Flat Deck). Shows as a
  "Vehicle" column on the client quote and a sub-line on the printable PDF. (Rate-per-vehicle and
  the priced weight with live Rate/kg were already in the form.)

### Fixed
- **Quote status now updates in the UI instantly (no reload).** Sending, archiving or
  restoring a quote previously left the on-screen status/badge stale until a full page
  reload. New `OperationsContext` handlers — `handleSetQuoteStatus` (optimistic dispatch +
  status-only `directUpdate`, reverts on failure) and `patchQuoteLocal` (local-only update
  after `quote-send` has already persisted) — wired into Send/Archive/Restore in
  `QuotesView`. Archive toast now reports failures honestly.

## [2026-06-26] — Invitation broadcast

### Added / Changed
- **Carrier invite funnel now advances to Applied**: when an invited transporter registers
  via their `?invite=<token>` link, the `supplier-register` edge fn flips the matching
  `subcontractor_invites` row to **Applied** (+ application_id + applied_at). The campaign
  funnel is now On List → Invited (send) → Applied (register) → Vetted (approve). Verified
  end-to-end.
- **Canonical invite link**: invite emails and "Copy Public Link" now use
  `/supplier-register?invite=<token>` (was `?portal=become-supplier&invite=`).
- **Invite email** gains an "already registered? log in here" link (`/?portal=supplier`)
  and the support contact **missioncontrol@fbn-transport.co.za**.
- **Light theme**: `CarrierInviteCampaign` + `SubcontractorControlCenter` (Active Network /
  Onboarding Queue / Invite Carriers) converted from the legacy dark theme.
- Edge functions `supplier-register` + `supplier-doc-url` are now version-controlled on
  disk under `supabase/functions/`.

## [2026-06-26]

### Added
- **Public subcontractor self-registration** at `/supplier-register` (also the emailed
  `?invite=<token>` link and legacy `?portal=become-supplier`). A 5-step, no-login flow:
  (1) company details, (2) per-vehicle fleet builder, (3) routes (9 predefined lanes +
  per-lane load types) + cross-border country multi-select, (4) certifications upload with
  expiry (GIT required, HAZCHEM, RTMS, COID, cross-border permits), (5) the FBN SLA shown
  in a scrollable panel + full name / ID / position + acceptance checkbox.
  `components/supplier/SupplierRegister.tsx`.
- **`supplier-register` edge function** (verify_jwt=false): uploads each doc to the private
  `supplier-applications` bucket, captures IP + timestamp **server-side**, generates the
  **signed-agreement PDF** (pdf-lib) with the electronic-acceptance block, inserts a
  `Pending` `supplier_applications` row (lands in the onboarding queue), and emails the
  applicant a confirmation + admins a notification (CC loadcons@). Verified end-to-end live.
- `supplier_applications` schema extended (registration_number, vat_number, years_operating,
  vehicles, routes_detail, cross_border_countries, documents, agreement_* fields).
- **Vetting step**: the onboarding queue + `SupplierApplicationDetailModal` (both converted
  to light theme) now show the full submission — company (reg/VAT/years/BEE/haz), a
  per-vehicle fleet table, routes + per-lane load types + cross-border countries, the
  electronic-acceptance block (name/ID/position/server timestamp/IP), and a documents list
  with per-doc **View** + **View signed agreement (PDF)**. New role-gated edge fn
  `supplier-doc-url` (verify_jwt=true) mints 1-hour signed URLs for the private
  `supplier-applications` bucket; `tsconfig` now excludes `supabase/functions` (Deno).

### Changed
- **Subcontractor SLA single-sourced** in `lib/subcontractorSla.ts` — now feeds the public
  Terms page, the registration agreement step, and the acceptance PDF (no more drift).
  **GIT minimum cover raised R800,000 → R1 500 000,00 per load**; added the **ECT Act 25 of
  2002** electronic-acceptance clause. Company remains FBN Transport CC (Reg 1989/001182/23).

## [2026-06-25]

### Added
- **POD authorisation gate**: every POD upload is now HELD — nothing reaches a client
  without an admin authorising it. `submit-pod` sets `pod_authorisation='pending'` and
  emails loadcons@ to review; new `authorise-pod` fn releases it (as-is or with a cleaned
  re-upload; original kept in `pod_original_url`). `blocked` state bars a bad upload (incl.
  invoice) from ever being sent. Admin-only panel in LoadDetailModal + board indicators.
- **View POD everywhere**: maps `pod_drive_url`/`pod_doc_urls`; green View POD in the load
  toolbar/board (all states incl. Archived) + a dedicated **PODs tab** (Awaiting sign-off →
  Finalised → Archived, searchable).
- **Multi-transporter / split**: editable per-leg **role** (Truck/Forklift hire/Crane hire),
  per-leg **Request POD** toggle (forklift/crane legs skip POD request + chase), per-leg
  **routing override + handling instructions**, **group-aware costing** (one client charge,
  margin = client − all truck costs, per-truck breakdown). Each subbie gets their own loadcon,
  never sees the others (`leg_role`, `pod_required` columns).
- **Load Board archive**: 304 sheet-imported loadcons archived (off the active board, in an
  **Archived** filter, searchable; Unarchive action); importer auto-archives future rows.
- **Collections lifecycle**: ✓ Accept (acknowledge, `accepted_at`); ops booking email is
  date-aware (same-day = assign now / future = acknowledge & plan); one-tap ✓ Collected for
  unassigned bookings; 07:00 loading-day ops reminder (confirm + assign + ETA); ETA check now
  **1h before** (on-track) + **10 min after** (arrived?) via `arrival_check_sent_at`.
- **Quotes**: add a brand-new client inline on the New Quote form; "Request More Info"
  question presets (vehicle size w/ capacities e.g. Superlink 34t, full/part load, pallets,
  dims, equipment) + asks commodity when missing + free-text notes; Rate Scope/Terms
  (transport-only default) on the client quote.
- **Collection form**: pick/add additional saved client contacts (saved to the client);
  collection/delivery **area auto-derives from the address**. Deliveries: ✉ **Request POD**
  emails the subbie an upload link (held for authorisation).
- **Spell-check**: prose fields (remarks/notes/special instructions) now natural sentence case
  so the browser spell-checks them; structured codes/refs stay ALL CAPS.

### Fixed
- **Emails `=20` / word-splits**: `send-email` strips trailing whitespace per line + entity-
  encodes non-ASCII so denomailer stays clean (no quoted-printable artifacts). All emails.
- **Collection update error**: empty date/time fields now save as NULL not '' (Postgres
  rejected '' for date/time) — `orNull()` in `toLoadConfirmationUpdate`.
- **Security**: enabled RLS + removed public (anon) access on `quote_compliance_log` (Supabase
  Security Advisor finding).
- Client status-update email reformatted to the branded detail-table layout.
- LCL importer routes FCL tabs to the container report (FCL→FCL, LCL→LCL); cron auth headers
  added after `verify_jwt` flips on MCP redeploys.

### Added (later same day)
- **COD Phase 1**: new clients default to **COD / Unauthorised** (`account_status`/`vetted`/
  `vat_no`/`invoice_details`); client area COD filter + **Approve account** vetting action + badge.
- **Collection forms — Full details**: new-collection "+ Full details" (load type, weight, **total
  cubes**, client rate); broking gained commodity/dimensions→**total cubes**/remarks + a **client
  rate** alongside the supplier rate.
- **Load types**: Tri-axle **28t** (was 34t), added 2t/5t/12t/15t + **Taut/Flat**.
- **New Quote mobile layout**: 12-col item/leg/rate rows stack on mobile.

### Fixed (later same day)
- **Quote "Sent" status not refreshing**: sending a quote now updates the status to Sent in the UI
  immediately (was only persisting to the DB → showed Draft until reload). Same class of stale-UI
  issue noted for archive (data correct; full reload shows it) — in-app refresh tracked.
- **Request More Info** no longer blocks when the quote has no client email (falls back to the
  requester's email from the original request — `quote-request-info` v11).

### Added (COD workflow + quote pricing, later same day)
- **COD Phases 1–4 complete**: new clients = COD/Unauthorised + vetting (Phase 1); proforma with
  FBN banking + requests client VAT/invoicing details (Phase 2, `quote-proforma` v2); **cargo HOLD**
  flag + loadcon "⛔ DO NOT DELIVER until released" + payment capture (Phase 3); admin **Payment
  received → release** (`cod-release` fn) emails ops/subbie "deliver now" + vehicle/ETA update link
  and thanks the client (Phase 4). Load fields `cod_hold`/`cod_paid_at`/`cod_released_at`.
- **Quote pricing**: truck types with capacities on Load Spec (Superlink 34t / Tri-axle 28t /
  15t–2t / Taut / Flat); line items now **rate per vehicle × vehicles = line total**.
- **Quote "Sent" status** updates in the UI on send (no reload); **Request More Info** falls back
  to the requester's email when the client has none on file.

### Process
- CLAUDE.md: mandatory **auto-capture of flows/logic** into memory/skills/hooks/cron the moment
  they're defined ("lock it in" trigger). New memories: pod-authorisation-workflow,
  multi-transporter-split, capture-flows-automatically, supabase-security-advisor; new-email +
  form-standards skills/rules updated.

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
