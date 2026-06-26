# PROJECT_BRIEF.md — FBN Fleet Management System

Read this first. One-page orientation; see ARCHITECTURE.md / ROADMAP.md / CHANGELOG.md for detail.

## What it is
The **FBN Control Centre** — a web app that runs FBN Transport's freight operations:
brokered loads (LoadCons), own-fleet collections & line-haul, FCL container monitoring,
LCL groupage unpack tracking, quotes/RFQs, fleet maintenance, fuel, compliance, and
client/subcontractor comms (email + WhatsApp). It is being built continuously and used
live by the team for testing.

## Who
- **Owner / user:** Marc Snyman — non-technical owner. Wants hands-off build/run/fix, plain
  English, minimal approvals; never ask him to use the browser console.
- **Roles:** Super Admin / Admin, Manager, Controller/Ops, Workshop, Driver, Supplier
  (each sidebar area gated by an `access_*` permission; archive/delete = super admin only).

## Stack & hosting
- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind (SPA).
- **Backend:** Supabase `kyosepbdxjwugunylvyo` — Postgres + Auth + Storage + Edge Functions
  + pg_cron. Org `00000000-0000-0000-0000-000000000001`. RLS = `organization_id = auth_org_id()`.
- **Hosting:** Cloudflare Worker `fleet-managment-system` serving `./dist`, auto-built from
  **`main`** by Cloudflare Workers Builds. **Deploy command must be `npx wrangler deploy`.**
  Ship: commit on `migration/supabase` → merge to `main` → push. Verify LIVE by content, not bundle hash.

## Current state (2026-06-26)
- Live and working: Operations/Broking boards, LoadCons + delivered-aware emails, FCL
  containers + flow model, **LCL Status Report** (13.8k shipments, daily sheet import),
  transit-depot broking, quotes/RFQs, fleet/fuel/maintenance, global search, PWA + auto-updater.
- **Added this week (2026-06-23→26):**
  - **COD workflow** (new clients = COD/unauthorised → proforma w/ banking + VAT request →
    cargo held → payment→release email) + **proforma preview/edit** before send (cc debtors+ops).
  - **POD authorisation gate** — no POD reaches a client until an admin authorises (blocked state
    for invoice-contaminated PODs); View POD everywhere + PODs tab.
  - **Collection lifecycle** — Accept; date-aware ops booking email routed to the BRANCH ops floor
    (opsjhb/opsdbn); 07:00 loading-day reminder; ETA check 1h-before + 10min-after arrival.
  - **Multi-transporter split** (one waybill / several subbies; one client charge; per-leg roles/POD).
  - **Own-truck flow** — no subbie field in-network (GP/KZN); manual onward-forwarding toggle out-of-net.
  - **Driver self-update link** (copy-paste into WhatsApp → status + POD); WhatsApp kill-switch toggle.
  - **Live vehicle tracking (Pulsit)** — live map in Fleet AND Operations + per-load position; driver
    names linked to trucks from the tracker. **Geofence auto-status** (arrival → status + ops/client alert).
  - **Cargo verification spine** (`waybill_events`) — log packages/weight/condition + photos at any
    checkpoint; reusable capture modal + timeline on each load.
- In progress / next: cargo-verification Phases 2+ (wire capture into collection/depot-GRN/delivery,
  digital waybill, **manifest trailer-pairing + overload engine**); FCL unpack→floor→split; access
  approval gate; LCL daily client status emails. (See ROADMAP.md.)

## Non-negotiable rules
- **Read `ARCHITECTURE.md` first** (mandatory, see CLAUDE.md) — never create a table/list/API/
  component that already exists. Fleet/vehicles/trailers = `vehicles`; drivers = `drivers`
  (link = `drivers.assigned_vehicle_id`); API keys = `integration_settings`.
- **One email builder** (`lib/loadEmails.ts`); client/subbie address separation (`dropAddrs`)
  must never be removed. Route all mail/WhatsApp through `send-email`/`send-whatsapp` (TEST MODE +
  WhatsApp kill-switch live in `email_settings`).
- **Freeze-proof writes** only (`directInsert/Update/Select` / `invokeFn`).
- **Never delete live data** without explicit owner OK.
- Every editable field must be in its `to*Update` mapper or it won't save.
- **Never redeploy a public edge fn via MCP without `verify_jwt:false`** (load-public, etc. are public links).
- Brand: navy `#13294b` + gold `#f5b700`, Barlow / Barlow Condensed (`lib/brand.ts`).

## Where things live
- Forms/boards: `components/operations/`; contexts: `contexts/`; mappers: `lib/mappers.ts`;
  emails: `lib/loadEmails.ts`; status engine: `lib/loadStatus.ts`.
- Process docs: ARCHITECTURE.md, ROADMAP.md, CHANGELOG.md, FBN_FLEET_CHANGE_LOG.md,
  validation-loop.md, context-reread-rule.md, CLAUDE.md.
- Session memory: `~/.claude/projects/.../memory/` (MEMORY.md index).
