# Changelog

All notable changes to the FBN Fleet Management System. Newest first.

## [2026-06-30] — Big build: recipient picker, POD chain, nav refactor, fuel/Pulsit, manifests & trip sheets

### Added
- **Recipient picker** on the Transport Order form (client + subbie): multi-select saved contacts
  (role + send-flags) and add people inline that persist to the company; one-off addresses can be
  promoted to permanent contacts. Client↔subbie email wall preserved.
- **Branded POD reminders + full audit trail** — shared `lib/podRequest.ts` (branded shell + button)
  used by the Deliveries board AND Load Board; records date / who / **count**; the cron
  (ops-daily-checks) stamps "Auto reminder (system)". Board badge "Requested 27 Jun ·2x" + hover.
- **POD tracker = one board, three lenses** (Brokered / Own-fleet / All); honours `pod_required` so a
  transfer/crane leg isn't chased (+ "no POD?" toggle).
- **Grouped sidebar** (Operations ▸ FBN/Broking · FBN Fleet ▸ Assets/Compliance · Accounts ▸
  Clients/Transporters/PODs/Finance) + saved-order honoured; **Clients & Transporters split into own
  screens** (+ Comms & Marketing bulk branded email); **⭐ Network Partner** tag + "Carrier Partner"
  category (clients + suppliers); **Accounts** added to Tab Access.
- **Load Board** reworked: Transporter | Client | Route (simple) | Size | Weight (margin removed);
  Request POD from here too; route auto-derives from collection/delivery.
- **Fleet**: one-line superlink pairs (both regs clickable), click-to-assign driver (fixed: real
  drivers table + persist + add), category prominent, regrouped LM/DBN/JHB then trailers; **bulk
  service intervals** (10k/15k/20k/25k or hours + flag-before).
- **Fuel**: By-Vehicle tab (per-vehicle fills + CPK); **fill TIME** captured (forms + master-sheet
  sync v4 + backfill); **Pulsit live odometer cross-check** on live fills (flag >50 km off).
- **Metering Phase 1**: meter-aware checklist (forklift=hours / trailer=hubometer + "fitted?" rule /
  truck=odo).
- **Manifest M1–M4**: any-branch truck picker + trailer regs + per-trailer 6m/12m split + overload +
  manual mileage; doc/print/email; **broker line-haul leg**; **en-route stops** on the loadcon.
  **Line-haul cost vs turnover = margin** (turnover/profit **management-only**; ops see/enter cost).
- **Trip sheet T1/T2**: depot-ordered fleet picker + payload-cap overload; delivered-count +
  "couldn't deliver" reason → auto-urgent next day.
- **Waybill auto-link** (group separate loads sharing one waybill, e.g. 0013/0014).
- **Manage Lists** screen — curate route/commodity/packaging/load-type suggestions (hide junk / add
  approved); booking forms gained Flat-deck + Uprights options.
- **Tracking page** reformatted (detail table + always-on "add info / request update").
- **Notifications**: own-fleet loads badge under Operations, brokered under Broking.

### Notes
- All schema changes applied (20 new columns verified). Margin/revenue gating is UI-level for now
  (DB-level RLS noted as a future hardening).

## [2026-06-29] — Operations hardening: containers, tab access, fuel, data audit

### Added
- **Branch-aware tab access** — Super Admin can hide/show tabs per role AND per depot
  (Ops · DBN vs Ops · JHB) from Operations → Customise → Team tab access; server-stored
  (`role_tab_visibility` role+branch); Ops defaulted to hide Driver Chats/Doc Settings/Containers.
- **Containers branch-scoped** (DBN/JHB) + **mirror the FCL sheet's exact status wording**
  (`sheet_status`) with simple buckets kept for the count cards.
- **Users "Last active" column** (admin-user-activity edge fn → auth last_sign_in_at).
- **Deliveries/POD "last requested + by who"** stamp for follow-up monitoring.
- **LoadCons "Created" date filter** (Today + any date).
- **Asset List cards/list toggle** (+ superlink pairing / "not paired" flag in list view).
- **Fuel** — date-picker on fillings + "Last fill per vehicle" (spot data gaps).
- **QR labels** — Trucks-only / Trailers-only filter.
- **LCL Status Report** — bulk "Set agent" + surfaced save errors.

### Fixed
- **FCL container sync** — importer was keying on status text → duplicate "ghosts"
  (board showed 232 at port; real ~13). Rewritten to upsert the active tab + close on-leave,
  no history re-import; cleaned 454 ghost rows; hardened the date parser (reject yr <2015/>2035).
- **Containers board loaded only 4** — no-ETA active rows were buried past the 5000 cap; now
  fetches active in full. Same fix on the Ops dashboard widget.
- **Add User** "duplicate key" — admin-create-user now upserts (the auth trigger pre-creates the profile).
- **Clients contact Role** — flaky datalist → proper dropdown.
- **Data audit cleanup** — 2 delivered-no-date loads, 21+12 supplier_id backfills + 13 created/linked
  carriers (only own-fleet left), 6 junk branch rows, container yr-0202 dates, 86 stale LCL date-as-status → history.

## [2026-06-28] — Workshop Parts 5–8/11 + inspection refinements + Driver Hub

### Added
- **Driver Hub (`/driver`, no-login):** one mobile page per driver — pick your vehicle once (remembered),
  then tiles for Vehicle inspection / Report a breakdown / **Report an incident** (new: type, GPS location,
  third-party, photos → `incident_reports` + emails ops & workshop) / **My logs** (recent inspections,
  breakdowns, incidents). New `driver-hub` edge fn (meta/logs/incident).
- **Workshop Part 5:** failed inspection → auto job card + grounding gate (Grounded → vehicle Off the road,
  removed from all dispatch pickers) + workshop email; retread escalation.
- **Workshop Part 6:** Checklist Review screen (light theme) — submitted inspections with result/severity/
  driver/photos via signed URLs (`inspection-doc-url`), Mark-as-Reviewed persists.
- **Workshop Part 7:** Job Card board → light-theme **list** (not kanban); one job card per inspection holding
  all defects as resolvable line items; resolve each → Complete & close → vehicle back on road.
- **Workshop Part 8:** Parts & Inventory procurement chain wired + persists — create request → manager
  Authorise/Reject (role-gated) → Raise PO → Receive Goods → stock up; part assignment decrements stock.
- **Workshop Part 11:** tyre operations now persist (add/mount/dismount/scrap/send-retread/receive/inspect →
  `tires`/`tire_mount_history`/`tire_inspections`); CPK bug fixed; TireManagement + 7 modals → light theme.

### Changed
- **Inspection flow v2/v3:** reorder (vehicle+assigned → driver → trailers → checklist); licence-photo scan
  (Gemini OCR); per-type trailer selection (superlink auto-pair / triaxle / skeleton, can't proceed without reg);
  flatbed trailer checklist; tyres grouped per axle-end (tread + rim photos), horse/rigid 6 positions (drive
  axles split L/R); triangles = number + good/damaged; fire-extinguisher per-unit photos; **plain-English
  outcomes** ("DO NOT DRIVE — book into workshop"); AI Triage model → gemini-3-flash-preview.

### Fixed
- Inspection save (checklist_submissions.user_id made nullable for no-login); trailers not loading
  (removed non-existent is_active filter in inspection-load).

## [2026-06-28] — Workshop module (Parts 1–4)

### Added
- **Checklist templates (Part 1):** structured items (section, photo rule, value options + fail values,
  severity, tyre per-wheel/tread-depth, Loadmaster-only) across Horse/Rigid/Trailer/Forklift, linked to
  vehicle types; fully editable in Checklist Management; `lib/vehicleChecklist.ts` classifier.
- **QR → mobile inspection (Part 2):** no-login `?checklist=<uuid>` flow — driver ID (PDP warnings) →
  vehicle confirm + substitution → trailer select → structured checklist (Pass/Fail/N-A, value, tyre tread +
  photo, autosave) → submit (Roadworthy/Requires Attention/Grounded + reference). Edge fns inspection-load /
  inspection-upload (private `inspections` bucket) / submit-inspection.
- **Tyre AI (Part 3):** tyre photos analysed (Gemini) → coloured assessment + retread detection; retread on a
  Loadmaster or Horse steering axle auto-escalates to Critical.
- **Breakdown logging (Part 4):** public `/breakdown/tyre` — log a roadside tyre change (photos, location,
  replacement) → flags the vehicle, notifies the depot workshop + ops; resolve restores status.
- (Parts 5–12 — notifications, review tab, job cards, parts, suppliers, service planner, tyre mgmt — pending.)


## [2026-06-28] — Client portal (Session 4)

### Added
- **Public client self-registration** at `/client-register` (company/reg/VAT/industry, contacts,
  physical + billing address, preferred routes + cargo types, load sizes, marketing opt-ins) → pending
  client → admin approves from the Clients tab (Pending filter + "Approve & create login") → welcome
  email with login. New `client-register` edge fn; `clients` table extended.
- **Logged-in client portal** (light brand theme): Dashboard (active loads / open quotes / outstanding
  invoices), **Request a Quote** (full form incl. HAZMAT UN/class → new `client-quote-request` edge fn that
  drops a Requested quote into the staff pipeline), **My Quotes** (status + accept/decline), **My Loads**
  (timeline, vehicle/driver/contact, ETA, exceptions, POD download), and **Financial Documents** (invoices +
  payment status, outstanding highlighted, statement print, remittance upload). RLS: clients see only their
  own records.

## [2026-06-28]

### Changed
- **Subcontractor (Carrier) Portal restyled to the light brand theme** — navy sidebar + gold active
  tab, white cards on slate, navy/emerald/slate buttons, light status pills, across every portal
  screen and modal. (Was dark; now matches the rest of the app.)

### Fixed
- **Date standard applied program-wide.** Every raw `<input type="date">` (which renders
  yyyy/mm/dd) replaced with the house **DD/MM/YYYY DateField** across ~37 files — all supplier-portal
  screens, operations/fleet/fuel/workshop/admin forms, and the LoadDetailModal inline field wrapper.
  A PostToolUse guard hook now flags any new raw date input so it can't regress.

### Added
- **Subcontractor portal — Phase 5 (Documents reminders + Profile editing).** New
  `cert-expiry-reminders` edge fn + daily cron emails the carrier and ops 30 days before and on cert
  expiry; a GIT expiry flags the carrier and alerts admin to review RFQ access. The carrier **Profile**
  is now editable (company/contacts/address/fleet/routes via the role-checked `supplier-self-update`
  edge fn), with **change password** and a link to the agreement. **All 5 portal phases complete.**

## [2026-06-27]

### Added
- **Subcontractor portal — Phase 1 (Dashboard) + Phase 2 (RFQ board, My Loads).** Carrier portal
  now opens on a **Dashboard** (open RFQs with live countdowns, active loads, outstanding PODs with
  inline upload, compliance R/A/G, placeholders for invoices/load-board). **RFQ board** gains a live
  deadline countdown, decline-with-reason, and a vehicle dropdown from the carrier's fleet. **My Loads**
  gains status progression (via the canonical state machine) and exception flagging
  (Delay/Breakdown/Short/Damage → waybill event + load flag). Super admin can view any carrier's
  portal via Users → Portal Logins → View Portal.
- **Subcontractor portal — Phase 4 (Load Board).** Carriers post loads needing cover (origin/dest/
  date/cargo/vehicle/contact) → land Pending → FBN authorises (Management → Subcontractors → Load
  Board) → visible to other approved carriers, who see enquiry contacts. Poster can mark filled or
  withdraw; the poster is emailed on approve/decline. New `load_board_posts` table + RLS. Dashboard
  "Posted to network" tile now live.
- **Subcontractor portal — Phase 3 (Invoicing & Payments).** New `subcontractor_invoices` table +
  RLS. Carriers invoice their POD'd loads (number/date/excl-VAT/VAT/total/PDF), track
  Submitted→Approved/Queried→Paid, filter history, and print a statement of account. FBN accounts
  review them under Management → Subcontractors → Invoices (approve / query / mark paid), with the
  carrier emailed on each decision. Dashboard "Outstanding invoices" tile now live.
- **RLS:** scoped `waybill_events` by role (migration `scope_waybill_events_rls_by_role`) — carriers
  only see/insert events for their own loads; staff keep full access.
- **COD automation.** A COD client's new load is now **held automatically** (`cod_hold`) — no
  manual toggle — and accepting a COD client's quote **auto-opens the proforma** preview to send.
  Completes the COD payment-gated-release flow (phases 1–4 were already built).
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
