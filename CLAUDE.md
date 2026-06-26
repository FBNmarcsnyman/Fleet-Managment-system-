# CLAUDE.md — FBN Fleet Management System

Project instructions for Claude Code. Read this at the start of every session.

## MANDATORY SESSION START (do this before writing a single line of code)

1. **Read `ARCHITECTURE.md` in full.**
2. **Read `PROJECT_BRIEF.md` in full.**
3. **Confirm by saying:** `Architecture loaded - I can see [list what you found]`.
4. **Never create anything new without first checking if it already exists in
   `ARCHITECTURE.md`** (tables, lists, APIs, components).

## MANDATORY BEFORE ANY NEW FEATURE

1. Check `ARCHITECTURE.md` for existing related tables, lists, APIs, components.
2. **Connect to existing systems — never duplicate.** (e.g. fleet/vehicles = `vehicles`,
   drivers = `drivers`, API keys = `integration_settings`, email/WhatsApp = the
   `send-email`/`send-whatsapp` edge fns.)
3. Update `ARCHITECTURE.md` after building to reflect the change.

## MANDATORY AFTER ANY UPDATE

1. Update `ARCHITECTURE.md`.
2. Update `PROJECT_BRIEF.md`.
3. Update `ROADMAP.md`.
4. Run end-of-session consolidation (see below).

## Capture flows & logic automatically (MANDATORY — do not wait to be asked)

**The moment Marc defines a flow, rule, standard, or "way of doing/managing something"
— or we solve a non-obvious problem — persist it immediately, in the same turn, before
moving on.** Do not rely on end-of-session consolidation or on being reminded; capture it
when it's created. Pick the right home (often more than one):
- **`memory/` note** — for facts, decisions, rules, the "why" (most flows go here). Add the
  one-line pointer to `MEMORY.md`.
- **`.claude/skills/<name>/SKILL.md`** — for a repeatable workflow/way-of-doing; register it
  in the Active Skills Registry below (use the `forge-skill` process).
- **Hook** (`.claude/hooks/…` + settings) — for something that must be *enforced* on every edit.
- **Cron + edge function** — for anything that must run on a schedule (reminders, syncs).
Then **tell Marc exactly where it was saved** ("saved to memory `x` / skill `y` / cron `z`").
**Trigger phrases Marc can use to force this on demand:** "**lock it in**", "save this",
"make it a skill", "forge skill", "remember this flow". Treat any of them as: capture now +
confirm where. The goal: nothing we agree on is ever lost between sessions.

## End-of-session consolidation (MANDATORY, automatic)

**At the end of every coding session, automatically run the full end-of-session
consolidation process without being asked.** This includes:

- **Documentation** — comment new code; update PROJECT_BRIEF / TECHNICAL_SPECIFICATION,
  ROADMAP.md, FBN_FLEET_CHANGE_LOG.md, and add a CHANGELOG.md entry for today.
- **Logic & flow** — confirm new logic connects to existing logic; remove or wire up
  orphaned/dead code; ensure similar processes share one implementation (no duplication);
  verify loops and hooks are implemented and connected.
- **Architecture** — update ARCHITECTURE.md; confirm new components are registered
  (App.tsx modal registry / OperationsPortal tabs); document new Supabase tables/columns;
  keep `.env.example` current.
- **Code quality** — remove debug `console.log`s; remove dead code; keep error handling
  consistent (`console.error` in catch + a user-facing toast); capture `TODO`s into
  ROADMAP.md then remove them from code.
- **Connections** — verify Supabase writes (freeze-proof `directInsert/Update/Select` /
  `invokeFn`), RBAC role gating, and Row Level Security (`organization_id = auth_org_id()`).
- **Type safety** — update TypeScript types; fix any type errors.
- **Final check** — run `npx tsc --noEmit` then `npx vite build`; list everything changed;
  flag anything unresolved for next session.

**Always end by asking the user: "Session consolidated. Ready to close?"**

## Context reread (every 30 min) — see `context-reread-rule.md`

On long sessions, every ~30 minutes (or before touching emails, a deploy, a schema change,
or building something that may already exist) re-read CLAUDE.md, PROJECT_BRIEF.md, the
relevant memory, and the latest change-log entry. Prevents drift/duplication.

## Email & form changes — see `validation-loop.md`

Run the email/form validation loop after any change to an email, document, or load form.

## Load data audit — `.claude/agents/load-audit.md`

Use the `load-audit` subagent to scan `load_confirmations` / `lcl_shipments` for integrity
issues (hidden brokered loads, missing delivery date, stalled transit, storage-charge risk).

## Deploy (CRITICAL — see memory `deploy-promote-to-main`)

- Live site = Cloudflare Worker `fleet-managment-system` serving `./dist` (SPA), built by
  **Cloudflare Workers Builds** from the **`main`** branch. Deploy command MUST be
  `npx wrangler deploy` (NOT `versions upload`, which uploads without going live).
- Ship: commit on `migration/supabase` → `git checkout main && git merge migration/supabase --ff-only && git push origin main` → also push `migration/supabase`. Build first: `npx tsc --noEmit` then `npx vite build`.
- Verify a deploy by **content** (grep a known new string in the live bundle), not by the
  bundle hash — Linux (CI) and Windows (local) hash the same code differently.

## Standards

- **Forms**: DateField (DD/MM/YYYY), `type=time`, AddressAutocompleteInput (captures the
  company name), editable commodity/packaging datalists, hazardous toggle. Edit-in-place
  must mirror the create form (same pick-lists). Every editable field must be in the
  relevant `to*Update` mapper or it silently won't save.
- **Emails**: one source of truth in `lib/loadEmails.ts` (`sendLoadConToSupplier` /
  `sendOrderToClient`); never inline duplicate email HTML in a component. Client/subbie
  separation is enforced by `dropAddrs` — do not remove.
- **Brand / look & feel (unify standard)**: navy `#13294b` + gold `#f5b700` + slate
  neutrals on white cards; Barlow / Barlow Condensed (`lib/brand.ts` is the source of
  truth). Buttons have **3 roles only** — navy = primary, emerald = positive/confirm,
  slate/ghost = neutral. No rainbow one-offs (purple/teal/amber blocks). New screens are
  light-themed; convert legacy dark (`gray-800/900`, `text-white`) screens as touched.
- **Emails (unify standard)**: one branded shell + tone; route through `lib/loadEmails.ts`
  / `lib/emailTemplate.ts`; detail-table layout (date, cargo, remarks); subjects are
  **plain ASCII** (the `send-email` fn strips em-dashes/smart-quotes — non-ASCII subjects
  corrupt the message in denomailer). Client/subbie separation via `dropAddrs` — never remove.
- **Documents**: LoadCon / Manifest / Trip Sheet / Quote / Invoice / POD share one header
  lockup + table style (`lib/loadconPdf.ts`, `lib/linehaulDocs.ts`, the *Doc modals).
- **Access**: `access_loadcons` = floor team (LoadCons + Operations boards, branch-pinned);
  not `access_operations` (full). Access loads at sign-in — changed users must re-login.
- Non-technical owner: plain English, hands-off, never ask him to use the browser console.

## System state & skills (baseline)

**Project:** FBN Control Centre — Transport ops + brokerage + fleet web app (React/TS/Vite
+ Supabase, Cloudflare Worker). Live and in daily use; now in a *unify & streamline* phase.

### Active Skills Registry
(invoke when a skill's `description` trigger matches — BLOCKING: invoke before answering)

**Domain skills**
- `fbn-fleet` — any app feature/fix/schema/deploy work (conventions + deploy rule).
- `new-form` / `new-email` — adding a form / a load email the house way.
- `crm-enrich` — Gmail → client/carrier CRM (scrape contacts, dedupe, normalise).
- `provision-access` — create logins + set role/branch access (incl. the auth-seed gotcha).
- `lcl-import` — maintain the LCL status-sheet importer + cron.

**Process skills**
- `system-init` — "System Init" / daily resync → 🎯 goal · ⚡ skills · 🛑 blockers report.
- `qa-check` — "Run QA Check" / after non-trivial code → rule+edge-case+side-effect+build gate,
  output a truthful `[x] Logic | [x] Edge-cases | [x] Side-effects | [x] tsc+build` checklist.
- `forge-skill` — "Forge Skill" / after a breakthrough → distil into a new SKILL.md + register here.

**Agents:** `deploy-verify` (is it live?), `load-audit` (data integrity).

**Autonomous loop (every skill follows this):**
1. **Trigger (hook):** the skill's `description` trigger phrases; a shared Google Sheet
   link → `lcl-import`/`crm-enrich`; "deploy / is it live" → `deploy-verify`.
2. **Evaluation loop:** run the skill's own *Evaluation loop* before presenting — for code:
   `npx tsc --noEmit` + `npx vite build` must pass; for data: re-query and confirm the write;
   for emails/docs: the `validation-loop.md` checklist; verify deploys by **content**.
3. **Stop condition:** the skill's *Stop condition* is met (green build + verified live/queried
   + nothing half-wired), then run **end-of-session consolidation** and ask "Ready to close?".
True auto-firing (no prompt) requires `settings.json` hooks — offer to wire via `update-config`.
