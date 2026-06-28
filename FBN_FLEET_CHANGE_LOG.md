# FBN Fleet Management System — Change Log
> Maintained by Marc Snyman | Last updated: 2026-06-28
> Use this file at the start of every Claude Code session — paste it in with the instruction: "Read this change log and action the next PENDING item."

---

## 2026-06-27/28 — Portals (Sessions 1-4) + date standard (DONE)
- **Subcontractor portal (Sessions 1-3, LIVE):** public `/supplier-register` (5-step + signed-agreement PDF,
  R1.5m GIT SLA) → vetting → invitation broadcast funnel → full carrier portal (Dashboard, RFQ board, My Loads
  with status+exceptions, Invoicing, Load Board, Documents reminders + Profile). Light brand theme. See
  `PORTAL_BUILD_SESSIONS.md` + memory `subcontractor-portal`.
- **Client portal (Session 4, LIVE):** public `/client-register` → approve from Clients tab → welcome login;
  portal = Dashboard, Request a Quote (feeds the staff Quotes pipeline), My Quotes, My Loads
  (timeline/vehicle/driver/ETA/exceptions/POD download), Shipments & Tracking (containers + LCL), Financial
  Documents (invoices + remittance upload). Per-client RLS; scoped containers/lcl_shipments. Memory `client-portal`.
- **Date standard:** all date inputs now the DD/MM/YYYY DateField program-wide; guard hook prevents regressions.
- **Also (earlier in the run):** quote stale-status fix, quote line truck-type, carrier routing steering, COD
  automation (auto-hold + auto-proforma + split-leg hold).
- **PENDING / next:** checklists (awaiting Marc's plan); full CRM quoting dashboard + client marketing + subbie-RFQ
  integration (to scope); full client-invoice/statement/credit-note backend (deferred).

## 2026-06-26 — Public subcontractor self-registration + R1.5m GIT SLA (DONE)
- **NEW public registration** at `/supplier-register` (also `?invite=<token>` and legacy
  `?portal=become-supplier`): a 5-step, no-login flow — company details → per-vehicle fleet
  builder → routes (9 lanes + per-lane load types) + cross-border countries → certifications
  upload with expiry (GIT required min R1.5m, HAZCHEM, RTMS, COID, cross-border permits) →
  FBN SLA + full name/ID/position + acceptance checkbox.
- **`supplier-register` edge fn** (public): uploads docs to the private `supplier-applications`
  bucket, captures IP + timestamp server-side, generates the **signed-agreement PDF**, inserts
  a `Pending` `supplier_applications` row (onboarding queue), emails applicant + admins.
  Tested end-to-end on the live function.
- **SLA single-sourced** in `lib/subcontractorSla.ts` (Terms page + registration + PDF):
  **GIT minimum R800,000 → R1 500 000,00 per load** and added the **ECT Act 25 of 2002**
  electronic-acceptance clause. Company stays FBN Transport CC (Reg 1989/001182/23).
- **PENDING follow-up**: vetting view should render the new structured detail (vehicles/
  routes/cross-border) + signed-URL links to docs + the agreement PDF; then gate routing/
  quoting to approved carriers (see supplier-onboarding TODO).

## 2026-06-22 — LCL Status Report, Ops dashboards, FCL flow, transit broking, email/deploy fixes (DONE)
- **DEPLOY ROOT-CAUSE FIXED**: Cloudflare deploy command was `wrangler versions upload`
  (uploaded a version but never promoted to live) → changed to `wrangler deploy`. This
  had made every push build but never go live, masking saves/edits as "not working".
  Added **VersionWatcher** (auto-update pill) so stale tabs self-refresh. See CLAUDE.md.
- **LCL groupage Status Report** (Operations → Status Report): new `lcl_shipments` table +
  edge fn `import-lcl-status` (Sheets API, per-sheet `?i=`, 4 daily crons) = 13,796
  shipments from the 4 client status sheets. Free-time clock (3 days / HAZ 1 day),
  **Agent (bill-to=DHL) vs Consignee (end client=IFF)** + billing-client link (trigger
  `lcl_set_agent`), **bulk update** (unpacked/collected/delivered), DateField dates,
  **CRA + damages** (notes + photos + email-to-client), DRO scan to auto-fill.
- **Ops dashboards**: Daily Overview (pipeline + FCL panel), Month View (+ filters +
  Print/PDF), By Transporter viewer, Deliveries/POD Day View.
- **FCL flow model** on containers (route plan, unpack who/where, storage in/out, empty
  turn-in, consol ref) + sort/group + Daily Overview panel. Depot/Bulk collection moved
  to **Imports** (it is LCL, not FCL).
- **Transit-depot broking** (CPT→FBN JHB→DBN) on both Broking Collection + Transport Order:
  subbie LoadCon delivers to the transit depot; received-at-depot + onward planning
  (fleet/subbie + date/time) + dwell; auto-notify transit depot ops.
- **Emails**: delivered-aware wording (no "accept this load" after delivery) routed through
  the ONE shared `lib/loadEmails` builder (removed duplicate HTML in SubcontractorLoadsView);
  subjects show routing (Client Order CPT→DBN; LoadCon CPT→JHB), threaded; client order no
  longer shows internal routing. "Upload POD" contact role (accounts). Delivery DATE now
  required on Transport Order.
- **FBN DI / Waybill** field on booking + LoadCon/Order/POD. **Client CRM**: per-contact
  "Based", "Pull controllers from status report". **Capture** photos labelled
  (Loading/Offloading/Damages) + camera/gallery. Fixed: hidden brokered loads (no
  supplier_id), edit-form lost pick-lists, unreadable global search dropdown.

**2026-06-22 (continued, same day):**
- **LCL per-depot collection grouping** ("Ready to collect" → book one depot collection →
  on the board + shipments marked Collected/linked). **Controller column** +
  `lcl_controllers` (name/email/cell). **App-as-master**: `app_locked` + sheet sync 3×/day
  (9/15/21 SAST) skipping app-managed rows. **Daily health digest** (06:00 email of
  storage-risk/POD-out/stalled/stale-import). Quote emails CC `quotes@`; "more info
  requested" date + re-request guard. **Guard-rails**: back-dated confirm, negative-margin
  warning, open-client-request alert. **Tabs grouped** Dashboard/Work/Track/Reports
  (Broking & Operations stay separate). `lib/format.ts` shared formatters. Client app set
  **noindex**.
- **Transit flow corrected** (the key fix): received-at-FBN-depot → **At Collection Depot**
  (line-haul ready) not "At Destination Depot"; flow = depot → line-haul manifest →
  destination depot → local delivery; client track shows In Transit (not premature Out for
  Delivery); buttons "FBN planned delivery" / "Reroute with subbie"; subbie gets no onward
  updates/POD on a transit load. Fixed the "Onward on FBN fleet" crash (wrong modal).
- Email sender note: send FROM `quotes@` requires it as a verified Gmail "Send mail as"
  alias on the tracking@ account (done). Pro-URL plan: `control.fbn-transport.co.za` via
  subdomain delegation to Cloudflare (owner to action).

## 2026-06-19 — Partners UX, contact prefs, HARD separation rule, containers on collections (DONE)
- **Clients & Subcontractors lists**: search box + alphabetical sort.
- **Contact prefs split** into 3 independent toggles — **Order/LoadCon · POD ·
  Status updates** (added `contact.getsPod`). Clients show **Order** (never
  "LoadCon"); suppliers show **LoadCon** (ContactsEditor `kind` prop).
- **HARD client/subbie separation rule** (lib/loadEmails `dropAddrs` +
  `lc_subbieAddrs`/`lc_clientAddrs`): client emails strip every subcontractor
  address; subbie emails strip every client address. A client can NEVER receive
  the LoadCon/rate and vice-versa. Do not remove.
- **Collections capture who logged** (`fbnRepresentative`) + branch (Broking + ops).
- **Container collection toggle** on both collection forms → container #/seal/size/
  operator/empty-turn-in → load special instructions + a Container record.
- Trip-sheet + Assign-FBN pickers branch-scoped (own branch + LM), vehicles
  smallest-first, drivers A–Z. Delivered status email now asks for POD upload.

## 2026-06-19 — Depot workflow: branch boards, incoming, planning, broking collection (DONE)
- **Branch-scoped Shipments board** — defaults to the user's own branch
  (assignedBranches); managers get All. **Incoming-from-other-depot strip** (en
  route / arrived, "since yesterday").
- **Planning tab** (Operations) surfaces DailyPlanningView; **+ Manifest** and
  **+ Trip sheet** buttons now work and **persist** (manifests / trip_sheets tables,
  auto-numbered) — were local-only before.
- **Broking quick-collection** (`BrokingCollectionForm`, "+ Collection" in Broking):
  mobile capture + assign transporter → auto-sends LoadCon + client order; finish
  details later. Mirrors the ops collection.
- **Status email fix:** once a load is Delivered the supplier email asks to UPLOAD
  POD (?pod= link) instead of "push next update".
- **Fuel tanks** show **last-filled date + litres**; one-click **Import fuel month**
  across DBN/JHB/LM Drive folders.

## 2026-06-19 — Import / groupage module (FCL + LCL) (DONE)
- **Scan a cartage advice / delivery order → create an import consignment**
  (`CartageAdviceScanModal`, "📄 Import (scan)" in the Operations area). Extracts
  collect-from / deliver-to / forwarder + consignee / packages / weight / refs;
  ops picks who to bill (forwarder vs consignee). FCL = collect-now; LCL = lands
  in the depot watch.
- **Imports / Depot Watch board** (`ImportsBoard`, Operations → Imports): LCL
  consignments grouped by unpack depot (ZACPAK/CHC/ICS/IWS/SACD), awaiting
  unpack → **Mark released** → **Book collection** sends one vehicle for all the
  depot's ready cargo (shared collection_ref + branch ops email), then they ride
  the Shipments board to consolidate.
- New columns `unpack_depot`, `import_stage` (awaiting_release→released→collected)
  on load_confirmations; awaiting/released hidden from the Shipments board + Ops
  dashboard until booked. Cartage schema added to `lib/docScan.ts`.

## 2026-06-19 — Doc scan, management snapshot, flat Broking/Operations tabs (DONE)
- **Broking + Operations are flat sidebar tabs** (dropped the dropdowns); both
  open the Operations portal, which shows the matching area's tab strip + its own
  dashboard keyed off `currentView`. They appear in Workspace Personalization.
- **Management dashboard snapshot** (`BrokingShipmentsSnapshotWidget`): per side of
  the business — not collected, not delivered, not updated since yesterday,
  awaiting POD. Added `updatedAt` (load_confirmations.updated_at). Layout → v5.
- **Document scan** (reuses the app's Gemini pattern, `lib/docScan.ts` +
  `DocScanButton`): Log Container has "📄 Scan arrival doc" (fills container #/seal/
  size/weight/vessel/line/ETA/client/ref); Bulk/Depot has "📄 Scan manifest"
  (extracts the whole consignment table into rows). Upload image/PDF, review, save.

## 2026-06-19 — Broking / Operations split into grouped nav (DONE)
- Sidebar now has **collapsible groups**: **Broking** (Dashboard / Load Board /
  LoadCons / Emails / Driver Chats / Doc Settings) and **Operations** (Dashboard /
  Shipments / Containers). Each child deep-links into the operations portal sub-view.
- New **Operations Dashboard** (`OperationsOverview`) for own consolidation/line-haul:
  stage KPIs, cargo-to-move by lane, awaiting-driver + awaiting-POD queues.
- **Broking Dashboard** now shows brokered freight only (excludes `is_collection`).
- Portal shows only the active area's tab strip + an area badge so the two
  "Dashboard" tabs are clear. Files: `navConfig.tsx`, `Sidebar.tsx`,
  `OperationsPortal.tsx`, `OperationsOverview.tsx`, `OperationsDashboard.tsx`.

## 2026-06-18/19 — Operations sub-system + go-live hardening (DONE)
- **Google sign-in** for staff (@fbn-transport.co.za); fixed the wedge + auto clean-reload after OAuth.
- **Freeze-proof everything**: client/subbie edits, fuel/bowser saves, the 38-table hydrate, and ALL emails (`invokeFn`/`directSelect`) — the supabase-js auth-lock wedge was silently dropping saves + sends.
- **Live status tracking**: board progress bar + timestamped Status Timeline; back-dated POD-first flow; "loaded" confirmation (packages/issues).
- **Email tracking** (email_log + open pixel) grouped per load (Client vs Supplier/Driver). **Client-order threading** (one subject per load). Fixed multi-CC (553) + client-order leaking to subbie CC.
- **Per-contact email routing** (docs vs updates) + **multiple supplier emails**.
- **Fuel** is its own sidebar module (tanks, CPK, Google-Drive auto-import).
- **Operations sub-system**: renamed Broking→Operations; **Shipments** board (consolidation/line-haul), **Containers** monitoring, **+Collection** & **+Bulk/Depot** intake, capture (weigh/measure/photos/cube), inter-branch handover, **branch-routed ops emails** (opsdbn/opsjhb/ops@).
- **Web push** notifications; **UPPERCASE** data entry (emails/phones excluded); **editable commodity/packaging lists**; **validation loop** (on-create warnings + `validate-flows` watchdog cron).
- See memory `operations-shipments`, `collections-and-push`, `scheduled-jobs`, `email-sending`, `google-signin` for detail.

---

## How to use this log

| Field | Description |
|---|---|
| **ID** | Unique reference — use in Claude Code to track the task |
| **Type** | Bug / Change / Feature |
| **Priority** | P1 = fix now / P2 = next session / P3 = backlog |
| **Status** | PENDING / IN PROGRESS / DONE / PARTIAL |
| **Files likely affected** | Best guess at which files Claude Code will need to touch |

## Where the bigger picture lives
- **Roadmap / master plan:** `FBN_PROGRAM_PLAN.md` — the full build backlog and the order things ship. This change log is the *running task list*; the program plan is the *roadmap*.
- **Project skill (the "logic"):** `.claude/skills/fbn-fleet/` — encodes the app's conventions, architecture, and the deploy rules so any session works the same way.
- **Deploy reality (important):** the **live site is `https://fleet-managment-system.marcsnyman.workers.dev` (Cloudflare Workers)**, auto-built from the **`main`** branch. Work is on `migration/supabase` and promoted to `main`. (The program plan still mentions Vercel — that's outdated; Cloudflare is current.)
- **Freeze-proof writes:** the app's #1 recurring bug was the browser's Supabase client wedging so a save never left the browser. The fix pattern is `directInsert` / `directUpdate` / `directDelete` / `directSelect` / `directInvoke` in `lib/supabase.ts` (plain `fetch` with the token from storage). **Reuse these for any new write that users report freezing.**

---

## Change Items (open)

### CHG-002b
- **Type:** Change · **Priority:** P3 · **Status:** PENDING
- **Title:** Show ETA nicely on tracking / detail (formatted)
- **Description:** ETA is now captured via a date+time picker (CHG-002 done). Optionally format it as `18 Jun 2026, 08:00` on the client tracking page and load detail instead of the raw value.
- **Files:** `components/PublicLoad.tsx`, `components/operations/LoadDetailModal.tsx`

### CHG-003 — Status update communications engine
- **Type:** Feature · **Priority:** P2 · **Status:** PARTIAL (blocked on WhatsApp sender)
- **Done so far (email):** client gets an email at each status milestone (`sendClientPhaseEmail`); POD is auto-requested from the transporter when a load hits Delivered; an **AMENDED — please re-confirm** email fires if a sent load's details change; FBN staff can already advance any status manually on the Load Board (the "FBN override").
- **Still to build:** the **WhatsApp** channel; the **persistent chase loop** (keep requesting the next phase until the transporter responds or the POD closes the file); and **non-response flagging** into the KPI scorecard (see CHG-003b).
- **Blocked on:** a WhatsApp Business sender — Twilio (Account SID + Auth Token + WhatsApp number) **or** Meta Cloud API token. Full message flow already captured in memory (`whatsapp-driver-bot-spec`).
- **Files:** `contexts/OperationsContext.tsx` (senders + status hooks), new `whatsapp` edge function + inbound webhook, KPI module.
- **Confirm with Marc:** does this apply to FBN own drivers too, or subcontractors only?

### CHG-003b — Transporter KPI scorecard (response tracking)
- **Type:** Feature · **Priority:** P3 · **Status:** PENDING (depends on CHG-003)
- A basic transporter scorecard already exists in Broking analytics; this adds **update-responsiveness** as a tracked metric (each missed update request = a negative signal). Build alongside the chase loop.
- **Files:** `components/operations/BrokingAnalytics.tsx`, status-update hooks.

### CHG-004 — Get POD: request, upload, store, notify client
- **Type:** Feature · **Priority:** P2 · **Status:** DONE (email) — WhatsApp + optional Drive push pending
- **Done:** "Request"/"Get POD" emails the transporter a no-login upload link (`?pod=<id>`); driver uploads a **photo + on-screen signature** (`PublicPodUpload` → `submit-pod` edge function) which stores it on the load; the **client is auto-notified** when the POD lands (`sendClientPodEmail`) and the **subcontractor gets a copy** (`sendSupplierPodEmail`); plus a manual **Send / Resend POD** button on both the LoadCons list and the load detail. All safe under TEST mode.
- **Still optional:** WhatsApp upload link (pending sender); push the POD to a Google Drive folder; attach the actual PDF vs. a view link (currently a view/download link).

### CHG-005 — Google Maps address search + contact pull-through
- **Type:** Feature · **Priority:** P2 · **Status:** BLOCKED on Marc
- Address autocomplete on collection/delivery is built but inactive — needs a **Google Maps API key** set as `VITE_GOOGLE_MAPS_API_KEY` in the Cloudflare build env (key restricted to the live URL). Contact-number pull works only for named businesses (Google has no phone for plain street addresses).

---

## Completed Items (this build run — 2026-06-16/17)

- **CHG-001 — User role save no longer hangs.** Root cause: `supabase.functions.invoke` wedging. User create/update now go through freeze-proof `directInvoke`. **DONE.**
- **CHG-002 — ETA at loading point is now a date+time picker** (combined `datetime-local`) on the acceptance page, stored on the load. **DONE.**
- **LoadCon create no longer freezes** — saves via freeze-proof direct REST; root cause was the browser Supabase client wedging (verified the DB itself saves instantly).
- **LoadCon edit no longer freezes / loses focus** — direct-REST update; field component moved to module scope so inputs keep focus.
- **Carrier acceptance no longer hangs** — public page uses direct fetch; bigger card.
- **Editing a sent load re-sends an AMENDED LoadCon** for re-confirmation, listing what changed.
- **Email TEST MODE** — Super-Admin toggle (top-right pill); when ON, every email routes only to marcsnyman@ with a `[TEST]` banner. Defaulted ON. Enforced inside the `send-email` function (one chokepoint).
- **LoadCon numbers** are now clean running numbers: `FBN-2026-06-0001` (per month).
- **Routes** A–Z sorted, editable (type a new one); **Load Types** ascending; **dates** DD/MM/YYYY with calendar pick.
- **Pick a client → prefills from their last load** (addresses, contacts, route, commodity, packaging, load type, weight, rate).
- **LoadCon email carries the details** (loading date, size/type, weight, special instructions) and flags if the PDF couldn't attach.
- **Load Board:** shows transporter name (green) / "Needs transporter" (amber); **Accepted ✓** + driver/reg/ETA on cards; **auto-refresh every 30s** + manual refresh; columns fill the page.
- **Send / Resend POD** to client or any address (LoadCons list + load detail).
- **Super Admin can Archive or Delete** an incorrect / failed load (from its detail).
- **Doc Settings → Email Preview** tab to verify every email's look & wording.
- **Roles & Access:** added **Accounts** + **Ops** roles (DB enum + RLS); role dropdown offers all 5 roles; **Users → Role Access matrix** (org-wide per-role module visibility); **per-user override** on Edit User.
- **Workspace Personalization fixed** — moving/hiding nav tabs now updates instantly and saves.
- **Modals** no longer close on a stray backdrop click; a transient session blip no longer force-reloads the page (no more lost work mid-form).

---

## Session Notes

| Date | Session Summary |
|---|---|
| 2026-06-17 | Actioned CHG-001 (role save hang → fixed via directInvoke) and CHG-002 (ETA date+time picker). Logged the full build run's completed items. CHG-003/003b and the WhatsApp side of CHG-004 are blocked on a WhatsApp Business sender; CHG-005 blocked on a Google Maps key. Roadmap = `FBN_PROGRAM_PLAN.md`; project logic = `.claude/skills/fbn-fleet/`. |
| 2026-06-17 | Initial change log created. 4 items logged (CHG-001 to CHG-004). |

## 2026-06-28/29 — Workshop Parts 5–8/11, inspection v2/v3, Driver Hub
- Inspection refinements (reorder, licence scan, per-type trailers, flatbed checklist, axle-end tyres,
  triangles count, fire-ext per-unit photos, plain-English outcomes). Fixed save (user_id nullable) + trailers.
- Part 5 notifications + auto job-cards + grounding gate; Part 6 Checklist Review; Part 7 job-card list (one per
  inspection, defects); Part 8 procurement (request→authorise→PO→receive); Part 11 tyre ops persist + light theme.
- Driver Hub at /driver (no-login): inspection / breakdown / incident / logs. New driver-hub edge fn.
- NEXT: custom domain control.fbn-transport.co.za (memory custom-domain-plan); Tyre People portal; Parts 9/10/12.
