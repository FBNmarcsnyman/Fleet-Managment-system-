# FBN Control Centre — ARCHITECTURE (single source of truth)

_Live snapshot — last rewritten **2026-06-26**. ALWAYS read this before creating a table, list, API connection, or feature. It documents what already exists so we never duplicate it._

- **Stack:** React 18 + TypeScript + Vite 6 + Tailwind (SPA). Supabase (Postgres + Auth + Storage + Edge Functions + pg_cron) project `kyosepbdxjwugunylvyo`, org `00000000-0000-0000-0000-000000000001`. Live on Cloudflare Workers (`fleet-managment-system.marcsnyman.workers.dev`), auto-built from **`main`**.
- **Deploy:** commit on `migration/supabase` → `git checkout main && git merge migration/supabase --ff-only && git push origin main` → also push `migration/supabase`. Build first: `npx tsc --noEmit` then `npx vite build`. Verify by CONTENT, not bundle hash.
- **Freeze-proof writes (CRITICAL):** never use bare `supabase.from()` for user writes — the client can wedge. Use `directInsert/directUpdate/directDelete/directSelect/directInvoke/invokeFn` in `lib/supabase.ts`. RLS everywhere: `organization_id = auth_org_id()`.

---

# 1. EXISTING SYSTEMS & DATA

## 1a. Authoritative lists — DO NOT recreate these
| What | Table | Notes |
|---|---|---|
| **Fleet / vehicle / trailer list** | **`vehicles`** | Horses, rigids, trailers, forklifts, bakkies. Trailers are rows with `weight_category` = 'Superlink Trailer'/'Triaxle 13m'/'Skeleton 12m'; **Superlink pairing** via `linked_vehicle_id`. Branches incl. **Loadmaster** (sister linehaul fleet). `payload_kg` = capacity, `assigned_driver_id` = legacy FK → profiles (mostly unused). |
| **Driver list** | **`drivers`** | name, cell, licence/PDP, `branch`, `assigned_vehicle_id` (**the driver↔truck link**), `is_active`. NOT in `profiles`. Driver tab = this table. |
| **Driver documents** | `driver_documents` | licence/PDP/medical scans per driver. |
| **Users / logins / roles** | `profiles` (+ `role_permissions`, `user_roles`) | App users (Ops/Admin/Super Admin/Supplier/Driver). Permissions array + role matrix. |
| **Clients** | `clients` | + `contacts` jsonb, `account_status`, `vetted`, `vat_no`, `invoice_details`. |
| **Carriers / subbies** | `suppliers` (+ `supplier_compliance_docs`, `supplier_rate_cards`, `supplier_applications`, `subcontractor_invites`) | `is_vetted`, `vehicle_types`, `trailer_types`, regions. |
| **Branches** | `branches` | FBN Durban, FBN Johannesburg, Loadmaster, (CPT). |
| **Tyres** | `tires` (+ `tire_inspections`, `tire_mount_history`) | |
| **Pick-lists** | `pick_options` | commodity/packaging/etc datalists. |

## 1b. All Supabase tables & columns (public schema)

**Operations / shipments**
- `load_confirmations` — the core load/waybill. id, organization_id, load_con_number, quote_id, client_id, supplier_id, route_id, collection_branch_id, destination_branch_id, date, items, legs, total_amount, supplier_rate, priority, status, collection_point, delivery_point, delivery_area, collection_date, delivery_date, vehicle_id, driver_id, pod_photo_url, pod_signature_url, payment_status, customer_order_number, invoice_number, invoice_date, cargo_photo_urls, damage_report, notes, pod_analysis, sent_to_supplier_date, subcontractor_vehicle_reg, subcontractor_driver_name, subcontractor_driver_cell, commodity, packaging, load_spec, arranging_branch, load_ref_no, client_name, client_email, route, fbn_representative, loading_time, offloading_time, collection_contact, collection_telephone, delivery_contact, delivery_telephone, load_type, quantity, weight_kg, volume, cargo_value, equipment_required, container_no, container_turn_in_address, container_operator, container_seal_no, special_instructions, subcontractor_name, for_attention, subcontractor_email, pod_email, cc_email, delay_reason, eta, client_contact, accepted_at, loading_eta, driver_chat_state, delivery_eta, arrived_at, last_chase_at, client_request*, pod_drive_url, pod_doc_urls, damage_photo_urls, delivery_chase_at, back_dated, loaded_packages, loading_issues, cc_updates, client_cc, is_collection, dimensions, rep_email, cube_m3, collection_ref, unpack_depot, import_stage, eta_check_sent_at, eta_on_track_at, pod_upload_email, transit_depot, transit_received_at, onward_carrier_type, onward_planned_date, onward_planned_time, load_group_id, is_primary, offered_carriers, archived, pod_authorisation, pod_original_url, arrival_check_sent_at, leg_role, pod_required, cod_hold, cod_paid_at, cod_released_at, **onward_required**, **collection_lat/lng**, **delivery_lat/lng**, **geofence_collection_at/geofence_delivery_at**.
- `waybill_events` — **cargo-verification spine** (NEW 2026-06-26). id, organization_id, load_id, load_con_number, stage (collection|origin_depot_grn|linehaul_load|dest_depot_grn|delivery|pod|other), waybill_no, packages_expected, packages_actual, weight_kg, condition (ok|damaged|short|over), damage_flag, notes, photos jsonb, branch, created_by_name, created_at.
- `load_status_history` — every status change (trigger `log_load_status_change`).
- `manifests` — linehaul. id, manifest_number, origin_branch_id, destination_branch_id, dispatch_date, arrival_date, vehicle_id, driver_id, load_confirmation_ids[], status, trailer_size.
- `trip_sheets` — local delivery. trip_sheet_number, branch_id, dispatch_date, completion_date, vehicle_id, driver_id, load_confirmation_ids[], status, odometer_start, odometer_end.
- `containers`, `depot_shipments`, `lcl_shipments`, `lcl_controllers` — FCL/LCL forwarder cartage + status report.
- `routes` — lanes + target sell rates. `rate_settings` — rate card config.

**Comms / messaging**
- `email_log` (sends + opened_at), `whatsapp_messages` (transcript), `messages` (vehicle chat), `notifications` (in-app bell), `push_subscriptions` + `push_config` (web push VAPID).
- `email_settings` — id, **test_mode** (global TEST MODE), **whatsapp_enabled** (WhatsApp kill-switch), test_recipient, fuel_drive_folder_id, fuel_sync_*, fuel_folders.

**Fleet / fuel / workshop**
- `vehicles`, `drivers`, `driver_documents`, `vehicle_compliance_docs`.
- `fuel_entries`, `fuel_prices`, `bowsers`, `bowser_refills`, `personal_vehicle_fuel`.
- `checklist_templates`, `checklist_submissions` (inspections), `job_cards`, `planned_services`, `service_intervals`, `service_entries`, `parts`, `purchase_orders`, `purchase_requests`.
- `tires`, `tire_inspections`, `tire_mount_history`.
- `incident_reports`, `hr_cases`, `hr_compliance_gaps`.
- Costs/finance: `other_costs`, `recurring_costs`, `revenue_entries`, `budgets`, `forecasts`.

**Quoting / RFQ**
- `quotes` (+ request_data, request_more_info), `quote_requests` (website intake), `fbn_quotes` (legacy quoting tool), `quote_compliance_log`.
- `rfq_requests` (+ `packages`, `dimensions`, `cube_m3`), `rfq_recipients`, `rfq_carrier_quotes` (carrier RFQ marketplace). **RFQ client-detail rule:** the carrier email includes client name/contact/rate ONLY for internal recipients on `@fbn-transport.co.za`; subbies NEVER see client detail (`handleCreateRfq` in OperationsContext). Raise from a quote via **"Request Transporter Rates"** on QuoteDetailModal → pre-fills RfqForm.

**Config / platform**
- `organizations`, `branches`, `profiles`, `role_permissions`, `user_roles`, `user_profiles`, `pick_options`, `document_settings`.
- **`integration_settings`** — third-party API keys (provider, api_key, base_url, enabled). **Holds the Pulsit tracking key** (provider='pulsit'). RLS denies ALL client access — service-role/edge-fn only.

## 1c. APIs already connected (do not re-wire — extend via `integration_settings` / edge fns)
| API | Used for | Where |
|---|---|---|
| **Pulsit / MST Track** (`mstsvc-rpuls.mstrack.com/api`) | **Live vehicle GPS tracking** (positions, drivers, geofence). Key in `integration_settings` (provider=pulsit). | `track` + `geofence-check` edge fns; `LiveFleetMap`, per-load position. |
| **Google Maps JS** (key in `index.html`, referer-restricted → browser only) | Address autocomplete (Places) + the Live Map + **in-browser geocoding** (`lib/geocode.ts`). NOTE: server-side Geocoding/Places REST is BLOCKED by the referer restriction. | AddressAutocompleteInput, LiveFleetMap, geofence coord capture. |
| **Gmail SMTP** (tracking@ / quotes@ / debtors@) | All outbound email. | `send-email` (single chokepoint; TEST MODE; logs `email_log`). |
| **Twilio WhatsApp** (sandbox) | Driver/client WhatsApp + inbound bot. | `send-whatsapp` (TEST MODE + **whatsapp_enabled kill-switch**), `whatsapp-inbound`. |
| **Google Drive** (service account) | Files PODs/docs/licences to the company Drive. | `drive-file`, `submit-pod`, `file-doc`, `drive-fetch`, `copy-vehicle-licences`. |
| **Google Sheets** (service account) | Daily importers (LoadCon, FCL, LCL, fuel). | `import-loadcon-sheet`, `import-fcl-sheet`, `import-lcl-status`, `fuel-sheet-sync`. |
| **Gemini** (AI) | Document/POD scan-to-fields, licence expiry read. | capture-load / doc-scan flows. |
| **Web Push (VAPID)** | Browser notifications. | `push-vapid`, `push-subscribe`, `send-push`. |

## 1d. Features → components
- **Routing** (`App.tsx` → currentView, sidebar `components/shared/navConfig.tsx`): management, fleet, fuel, operations (Broking), partners, quotes, workshop, finance, incidentManagement, hr, userManagement, settings, driverDashboard. Public no-login routes (query param): `?track=` `?accept=` `?update=` `?pod=` `?viewQuote=`/`?quote=` `?rfq=` `?tcs=` `?checklist=` `?invite=` `?portal=`.
- **State (contexts/):** AuthContext (login/permissions), RawDataContext (master hydrate), OperationsContext (loads + emails/WhatsApp + clients/suppliers/quotes + **waybill events** + manifests/tripsheets), FleetContext (vehicles/fuel/health/**drivers**), WorkshopContext, CommonDataContext, UIContext (views/modals/toasts).
- **Operations portal tabs** (`components/operations/OperationsPortal.tsx`): Dashboard, Day, Manifests, Trip Sheets, **📍 Live Map**, Shipments, Imports, Status Report, Containers, By Transporter; Broking: Load Board, LoadCons, Driver Chats, Deliveries/POD, PODs, etc.
- **Fleet portal tabs** (`components/FleetPortal.tsx`): Dashboard, **Asset List** (`VehicleList`→`VehicleCard`, shows linked driver), Asset Admin, Drivers (`DriversManagementView`/`AddDriverForm`), Maintenance, Checklists, **Live Map** (`LiveFleetMap`), Route Planner, Operations Log.
- **Tracking:** `LiveFleetMap` (live positions, in Fleet AND Operations), per-load live position (`LoadDetailModal` `LoadLivePosition`).
- **Cargo verification:** `CaptureWaybillEventModal` (log a check at any stage) + `WaybillTimeline`, wired into `LoadDetailModal` "Cargo Verification" section.
- **Management toggles** (Topbar, Admin/Super Admin): **EMAILS: TEST/LIVE** (`TestModeToggle`) + **WHATSAPP: ON/OFF** (`WhatsAppToggle`).
- **Modals** registered in `App.tsx` modal map (e.g. createQuote, proforma, captureWaybill, splitLoad, assignLoadCon, lclShipment, addVehicle, assignDriver…).

---

# 2. SHIPMENT LIFECYCLE FLOW (in order)
State machine: `lib/loadStatus.ts` — DIRECT vs DEPOT flow. Cargo verification spine = `waybill_events`. Tracking = Pulsit + `geofence-check`. Legend: ✅ built · ⚠️ partial · ⬜ not yet.

1. **Collection (driver).** ⚠️ Driver gets the job via a **copy-paste `?update=` link** (`LoadDetailModal` "🔗 Driver link") → no-login page (`PublicLoad` mode=update via `load-public`) where they advance status (Arrived to collect → Loaded → On route → Arrived → Delivered) + upload POD. **Cargo check** (`CaptureWaybillEventModal`): packages expected/actual, weight, condition, photos, waybill no → `waybill_events` stage=collection. ⬜ TODO: digital waybill the client signs on the driver's phone; auto-WhatsApp dispatch.
2. **Goods Received at origin depot (supervisor).** ⚠️ Status `At Collection Depot`. Log a `waybill_events` stage=origin_depot_grn (packages vs collection, damage photos). ⬜ TODO: formal GRN doc + "on floor" inventory; notify DBN+JHB ops on damage.
3. **Manifest creation (linehaul).** ✅ `OperationsManifests` → `handleCreateManifest`: select loads to the other branch, assign transporter (FBN / Loadmaster / subbie) + horse + driver, `trailer_size`. ⬜ TODO: real **trailer pairing** (Superlink 6m+12m via `linked_vehicle_id`) + **overload engine** (6m≤12t, 12m≤22t, triaxle≤28t; rigid payloads per `fleet-weight-overload-rules`; flag + override-notifies-management). `payload_kg` to populate.
4. **Linehaul dispatch (interdepot).** ✅ Status `In Transit`; manifest emailed to **destination depot ops, sending depot CC'd** (waybill/client/names/area/weight/cube/packages). Client auto-notified. ⬜ TODO: ETA line (~15h DBN↔JHB).
5. **Receiving depot check (supervisor, mobile).** ✅ `handleReceiveManifest` → loads to `At Destination Depot` (notifies client + subbie). ⚠️ `ReceiveManifestModal` (damage photos) exists but not wired into the receive flow. Log `waybill_events` stage=dest_depot_grn. ⬜ TODO: per-waybill mobile confirm + GRN.
6. **Tripsheet creation (delivery).** ✅ `OperationsTripSheets` → `handleCreateTripSheet`: floor loads → local vehicle + driver, odometer, dispatch → `Out for Delivery`. ⬜ TODO: rigid weight-category overload checks; trip-sheet "Completed"/return.
7. **Geofence tracking.** ✅ `geofence-check` cron (every 10 min): truck within 500 m of collection/delivery → auto-advance status (`At Collection Point` / `Out for Delivery`) via `load-public` (notifies client + driver) + emails branch ops. Coords captured in-browser (`lib/geocode.ts`), auto-backfilled when a load is viewed. ⏳ coverage fills as loads are opened.
8. **POD (completion).** ✅ Driver uploads signed POD (`?pod=` → `submit-pod` → Storage + Drive). **POD authorisation gate**: held `pending` (or `blocked` if contaminated) until an admin authorises (`authorise-pod`); only then emailed to client + stored on the client portal. Status `POD Submitted` → `Delivered`/`Invoiced`. ⬜ TODO: digital signature + client remarks → conditional damage photos on the driver page.

---

# 3. SUBCONTRACTOR LOGIC
- **In-network (Gauteng/KZN, DBN↔JHB) = FBN own trucks (or Loadmaster for linehaul) — NO subcontractor.** The load detail shows "FBN Vehicle / Driver"; the subbie section is hidden.
- **Out-of-network (CPT/PE/EL/Bloem…) = onward forwarding.** Manual `onward_required` toggle reveals the subcontractor section; FBN collects on its own truck, then a subbie takes it on (collects from us or we drop at the depot).
- **Fully brokered** (subbie collects AND delivers): `supplier_id` set at booking → lives on the Broking Load Board; subbie LoadCon + chase crons; no FBN truck/depot leg.
- **Multi-transporter split** (one waybill, several trucks/subbies): `load_group_id` + `is_primary`; ONE client charge; each subbie gets their OWN LoadCon and never sees the others; per-leg `leg_role` + `pod_required` + routing; group-aware margin.
- **What still applies when a subbie handles collection/delivery:** status updates (`load-public`/WhatsApp bot), client phase emails, the same **damage/photo capture** (`waybill_events`) and POD authorisation gate. Damage photos are always stored, sent to the client only on request.
- **Comms separation:** client emails → client side only; subbie emails → subbie side only (enforced by `dropAddrs`); `loadcons@` CC'd on everything. Margin rule: LoadCon shows transport rate (no client data); Client Order shows client rate (no subbie data); POD is rate-free.

---

# 4. RULES — NEVER DO THIS
- **Never create a new fleet / vehicle / trailer list** — it already exists in the **`vehicles`** table (trailers included; Superlink pairs via `linked_vehicle_id`).
- **Never create a new driver list** — it already exists in the **`drivers`** table. The driver↔truck link is **`drivers.assigned_vehicle_id`** (NOT `vehicles.assigned_driver_id`, which is a legacy FK to `profiles`).
- **Never create a new vehicle/asset list** — use `vehicles`. Render the driver via `drivers.assigned_vehicle_id` (see `VehicleCard`).
- **Never create a new clients/suppliers/loads table** — use `clients`, `suppliers`, `load_confirmations`.
- **Never hard-code or duplicate an API key** — third-party keys live in `integration_settings` (server-only). The browser calls an edge function (e.g. `track`), never the third party directly.
- **Never send email/WhatsApp inline** — route through `send-email` / `send-whatsapp` (they enforce TEST MODE + the WhatsApp kill-switch). Email HTML source of truth = `lib/loadEmails.ts` / `lib/emailTemplate.ts`.
- **Never use bare `supabase.from()` for user writes** — use the freeze-proof `direct*` helpers.
- **Never redeploy a public edge fn via MCP without setting `verify_jwt:false`** — `load-public`, `whatsapp-inbound`, `eta-confirm`, `quote-respond`, etc. are public links; the MCP default flips JWT on and breaks them.
- **Always read THIS file before** creating a table, connecting an API, or building a feature — and check existing tables first.

---

# 5. Edge functions (deployed) & crons
**Comms:** send-email, send-whatsapp, email-open, whatsapp-inbound, whatsapp-chase. **Public load/POD:** load-public (verify_jwt=false), submit-pod, authorise-pod, eta-confirm, capture-load. **Tracking:** track, geofence-check. **COD:** cod-hold, cod-release. **Quotes/RFQ:** quote-intake, quote-send, quote-respond, quote-request-info, quote-more-info, quote-proforma, rfq-public. **Drive/Sheets:** drive-file, drive-fetch, file-doc, copy-vehicle-licences, vehicle-docs-import, migrate-pods, import-loadcon-sheet, import-fcl-sheet, import-lcl-status, fuel-sheet-sync, fuel-xls-import, fuel-drops-import. **Admin/push/misc:** admin-create-user, admin-update-user, push-vapid/subscribe/send-push, validate-flows, daily-health-digest, ops-daily-checks, client-access-request, help-public, sa-email.

**Crons (pg_cron):** `whatsapp-chase-30min` (*/30) · `ops-daily-checks` (07:00 SA — routes day-of collection reminders to branch ops) · `collection-eta-check-10min` (*/10) · `geofence-check-10min` (*/10) · `fuel-sheet-sync-6h` · `validate-flows` (4×/day) · `import-loadcon-daily` · `import-fcl-daily` · `import-lcl-status-0..4` · `fbn-daily-health-digest` (06:00).

---

## Fuel/bowser sync — 2026-06-26 (latest)
- **Vehicle fuel** now syncs from ONE master Google Sheet "Fleet Managment Data"
  (id 1iTOj8GVbQV8Y3y9OqjW8RfyU7u4lxqY776BOxfJz978; DBN/JHB FILLINGS tabs) via edge fn
  **`master-fuel-sync`** (Sheets API, header-detect cols, DD.MM=2026 dates) → `fuel_entries`,
  dedup. Cron **`master-fuel-sync-6h`** REPLACED the old folder `fuel-sheet-sync-6h`.
- **Bowser** gauges synced by **`bowser-sync`** (+ cron `bowser-sync-6h`) from the `.xls` bowser
  ledger sheets (running balance → `bowsers.current_stock_liters`; drops→`bowser_refills`).
  TODO: move bowser onto the master sheet (dip-column mapping) when `.xls` is retired.
- Diagnostics: `sheet-inspect` (list tabs / dump a tab via Sheets API), `fuel-dump`.
  See memory `fuel-module` for sheet IDs, tab gids, column maps, dip variance, and the build plan.

## Session additions — 2026-06-26 (later)
- **New edge fns:** `track` (Pulsit proxy), `geofence-check` (cron), `cargo-details` (the public
  Complete-cargo-details page backend), `quote-proforma` v4. **New cron:** `geofence-check-10min`.
- **New public route:** `?complete=<id>` → `CompleteCargoDetails` (ops fill missing waybill/weight/
  dims/cube/rate + condition + damage photos; saves load + logs `waybill_events` GRN).
- **New tables:** `waybill_events` (cargo-verification spine), `integration_settings` (Pulsit key).
- **New columns:** `load_confirmations`.{onward_required, collection_lat/lng, delivery_lat/lng,
  geofence_collection_at/geofence_delivery_at}; `rfq_requests`.{packages, dimensions, cube_m3};
  `trip_sheets`.stops (ordered delivery run: loadId/order/urgent); `email_settings`.{whatsapp_enabled,
  client_live_tracking}; `drivers.assigned_vehicle_id` now populated (driver↔truck links).
- **RLS fix:** `rfq_requests`↔`rfq_recipients` recursion broken via SECURITY DEFINER `rfq_org()` /
  `rfq_is_recipient()`.
- **Management toggles (Topbar, Admin/Super Admin):** WHATSAPP on/off, CLIENT TRACK on/off (notifications
  keep running when off).
- **Comms rule:** client NOT emailed for internal depot statuses (At Collection/Destination Depot,
  Unloaded) — clean milestones only. Depot arrival → ops "complete details" email + push; no rate → admins + push.
- **In progress (memory):** Delivery Run / Tripsheet v2 (Phase 1 done — ordered stops/reorder/urgent;
  Phases 2-4 pending: route optimise, driver run page, per-stop client ETA). Email control centre (spec only).

## Session additions — 2026-06-27
- **Subcontractor onboarding (built 2026-06-26, recorded here):** public 5-step **`/supplier-register`**
  (also `?invite=<token>` / legacy `?portal=become-supplier`) → edge fn **`supplier-register`**
  (verify_jwt=false): uploads docs to the private **`supplier-applications`** bucket, captures IP+timestamp,
  generates the **signed-agreement PDF**, inserts a Pending `supplier_applications` row, emails applicant+admins.
  SLA single-sourced in **`lib/subcontractorSla.ts`** (Terms page + step 5 + PDF; GIT min R1.5m + ECT Act clause).
  Vetting in **`SupplierApplicationDetailModal`** (company/fleet/routes/agreement + signed-URL doc viewing via
  edge fn **`supplier-doc-url`**, verify_jwt=true, role-gated). Approve → `suppliers` row + auth login
  (`admin-create-user`). Invitation broadcast = **`CarrierInviteCampaign`** (in `SubcontractorControlCenter`) →
  funnel On List→Invited→Applied(on register)→Vetted(on approve).
- **Carrier routing steering (2026-06-27):** **`lib/carrierEligibility.ts`** — subbie pickers lead with VETTED
  carriers + flag un-vetted (AssignLoadConModal "Vetted only" toggle + warning; OfferLoadModal tiebreak;
  CreateQuoteForm + RfqBoard). Soft steer, never a hard block. Gate = `suppliers.is_vetted` (complianceStatus is
  unmaintained — 0 Compliant; `regions` empty so lane-routing infers from load history).
- **Quotes:** line items carry **`truckType`** (in the items jsonb; `QUOTE_TRUCK_TYPES`) shown on the client
  quote + PDF. Quote status changes are now OPTIMISTIC (`handleSetQuoteStatus`/`patchQuoteLocal`) so the list
  updates without a reload.

_Companion deep-dives live in the `memory/` notes (supplier-self-registration, supplier-onboarding-todo, depot-linehaul-process-spec, cargo-verification-journey-spec, vehicle-tracking-pulsit, fleet-structure, scheduled-jobs, comms-routing, etc.)._
