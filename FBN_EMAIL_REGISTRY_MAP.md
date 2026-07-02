# FBN Email Registry — map of every system email (Phase 1.4, for sign-off)

Every email the app sends, with its current recipients. The registry will let a Super-Admin
control the **standing (fixed) recipients**, an **on/off toggle**, and **subject/wording**
per email type — WITHOUT code. Dynamic per-load recipients stay computed; safety invariants stay in code.

## What becomes editable vs stays automatic
- **Editable in the registry:** the fixed department addresses (loadcons@, ops@ general,
  fbndebtors@, quotes@, admin list), an ENABLED on/off per email, and the subject prefix/wording.
- **Stays automatic (per record / per branch):** the client email, subbie email, the load's
  ccEmail/clientCc, contact-preference CCs (getsDocs/getsUpdates/accounts), and branch ops
  inboxes (already from branchConfig, Phase 1.2/1.3).
- **Always enforced in code (never editable — safety):** client↔subbie address separation
  (`dropAddrs`), and the no-email-on-historical-loads rule.

## Transactional — loads / broking (lib/loadEmails.ts)
| Email | To | Fixed CC (registry) | Dynamic CC |
|---|---|---|---|
| LoadCon → subcontractor | subbie | loadcons@ | load ccEmail |
| Grouped LoadCon (multi-truck) → subbie | subbie | loadcons@ | ccEmail |
| Load offer → carrier | carrier | loadcons@ | — |
| Client Order → client | client | loadcons@ | clientCc |
| Client group update (multi-truck) → client | client | loadcons@ | clientCc |

## Transactional — status / phase / handover (OperationsContext)
| Email | To | Fixed CC | Dynamic/branch CC |
|---|---|---|---|
| Supplier phase update | subbie | ops@ | updateCc + branch ops |
| Client phase update | client | ops@ | clientCc + branch ops + rep |
| Client POD email | client | ops@ | clientCc + branch ops |
| Supplier POD copy | subbie | ops@ | ccEmail + branch ops |
| Amended LoadCon | subbie | loadcons@ | ccEmail |
| New-collection ack (ops) | branch ops | ops@ | — |
| Revised ETA → client | client | ops@ | clientCc + branch ops |
| Line-haul loaded / Handover / Transit | dest branch ops | ops@ | other branch ops |
| Complete cargo details | depot ops | ops@ | — |
| Rate needed | admins | ops@ | — |

## POD
| Email | To | Fixed CC | Dynamic CC |
|---|---|---|---|
| POD request/chase (podRequest) | subbie | loadcons@ | ccEmail + carrier accounts (pod_request_cc) |
| POD uploaded — review & authorise (submit-pod) | loadcons@ | — | — |
| POD received ack (submit-pod) | subbie | loadcons@ | ccEmail |
| Daily POD chase (ops-daily-checks) | subbie | loadcons@ | carrier accounts |

## Quotes / finance
| Email | To | Fixed CC | From / ReplyTo |
|---|---|---|---|
| Proforma invoice (quote-proforma) | client | fbndebtors@, ops@ | from quotes@, reply debtors |
| Quote sent / more-info | client | — | quotes@ |
| Carrier invoice received | fbndebtors@ | ops@ | — |
| Carrier invoice status | carrier | — | — |
| Load-board post approval | ops@ | — | — |

## Scheduled / digests (edge crons)
| Email | To | Fixed CC |
|---|---|---|
| Daily ops digest | admins | loadcons@ |
| Collections-loading-today | branch ops | loadcons@, ops@ |
| Cert-expiry reminders | carrier | — |

## Registration / public (edge)
| Email | To |
|---|---|
| Client register (confirm + admin notify) | client + admins |
| Supplier register (confirm + onboarding) | applicant + admins |
| Client quote-request alert | ops |
| Breakdown-tyre | workshop |
| Submit-inspection | workshop / ops |
| Driver-hub incident | ops |

## Proposed build (after sign-off)
1. `email_registry` table: `key` (email type), `label`, `enabled`, `cc` (fixed standing CC list),
   `subject_prefix`, `notes`. Seed from the values above (behaviour identical).
2. Settings screen (Super-Admin): list every email type; edit standing CC, toggle on/off, subject.
3. Repoint senders to read the registry for their FIXED CC + enabled flag (fallback = current
   constant), one at a time, verify by content. Dynamic recipients + dropAddrs untouched.

Status: map drafted 2026-07-02, awaiting Marc's sign-off on the list + which levers first.
