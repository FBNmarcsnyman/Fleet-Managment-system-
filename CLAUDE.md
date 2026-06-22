# CLAUDE.md — FBN Fleet Management System

Project instructions for Claude Code. Read this at the start of every session.

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
- **Brand**: navy `#13294b` + gold `#f5b700`; Barlow / Barlow Condensed. `lib/brand.ts` is
  the source of truth.
- Non-technical owner: plain English, hands-off, never ask him to use the browser console.
