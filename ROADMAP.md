# FBN FLEET MANAGEMENT SYSTEM — PRODUCTION ROADMAP

## Context
React/TypeScript/Vite app, Supabase backend (project: fbn-fleet).
GitHub repo: FBNmarcsnyman/Fleet-Managment-system-
Already done: Supabase Auth replacing mock login, 35-table mapper
layer (lib/mappers.ts), vehicle + fuel_entry Supabase writes,
types.ts extended (VehicleComplianceDoc, Route).
Fleet: ~44 trucks, 35 trailers, 5 motor vehicles, 6 forklifts
across LM / DBN / JHB depots.
I am not a developer. Explain each step in plain English, one step
at a time, and you handle all diagnosis — never ask me to use the
browser console.

## Rules for EVERY phase
1. One commit per logical step, plain-English commit messages.
2. Before writing code, tell me WHAT you're about to do and WHY,
   in one short paragraph, then do it.
3. After each phase, give me a simple test script I can follow on
   my phone/laptop to verify it works.
4. Never delete or overwrite production data without asking.
5. Work ONLY on the phase I name. Do not jump ahead.

---

## Phase 1 — Google Authentication + Roles
- Enable Google OAuth in Supabase Auth (walk me through the Google
  Cloud Console + Supabase dashboard steps one at a time).
- Restrict sign-up to approved users only: an admin-managed
  "employees" table; unknown Google accounts get "pending approval".
- Roles: admin, manager, controller, workshop, driver. Store role
  in a profiles table linked to auth.users.
- Row Level Security on EVERY table: drivers see only their own
  checklists/trips; controllers see their depot; admins see all.
- Role-based routing in the app (admin dashboard vs driver view).
- BEFORE anything else: confirm the previously exposed Supabase
  PAT has been revoked and a new one issued.

## Phase 2 — Data Import (vehicles + fuel first)
- Build an admin-only CSV import screen with preview-before-commit,
  duplicate detection on fleet number, and a downloadable error
  report for rejected rows.
- Import order: vehicles → trailers → fuel entries.
- Validate one single vehicle insert end-to-end before bulk import.
- Fuel efficiency logic must follow the tank-to-tank method
  (L/100km and CPK per vehicle) per my fbn-fuel-efficiency skill.
- The same import screen will later be reused for other sections
  (costs, documents) — build it generic.

## Phase 3 — Vehicle Checklists + QR Codes
- Checklist templates per vehicle type: truck-tractor, trailer,
  motor vehicle, forklift. Each item: pass / fail / N/A + photo
  upload (Supabase Storage) + notes.
- Each vehicle gets a permanent QR code encoding a URL like
  /inspect/{token}. Build an admin page that generates printable
  QR labels (PDF, A6 size, fleet number + reg printed under the
  code) for all vehicles in one batch.
- Scanning the QR opens a mobile-first checklist for that vehicle.
- Driver identification: NO login. The checklist page asks for
  employee number, validated against the employees table (must
  match an active driver record — reject unknown numbers, show
  the matched driver's name for confirmation before submitting).
- Security for the public checklist endpoint:
  * The /inspect/ URL must use a long random token per vehicle
    (e.g. /inspect/8f3k2m9x...), NOT a guessable sequential ID,
    so outsiders can't enumerate the fleet.
  * Checklist submissions go through a Supabase Edge Function
    (not direct table writes) so the anon key can never write to
    any other table.
  * Rate-limit submissions per vehicle (max ~5/hour) to block abuse.
  * The page is write-only for drivers: it can submit a checklist
    but never read past checklists, defects, or any fleet data.
- Submitted checklists write to Supabase with timestamp, GPS
  location if available, and driver ID.

## Phase 4 — Defects → Maintenance Workflow
- Any FAILED checklist item auto-creates a defect record.
- Defect severity: minor (monitor), major (book for service),
  critical (vehicle status → OFF ROAD immediately).
- Vehicle status field: available / on trip / booked for service /
  off road. Off-road vehicles must be blocked from trip allocation.
- Job cards: defects roll into a job card (workshop role), with
  parts, labour, cost, and completion sign-off. Completed job card
  on a critical defect returns vehicle to available.
- Service scheduling: per-vehicle service intervals (km-based,
  fed by fuel entry odometer readings + time-based). Dashboard
  shows due / overdue.
- Notifications: when a vehicle goes off road or a service is due,
  notify admin + relevant depot controller. Start with email
  (Supabase Edge Function); WhatsApp/SMS via Twilio is later.

## Phase 5 — Go Live
- Deploy frontend to Vercel, connected to the GitHub repo for
  auto-deploy on push. Set up a "preview" deployment for testing
  and "production" on the main branch.
- Custom domain: fleet.fbn-transport.co.za (walk me through adding
  the DNS record in Xneelo's konsoleH, one step at a time — my
  website and email stay on Xneelo untouched).
- Environment variables properly secured, no keys in the repo.
- Production checklist: RLS verified on all tables, backups
  enabled in Supabase, error logging (Sentry free tier), and a
  rollback plan.

---
PHASES 6–10 ONLY START AFTER PHASE 5 IS LIVE AND STABLE.
---

## Phase 6 — Vehicle Costs & Finance
- Cost ledger per vehicle: every cost event (job card parts +
  labour, tyres, tolls, fines, insurance, licence fees, finance
  installments) writes to a vehicle_costs table with category,
  date, amount, and source.
- Fuel costs flow in automatically from fuel entries (already
  built) — do NOT double-capture them.
- QuickBooks: do NOT build an API integration yet. Start with a
  monthly CSV import (admin exports vehicle-coded expenses from
  QuickBooks, imports with the Phase 2 preview-before-commit
  screen). API sync is a later phase once categories are proven.
- Output: cost-per-km and total cost per vehicle per month,
  comparable against my existing cost model (FBN_RATES_4 figures),
  so I can see which trucks are above/below model.

## Phase 7 — Compliance Document Vault (vehicles + drivers)
- Document storage (Supabase Storage) attached to either a vehicle
  or an employee, with: doc type, issue date, expiry date, file.
- Vehicle docs: licence disc, CoF, trailer certs, hazchem/dangerous
  goods vehicle permit, tracker certificates, logbook scans.
- Driver docs: licence, PDP (with expiry), hazchem/DG driver
  training certs, medicals, induction records.
- Expiry engine: dashboard of everything expiring in 90/60/30
  days; automated email to admin + depot controller at each
  threshold; vehicle or driver flagged NON-COMPLIANT when a
  critical doc expires (expired PDP = driver blocked from trip
  allocation; expired CoF = vehicle status → off road).

## Phase 8 — Incidents, Claims & Disciplinary
- Incident report: type (accident / cargo damage / spill-HAZMAT /
  theft / injury / breakdown), vehicle, driver, date/time,
  location, description, third-party details, photo uploads
  (multiple), police case number, and status workflow:
  reported → under investigation → claim lodged → closed.
- Claims tracking on each incident: insurer reference, excess,
  claim amount, settlement, recovery from third party.
- HAZMAT incidents get extra fields (substance, UN number,
  quantity, authorities notified) — needed for SQAS/Responsible
  Care evidence.
- Disciplinary module (HR): a disciplinary record links to a
  driver and optionally to an incident or failed checklist.
  Fields: category, date, sanction (verbal / written warning /
  final / hearing), expiry of warning, documents (signed warning
  PDF upload). Full history view per driver.
- The system FLAGS drivers for review — it never auto-creates a
  disciplinary. HR runs the fair process; the system builds the
  evidence file.
- Driver profile page pulls everything together: licence/PDP
  status, incident history, disciplinary history, fuel efficiency
  vs fleet average, checklist completion rate.

## Phase 9 — Closing the Maintenance Loop
- Damage photos from checklists and incident reports attach to
  the defect/job card they generate, so the workshop sees the
  photo before the truck arrives.
- Incidents can also spawn defects/job cards directly (accident
  damage → repair job card → costs flow to Phase 6 ledger).
- Repeat-offender logic: 3+ failed checklist items of the same
  type on one vehicle in 90 days flags a recurring fault to the
  workshop; 3+ driver-fault incidents/defects flags the driver
  to HR for review.

## Phase 10 — Management Dashboard (Live Analytics)
- Role-gated: admin + manager roles only. Default view = whole
  fleet; filter by branch (LM / DBN / JHB), vehicle type, vehicle,
  driver, and date range — every widget respects the filters.
- Top row (the 6-second view): vehicles available / on trip /
  booked for service / off road; checklist compliance % today;
  open critical defects; docs expiring in 30 days; incidents open.
- Fuel analytics: fleet L/100km trend, CPK trend, top 5 worst
  vehicles vs fleet average (tank-to-tank method per the
  fbn-fuel-efficiency skill), monthly fuel spend per branch,
  bowser reconciliation variance.
- Running cost: cost-per-km per vehicle (all Phase 6 categories),
  monthly cost trend per branch, actual CPK vs my cost model
  benchmark (FBN_RATES_4 figures as a reference line) — any
  vehicle running above model is flagged red.
- Maintenance: services due/overdue, average defect-to-repair
  turnaround, repeat-fault vehicles, workshop job card backlog.
- Compliance & HR: licence/PDP/CoF expiry funnel, drivers flagged
  for review, incident frequency per branch.
- Build with Recharts; queries via Supabase database views (create
  a view for each metric so the dashboard stays fast as data
  grows — do NOT compute CPK in the browser over raw rows).
- Apply my design-director skill: clean, branded FBN look,
  generous whitespace — this must feel like an FBN product.
- Auto-refresh every 5 minutes; "last updated" timestamp visible.
- Each number is clickable and drills down to the underlying list
  (click "3 off road" → see the 3 vehicles and why).

## Later (parked, do not build yet)
- Phase 11: Trips/loads table (vehicle + driver + route + DI/
  waybill number) linking quotes to actual cost per job.
- QuickBooks live API sync (after 2 months of proven CSV imports).
- WhatsApp/SMS notifications via Twilio.
- Tyre management (per-position, per-km cost tracking).

---

## Recently completed — 2026-06-22 (Operations / Broking / Imports build)
- [x] **Deploy pipeline fixed** — Cloudflare deploy command `wrangler versions upload`
  (uploaded, never went live) → `wrangler deploy`. Added VersionWatcher auto-update.
- [x] **LCL groupage Status Report** — `lcl_shipments` + `import-lcl-status` (4 client
  sheets, 13,796 rows, daily crons), free-time clock, Agent vs Consignee + billing client,
  bulk update, DateField dates, CRA + damages (photos + email), DRO scan.
- [x] **Ops dashboards** — Daily Overview, Month View (+ filters/PDF), By Transporter,
  Deliveries/POD Day View.
- [x] **FCL container flow model** (route plan / unpack who-where / storage in-out / empty
  turn-in / consol ref) + sort-group + Daily Overview panel.
- [x] **Transit-depot broking** (CPT→FBN JHB→DBN) on both collection forms + onward planning.
- [x] **Emails** — delivered-aware, single shared builder, routed subjects, threaded;
  "Upload POD" contact role; delivery date enforced.
- [x] **FBN DI / Waybill** on docs; client CRM (Based + pull controllers); capture photo
  labels + camera/gallery; global search; PWA install.

## New / next (carried forward)
- [ ] **LCL: group unpacked cargo per depot → push to today's collection board → daily
  client status emails** through the chain (received → unpacked → collected → at FBN →
  JHB → delivered), feeding both the status report and per-shipment client notifications;
  set `lcl_shipments.load_id` when collected to join the normal delivery flow.
- [ ] **FCL: unpack → warehouse floor → split-over-N-trucks** re-load workflow (the
  container flow fields exist; the action screen to consolidate/split is next).
- [ ] **Access approval gate** — approve-only login (even staff Google) + notify owner to
  accept new users (build + test together; never deploy unsupervised).
- [ ] **CRA / damage photos persisted to Drive** (currently emailed as attachments only).
- [ ] **Assisted Gmail enrichment** (review-first) to fill client controller emails/cells
  (owner deferred; revisit).

## Recently completed — 2026-06-22 (continued)
- [x] **LCL per-depot collection grouping** → book one depot collection → board + shipments linked.
- [x] **LCL Controller column** + `lcl_controllers` (name/email/cell, edit/delete).
- [x] **App-as-master for LCL** — `app_locked`, sheet sync 3×/day, importer skips app-managed rows.
- [x] **Daily data-health digest** (06:00 email) + `load-audit` / `deploy-verify` agents + guard hooks + scaffold skills.
- [x] **Quote ops** — CC quotes@ on all quote emails; more-info date + re-request guard; send-as alias.
- [x] **Flow guard-rails** — back-dated confirm, negative-margin warning, open-client-request alert.
- [x] **Operations tabs grouped** (Dashboard/Work/Track/Reports); shared `lib/format.ts`.
- [x] **Transit flow corrected** — received → At Collection Depot (line-haul ready) → manifest → destination depot → local delivery; client tracking fixed; crash fixed.

## New / next (carried forward)
- [ ] **LCL daily per-shipment client status emails** through the chain (needs client/consignee email per shipment).
- [ ] **Operations layout phase 2** — standardise status terms/colours/dates across boards; optional Operations-only "one board, Snapshot/Kanban switch".
- [ ] **control.fbn-transport.co.za** subdomain delegation to Cloudflare (owner DNS step).
- [ ] **Access approval gate** (approve-only external registration → owner approves).
- [ ] FCL unpack→floor→split workflow screen.

---

## Recently completed — 2026-06-23 → 26 (COD, comms lifecycle, tracking, cargo verification)
- [x] **COD payment-gated workflow** — new clients default COD/unauthorised; **proforma** (FBN banking
  + requests client VAT/invoicing) with a **preview/edit modal** (cc debtors + ops, add extra cc);
  cargo HELD (`cod_hold`) with subbie/ops "DO NOT DELIVER" banner; **payment→release** email frees delivery.
- [x] **POD authorisation gate** — `submit-pod` holds every POD `pending`; `authorise-pod` required before
  client send; `blocked` state for invoice-contaminated PODs. View POD everywhere + PODs tab.
- [x] **Collection lifecycle** — Accept (`accepted_at`); booking email date-aware + **routed to the branch
  ops floor** (opsjhb/opsdbn); 07:00 loading-day reminder (`ops-daily-checks`); ETA check ~1h-before +
  ~10min-after arrival (`collection-eta-check`).
- [x] **Multi-transporter split** — one waybill / several subbies (`load_group_id`); ONE client charge;
  each subbie own LoadCon; per-leg `leg_role` + `pod_required` + routing; group-aware margin.
- [x] **Own-truck flow** — subbie field hidden in-network (GP/KZN); manual `onward_required` toggle for
  out-of-network (CPT/PE/EL/Bloem). Inline client/transport rate editing on the load.
- [x] **Driver self-update link** — copy-paste `?update=` into WhatsApp → driver pushes status
  (arrived→loaded→on route→arrived→delivered) + uploads POD. **WhatsApp kill-switch** (management toggle).
- [x] **Live vehicle tracking (Pulsit)** — `track` edge fn (key in `integration_settings`); live fleet map
  in **Fleet AND Operations** + per-load position; **35 drivers linked to trucks** from the tracker
  (`drivers.assigned_vehicle_id`), Asset List shows the driver reactively; 3 missing bakkies added.
- [x] **Geofence auto-status** — `geofence-check` cron (10 min): truck within 500 m of collection/delivery
  → auto-advance status + notify branch ops + client. Coords captured in-browser (`lib/geocode.ts`).
- [x] **Cargo verification spine** — `waybill_events` table + reusable `CaptureWaybillEventModal` +
  `WaybillTimeline` (packages expected/actual, weight, condition, damage photos per stage); on each load.
- [x] **Docs** — ARCHITECTURE.md rewritten as the live source of truth; CLAUDE.md mandatory
  session-start / before-feature / after-update rules.

## Recently completed — 2026-06-26 (later session)
- [x] **Delivery Run / Tripsheet v2 — Phase 1** (ordered stops, ▲▼ reorder, Urgent flag; `trip_sheets.stops`).
- [x] **RFQ** — "Request Transporter Rates" from a quote (pre-fills from `request_data`); packages/dims/
  cube/load-type fields; **internal-vs-subby client-detail rule** (FBN-domain only); **RLS recursion fixed**.
- [x] **Live Fleet map** fixed (classic markers — Advanced markers needed a Cloud Map ID we lack).
- [x] **Quote** — Share on WhatsApp + Copy link (client quote-view accept/decline link).
- [x] **Management toggles** — WhatsApp on/off, Client live-tracking on/off (notifications keep running).
- [x] **Load detail UX** — depot name in status, one-click status dropdown, tap-any-field-to-edit.
- [x] **Depot arrival → complete cargo details** — ops email + push (missing waybill/weight/dims/cube/
  rate + condition/photos) linking to a public **Complete cargo details** page; no rate → management + push.
- [x] **Client emails** — internal depot statuses no longer notify the client (clean milestones).

## New / next (carried forward — 2026-06-26)
- [ ] **Delivery Run Phases 2-4** — route optimise (browser Google Directions) + ops urgent override;
  driver run page (tap done + geofence, per-stop POD); per-stop client "on the way / ETA-with-traffic"
  link + en-route delay updates + arrival closes the link. (memory: delivery-run-tripsheet-v2)
- [ ] **Email control centre** (super-admin) — registry of every email + recipients/CC/on-off/wording.
  (memory: email-registry-management)
- [ ] RFQ: save extra controller emails under the subby; consolidation "what else is loaded" view.
- [ ] **Cargo verification Phase 2+** — wire the capture into the collection flow + **digital waybill**
  the client signs on the driver's phone; origin/destination depot **Goods-Received** (mobile per-waybill
  confirm + damage); **manifest trailer-pairing (Superlink 6m+12m) + overload engine** (6m≤12t, 12m≤22t,
  triaxle≤28t; rigid payloads; flag + override-notifies-management); tripsheet weight checks.
- [ ] **Geofence coverage** — capture coords at address-entry (AddressAutocompleteInput Place geometry)
  for instant cover on brand-new loads; populate `vehicles.payload_kg` from weight categories.
- [ ] **Auto-trigger** — auto-set COD hold + auto-raise proforma at COD load creation; auto in/out-of-network.
- [ ] **Waybill photos to Drive/Storage** (currently data-URLs in jsonb).
- [ ] Carried over: FCL unpack→floor→split; access approval gate; LCL daily client status emails.

## Workshop / Driver — next session (2026-06-29+)
- [ ] **Custom domain** — put the app on `control.fbn-transport.co.za` (see memory `custom-domain-plan`); DNS at
  Hetzner, protect Google email + root website; Option B (delegate just the subdomain) recommended. Draft the
  one-page step list for whoever manages the domain.
- [ ] **Workshop Part 11b** — Tyre People external supplier portal (retreader sees tyres sent + marks received).
- [ ] **Workshop Part 9/10/12** — supplier metrics; Service Planner "create planned service" UI; industry-standards
  enforcement (Reg 246 / SANS 1395 / RTMS / cross-border).
- [ ] **Driver Hub extras** — printable `/driver` QR poster for cabs; general (non-tyre) breakdown option.
- [ ] **Optional** — per-driver login (Driver Hub Option B).

## Next session (2026-06-29 close) — prioritised
- [ ] **Custom domain** — register `fbncontrolcentre.co.za` (new domain, no Xneelo touch) → point at Cloudflare worker → attach Custom Domain. Steps in memory `custom-domain-plan`. (Marc: register + nameservers; I wire it.)
- [ ] **Recipient picker** — on Collection/Order/LoadCon create: multi-select the company's contacts (with roles + send-flags) + add-new-inline that persists to the company; flows into the load's email recipients; keep client↔subbie separation.
- [ ] **Central Tab Access** — extend per-role/branch tab hiding to ALL sections (Workshop/Fleet/Quotes/Clients), one admin screen, namespaced keys.
- [ ] **Broking/Ops streamline (audit steps 2-3)** — group tabs DO/TRACK/REVIEW; merge duplicates (By Transporter, PODs vs Deliveries/POD, Dashboard); one create path; verify status state-machine + client/subbie email separation.
- [ ] **Small importer fixes** — LCL "ALL OTHER CLIENTS"/SAMC sheets set agent (needs Marc's bill-to); loadcon importer branch whitelist.
- [ ] **Operational (Marc)** — chase 7 PODs (PUMA worst); assign agent on remaining unbilled LCL; call ZACPAK re 2 stale IFF containers.
- [ ] Carried: Tyre People portal; Workshop 9/10/12; Driver Hub QR poster; per-driver login.
