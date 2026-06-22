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

## Current state (2026-06-22)
- Live and working: Operations/Broking boards, LoadCons + delivered-aware emails, FCL
  containers + flow model, **LCL Status Report** (13.8k shipments, daily sheet import),
  transit-depot broking, quotes, fleet/fuel/maintenance, global search, PWA + auto-updater.
- In progress / next: LCL per-depot collection grouping + daily client status emails;
  FCL unpack→floor→split; access approval gate. (See ROADMAP.md "New / next".)

## Non-negotiable rules
- **One email builder** (`lib/loadEmails.ts`); client/subbie address separation (`dropAddrs`)
  must never be removed.
- **Freeze-proof writes** only (`directInsert/Update/Select` / `invokeFn`).
- **Never delete live data** without explicit owner OK.
- Every editable field must be in its `to*Update` mapper or it won't save.
- Brand: navy `#13294b` + gold `#f5b700`, Barlow / Barlow Condensed (`lib/brand.ts`).

## Where things live
- Forms/boards: `components/operations/`; contexts: `contexts/`; mappers: `lib/mappers.ts`;
  emails: `lib/loadEmails.ts`; status engine: `lib/loadStatus.ts`.
- Process docs: ARCHITECTURE.md, ROADMAP.md, CHANGELOG.md, FBN_FLEET_CHANGE_LOG.md,
  validation-loop.md, context-reread-rule.md, CLAUDE.md.
- Session memory: `~/.claude/projects/.../memory/` (MEMORY.md index).
