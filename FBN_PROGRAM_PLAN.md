# FBN Fleet — Full Program Build Plan

The single source of truth for what this system must do and the order we build it.
Plain-English; Marc (owner, non-technical) drives priorities. Update this file as
items ship.

---

## How this project is built (conventions)

- **Live deploy:** the production site (https://fleet-managment-system-kappa.vercel.app)
  deploys from the **`main`** branch. Active work is on **`migration/supabase`**.
  After committing, promote to live with `git push origin migration/supabase:main`.
- **Persistence:** every write goes to Supabase via `runWrite()` (`lib/supabase.ts`,
  refresh-session + retry) using the mapper helpers in `lib/mappers.ts`
  (`map*` / `to*Insert` / `to*Update`). Handlers return `{ ok, error }` so the UI
  can show failures — never fail silently.
- **Before every commit:** `npx tsc --noEmit` and `npx vite build` must pass.
- **DB:** Supabase project `kyosepbdxjwugunylvyo` ("fbn-fleet"), org
  `00000000-0000-0000-0000-000000000001`. RLS via `auth_org_id()` / `auth_is_admin()`
  / `auth_is_ops()` etc. Regenerate `lib/database.types.ts` (or hand-patch) after
  schema changes.
- **Forms:** define sub-components and class strings at module scope (not inside the
  form) or inputs lose focus while typing. Always wrap async submit in try/finally so
  the button can't stick on "Saving…".

---

## DONE (live)

- Supabase migration; fuel import + analytics; per-vehicle fuel log.
- Persistence sweep (checklists, tyres, bowsers, procurement) + inspection→maintenance loop.
- In-app add-user (edge function); role gating; compliance widget; live notifications.
- Vercel permanent deploy; left-sidebar navigation; slim top bar + global search.
- LoadCon (Transport Order) capture form with smart prefill.
- **Named contacts per client & subcontractor** — pick company → pick person → email auto-fills; new people saved back; management can edit the list.
- **LoadCon ⇄ dispatch unified:** a Transport Order with a subbie is linked + marked
  assigned on creation (no re-assign); assigning a subbie auto-fills the LoadCon doc fields.
- Dashboard analytics: Load Pipeline, Subcontractor Margins, Top Clients.
- Booking form: choose-or-add client, vehicle spec options (incl. Dedicated/Consolidated),
  collection + delivery dates and times.

---

## BACKLOG (priority order)

### P1 — Make the daily flow correct & complete

1. **Google Maps addresses** *(config)*: the Maps script now expects
   `VITE_GOOGLE_MAPS_API_KEY`. **Action for Marc:** create a Google Cloud key with
   *Maps JavaScript API* + *Places API* enabled and billing on, then add it as an env
   var in Vercel. Until then, address autocomplete won't suggest (you can still type
   addresses manually).
2. **Drivers can't be assigned** — the driver dropdown only lists people with a *login*
   (profiles). Fleet-list drivers have no login, so it's empty. **Plan:** make drivers
   first-class records (a `drivers` list: name, cell, licence/PDP, assigned vehicle,
   branch) that don't need a login; the fleet master-list names seed it. Assign
   dispatch picks from this list (and still allows internal staff users). Surface the
   driver's cell for POD/tracking comms.
3. **LoadCon documents (3):** generate from a saved load —
   - LoadCon → subcontractor (shows **transport rate**, NOT client/ client rate)
   - Client Order → client (shows **client rate**, NOT subbie / transport rate)
   - Delivery Note / POD (rate-free, for sign-on-delivery)
   View / download / print (browser Save-as-PDF). *(Next up.)*
4. **Send to transporter (email):** from a saved load, email the LoadCon to the subbie
   and the Client Order to the client, from `tracking@fbn-transport.co.za` (Gmail
   enterprise) using the real sender's name so replies come back to tracking@. Needs a
   Supabase edge function + the app password stored as a Supabase **secret** (never in
   code). **Action for Marc:** confirm/regenerate the app password when we wire this.

### P2 — Suppliers & onboarding

5. **Supplier onboarding + portal:**
   - Add a new supplier, then **request the standard vendor pack** (application form,
     company docs, tax clearance, BEE, insurance, fleet list, rate card, etc.) via a
     secure link / supplier login.
   - Supplier logs into the **supplier side** to: upload those docs; **view current &
     past loads**; **upload PODs per LoadCon**; **update load status / comms** when not
     done by phone.
   - **Document expiry reminders** (insurance, etc.): store expiry dates, flag expiring/
     expired, notify ops; block assignment to a non-compliant/expired carrier.
   - Builds on the existing `suppliers`, `supplier_compliance_docs`, `supplier_applications`
     tables + Supabase Storage for files.

### P3 — Users, roles & internal comms

6. **Roles & permissions (RBAC):**
   - Super Admin can **add and edit** users (done: add). Add full **edit**.
   - **View-only per tab:** a user can *see and work in* certain tabs but not edit
     others; management chooses each user's tab access + edit rights.
   - **Per-user workspace personalization controlled by management** — today each user
     can reorder/hide their own tabs; management must be able to set & lock this per user.
7. **Internal messaging / request-to-change:** an on-site message system for internal
   comms — e.g. a user who can't edit can *request a change* and route it to the right
   person; also used for load-status updates and general team comms.

### P4 — Notifications & history

8. **Notification rules — multi-recipient:** each rule (e.g. "New Critical Job Card")
   can target **one or many** people, or **everyone applicable**, chosen per row.
   Replace the single-role dropdown with a multi-select of personnel/roles.
9. **Import historical LoadCon sheet:** upload Marc's existing LoadCon spreadsheet to
   bring in past loads for history + analytics (map columns → load fields, dedupe,
   store, feed the dashboards).

### P5 — Tracking & mobile (later)

10. Operations tracking board (advance status, notes, POD upload).
11. Driver / sub **mobile trip link**: online POD signed on phone & returned.
12. Automated comms agent at each journey step (email first, then WhatsApp/Twilio).

---

## Open config actions for Marc
- [ ] Add **Google Maps API key** to Vercel env (`VITE_GOOGLE_MAPS_API_KEY`).
- [ ] Confirm/regenerate **tracking@ Gmail app password** (for email send) when we wire P1#4.
