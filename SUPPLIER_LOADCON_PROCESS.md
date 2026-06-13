# Supplier Load Confirmation — Process & Build Spec

## Goal
Replace the current **Google Form → PDF → email → Excel-in-Drive** workflow with an in-app process that:
1. Lets **staff capture the load + supplier details in the app** (one form), auto-generates the Load Confirmation **PDF**, and **emails it to the subcontractor**.
2. **Tracks the load live** through every stage on the **Operations dashboard**.
3. **Pushes updates to the client** and **chases updates from the subcontractor/driver** via **email and WhatsApp** at each step.
4. Uses a **comms agent** that automatically requests the right update at the right moment and escalates if it doesn't get one (e.g. POD not uploaded).

All data lives in Supabase (`load_confirmations` table — already rich) and surfaces in the Operations views. Nothing depends on the Google Form or the Excel file once live (we can still mirror to a Drive sheet if you want a backup).

---

## What already exists (we build ON this, not from scratch)
- **`load_confirmations` table** with: client, supplier, collection/delivery points + dates, vehicle, driver, **subcontractor driver name / cell / vehicle reg**, cargo photos, **POD photo + signature**, damage report, `sent_to_supplier_date`, payment status, invoice fields, notes.
- **Status lifecycle** (already defined): `Booked → Driver Assigned → At Collection Point → Collected → At Collection Depot → In Transit → At Destination Depot → Out for Delivery → Delivered → POD Submitted → Invoiced → Cancelled`.
- **PDF generation** already exists (SupplierLoadConPDFModal / Quote / Invoice PDF modals).
- **Client portal** (clients can be given a live view) and **Operations portal** exist.

## What we add
- A polished **LoadCon capture form** for staff.
- A **driver/subcontractor mobile link** (no login) to advance status + upload POD/photos/damages + flag delays.
- **Comms edge functions**: send email (subcontractor PDF, client updates, POD requests) and send WhatsApp (driver nudges, client updates).
- A scheduled **comms agent** that drives the step-by-step requests and escalations.

---

## CRITICAL RULE — two documents, margin protected
One load entry produces **two separate documents/emails**, and **neither party sees the other's rate or identity**:

| | **LoadCon / Transport Order** | **Client Order / Confirmation** |
|---|---|---|
| Sent to | **Subcontractor** (the carrier doing the load) | **Client** (who booked the load) |
| Shows the **rate** | **Transport rate** (`supplier_rate`) | **Client rate** (`total_amount`) |
| Shows the **carrier** | The **subcontractor** (name, driver, vehicle, cell) | "FBN Transport" only |
| **Hides** | the client name + **client rate** | the subcontractor + **transport rate** |
| Common fields (both) | collection/delivery addresses, dates/times, contacts, commodity, packaging, quantity, weight, volume, container details, equipment, special instructions, load ref / cust order no | same |

- The **LoadCon** matches the supplied PDF template (already client-free).
- The **Client Order** is a second template generated from the same record, showing the client + client rate and "FBN Transport" as the carrier — no subcontractor, no transport rate.
- The capture form collects **everything** (client + client rate **and** subcontractor + transport rate); the two documents each redact the other side. This protects the FBN margin automatically.
- On creation: email the **LoadCon to the subcontractor** and the **Client Order to the client** (client email captured on the form).

## The journey — your steps mapped to the system

| # | Your step | System status | Who updates it | What the agent sends | Data captured |
|---|-----------|---------------|----------------|----------------------|----------------|
| 1 | Load + supplier data entered | **Booked** | Controller (in-app form) | LoadCon **PDF emailed to subcontractor**; client notified "booked" | full load + supplier info |
| 2 | Driver/sub assigned | **Driver Assigned** | Controller | WhatsApp/email to driver + sub with **trip link** | vehicle, driver name, cell |
| 3 | On route to load | **En route to collection** *(new)* | Driver (taps link) | "On your way to collect?" | departed time |
| 4 | Loading? | **At Collection Point** | Driver | "Arrived to load? Loading started?" | arrival time |
| 5 | Completed loading? | **Collected** | Driver | "Loading complete? **Any damages? Collection note?**" | loaded time, qty |
| 6 | Damages / collection note | *(at Collected)* | Driver | requests **photos + collection note upload** | damage report, photos, collection note |
| 7 | On route | **In Transit** | Driver | "Departed for delivery?"; **client: in transit + ETA** | depart time, ETA |
| 8 | Any delays? | *(In Transit + delay flag)* | Driver / agent prompt | periodic "Any delays?"; if yes → **client notified** | delay reason + new ETA |
| 9 | Arrive at delivery | **At Destination Depot / Out for Delivery** | Driver | "Arrived at delivery?"; **client: arrived** | arrival time |
| 10 | Offloaded? | **Delivered** | Driver | "Offloaded?" | delivered time |
| 11 | Any damages + photos | *(at Delivered)* | Driver | requests **delivery damage photos** | photos, damage report |
| 12 | Request POD until uploaded | **POD Submitted** | Driver | **chases POD repeatedly until uploaded**; client: delivered + POD | POD photo + signature |
| 13 | Bill it | **Invoiced** | Finance | — | invoice number/date |

*(Two small additions to what exists: an "En route to collection" status and a "delay" flag/field. Everything else is already there.)*

---

## How the comms / "agent" works
Two halves:

**1. The driver/subcontractor trip link (inbound — how we GET updates)**
Each load gets a private mobile web link, e.g. `…/track/8f3k2m9x` (long random token, not guessable). The driver opens it on their phone and **taps the current step** ("On route", "Loading done", "Departed", "Arrived", "Offloaded") and **uploads POD / damage photos / collection note**. No login. Each tap updates the load's status + timestamp in the system instantly. This is far more reliable than trying to read replies from WhatsApp.

**2. The comms agent (outbound — how we CHASE and INFORM)**
A scheduled job (runs every ~15–30 min) plus instant triggers on status change. It:
- **Sends the driver/sub a WhatsApp + email** at each stage with the trip link and the specific question ("You've been en route 2h — arrived to load yet?").
- **Escalates** if no response (re-asks; if POD still missing after delivery, keeps requesting and flags the controller).
- **Updates the client** at milestones (booked, in transit + ETA, delays, delivered, POD ready) by email/WhatsApp.
- Logs every message sent against the load (full audit trail).

Controllers also see everything on the **Operations tracking board** and can update/override any step and message manually.

---

## Architecture (the build, in plain terms)
- **LoadCon capture form** (React) → saves to `load_confirmations` → generates PDF → calls **`send-loadcon-email`** edge function to email the subcontractor.
- **Operations tracking board** → loads grouped by status (Kanban-style) with live updates, notes, manual actions.
- **`/track/{token}` mobile page** → driver self-service; writes via a **write-only edge function** (anon, rate-limited — can only update its own load, never read other data).
- **Comms edge functions** → `send-email` (via Resend or your SMTP) and `send-whatsapp` (via Twilio).
- **Comms agent** → Supabase scheduled function (cron) for nudges/escalation + instant sends on status change.
- **Client view** → existing client portal shows live status; client comms via the same email/WhatsApp functions.

---

## Suggested build order (phased — each phase is usable on its own)
- **Phase A — Capture & PDF & email-to-sub.** In-app LoadCon form replaces the Google Form; saves to Supabase; generates the PDF; emails the subcontractor. *(Biggest immediate win — kills the Google Form.)*
- **Phase B — Operations tracking board.** See/advance every load by status in-app; controllers update steps, add notes, upload POD/photos.
- **Phase C — Driver/sub trip link.** Mobile `/track/{token}` for drivers to tap steps + upload POD/photos/damages + flag delays.
- **Phase D — Email comms.** Client updates + automated POD chasing by email.
- **Phase E — WhatsApp comms (Twilio).** Same messages over WhatsApp.
- **Phase F — Comms agent.** Scheduled nudges + escalation at every step.

---

## What I need from you
1. **Your Google Form fields** — a screenshot or list of every field you fill in (load details + supplier info), so the in-app form captures exactly the same.
2. **A sample of the LoadCon PDF** you currently email the subcontractor (so I match the layout), and **the Excel column headings** you log to in Drive (so we capture every tracking field).
3. **Email sending** — how should the system send email? Recommended: **Resend** (simple, free tier, 5-min setup) *or* your **Xneelo SMTP** details. And the **from-address** (e.g. `ops@fbn-transport.co.za`).
4. **WhatsApp** — do you have (or want) a **Twilio** account? WhatsApp Business needs a Twilio number + Meta template approval (has some lead time), so the plan is **email + trip-link first**, WhatsApp added in Phase E. (You have a Twilio connection available; we'll wire it when ready.)
5. **Contacts** — confirm we have **email + WhatsApp/cell numbers** for your clients and subcontractors (some already on the load record; we may need to fill gaps).
6. **Message wording** — I'll draft the message for each step; you approve/tweak the tone.
7. **Who advances status** — confirm the plan: **driver via the trip link** (recommended), with controllers able to override in-app.

## Open questions
- Do you still want a **copy logged to a Google Drive sheet** as a backup, or is the in-app system the single source of truth?
- One subcontractor/driver per load, or can a load have multiple legs/drivers?
- Which client updates are **automatic** vs **controller-approved before sending**?
