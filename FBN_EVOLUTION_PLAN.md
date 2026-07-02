# FBN — "Make the App Evolve" Plan (data-driven + oversight)

**Goal:** stop hardcoding business rules in many places. Give the app ONE brain per rule,
stored as **data/config** it reads at runtime, editable by Marc in a Settings/Control
Centre — so changing a rule once applies everywhere instantly, even without a developer.
Back it with **agents + hooks** so it never silently rots.

**Why this (not "more skills"):** the audit (2026-07-02) showed the same rules hardcoded &
duplicated across many files (branch→email in 3 places, area classifier in 3, VAT 15% in
3+, pick-lists in 3 forms, email addresses in 8+). That's why refinements "don't stick" —
there's no single place to learn into. Claude memory/skills/hooks keep the *build*
consistent; they can't make the *app* adapt. Only architecture (config-driven + single
source of truth) does that.

## Principles
1. **Single source of truth** — one module/table per rule; everything else reads it.
2. **Data-driven config** — rules the business changes live in DB tables, edited in a
   super-admin Settings screen, read at runtime (cached, freeze-proof `direct*`).
3. **Learn-as-you-go** where sensible (`managedLists`/`pick_options` already exists).
4. **Guardrails** — hooks + a recurring audit agent stop new hardcoding/duplication.

---

## Phase 0 — Foundations (small, low-risk)
- Regenerate committed schema/`database.types.ts` from the LIVE DB (fix the ~21-table drift).
- Add a typed **config accessor** in `lib/` (cached read of the config tables, freeze-proof).
- Prune obvious dead code: legacy duplicate root-level components (VehicleList/Card/Detail,
  FleetPortal, Header, Login, etc.) and the empty `Financials.tsx` stub. (Verify imports first.)

## Phase 1 — Branches + Email Registry (the TEMPLATE) ⭐ start here
The highest-pain area (wrong recipients, the mass re-fire). Prove the pattern here, then reuse.
- **Config tables:** `branches` (code, label, **ops_email**, depot_address, active) and
  **`email_registry`** (email_type, to, cc, subject_template, body/wording, enabled on/off).
- **One Settings screen** (Super-Admin) to edit both — add/remove recipients, toggle emails,
  edit wording.
- **Repoint** every place at it: `opsEmail()` (OperationsContext), the 3 area→branch
  classifiers → ONE shared helper reading `branches`; email literals (`loadcons@`, `fbndebtors@`…)
  → registry. Delete the duplicates.
- **Hook:** flag any new hardcoded ops-email/branch literal in a component.
- **Result:** Marc edits branches/emails/recipients himself; every sender updates instantly.

## Phase 2 — Pick-lists + learn-as-you-go
- Move base lists (commodities, packaging, vehicle types, container sizes, load specs) into
  `pick_options` config (table exists).
- Wire `managedLists`/`usePickOptions` into `QuickCollectionForm`, `BrokingCollectionForm`,
  quote forms → forms **learn** new values from use and are editable in `ManageListsView`.
- One source for vehicle/container lists (kill the 3 duplicate arrays).

## Phase 3 — Remaining rules to config + de-dup
- VAT rate, SLA terms/company/banking, POD-chase cadence, status **labels/colours** → config.
  (Status *flow* stays in code; labels/colours/cadence become data.)
- De-duplicate: every `money()`/date formatter imports `lib/format.ts` (remove ~20 local copies).
- Fix `docSettings.ts` to use the freeze-proof `direct*` path (currently raw `supabase.from`).

## Phase 4 — Oversight agents (the "keep it smart" loop)
- **Recurring consistency-audit agent** (scheduled + on-demand): flags NEW hardcoding,
  duplicate formatters/classifiers, schema drift, dark-theme regressions → short report.
- **Pre-ship review agent:** before deploy, checks the change against saved memory rules +
  the single-source-of-truth principle; blocks/《flags》violations.
- Wire via cron + a `forge`d skill; document in the Active Skills Registry.

## Cross-cutting — dev-loop (Layer 1) hardening
- Keep capturing rules to memory (working). Add to CLAUDE.md Standards: "no hardcoded
  business rule / no duplicate formatter — route through config or lib." Enforce via hook.

---

## Sequencing & effort (rough)
| Phase | Effort | Risk | Payoff |
|---|---|---|---|
| 0 Foundations | S | Low | Removes drift + dead code, sets the pattern |
| 1 Branches + Email registry | M | Med | Biggest pain gone; Marc self-serves; template proven |
| 2 Pick-lists + learn | M | Low | Forms adapt; no code for new commodities/routes |
| 3 Rest to config + de-dup | M | Low-Med | VAT/SLA/cadence editable; fragility gone |
| 4 Oversight agents | S-M | Low | App stops rotting; changes reviewed pre-ship |

**Recommended order:** 0 → 1 (template) → 4 (guardrails on) → 2 → 3.

## How "the app evolves" after this
- Change a branch email, add a commodity, toggle an email, adjust the VAT rate or POD
  cadence → **edit data in a screen, applies everywhere instantly**, no developer.
- Agents continuously check nothing slips back to hardcoded/duplicated.
- New rules we agree → captured to memory (build consistency) AND expressed as config
  (runtime behaviour) — both layers move together.

## Status
Plan drafted 2026-07-02, awaiting Marc's approval. No code written yet.
Related memory: [[email-registry-management]], [[capture-flows-automatically]], and the audit findings.
