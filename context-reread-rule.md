# Context Reread Rule (30 minutes)

A guard against drift on long sessions. This codebase is large and the owner fires many
small requests in a row — it is easy to forget a rule or rebuild something that already
exists.

## The rule
**Every ~30 minutes of active work — or whenever any of the triggers below fire — pause and
re-read the core context before continuing:**

1. **CLAUDE.md** — standing rules (deploy, email source-of-truth, form standards).
2. **PROJECT_BRIEF.md** — what the system is + non-negotiables.
3. The relevant **memory** files (MEMORY.md index → the entries touching what you're editing).
4. The latest **FBN_FLEET_CHANGE_LOG.md** entry — what already shipped today.

## Always reread before:
- Touching emails (`lib/loadEmails.ts`) or documents — re-run the **validation-loop.md** checks.
- Adding a feature that might already exist — search first (avoid duplicate boards/forms/email HTML).
- A deploy — confirm the deploy command is `wrangler deploy` and verify LIVE by content.
- Any schema change — confirm RLS (`organization_id = auth_org_id()`) and add columns to the mappers.
- Deleting/overwriting anything — never delete live data without explicit owner OK.

## Why
Most regressions this project has seen came from drift: re-inlining email HTML that bypassed
the shared builder, filtering a board on `supplier_id` alone, or forgetting a field in a
mapper. A 60-second reread prevents an hour of rework.
