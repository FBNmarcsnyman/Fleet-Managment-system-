# FBN Portal Build — Session Log

Tracks the multi-session portal build. **Do not modify earlier sessions' work when building a later one.**

## Session 1 — Subcontractor self-registration ✅ LIVE
- Public 5-step **`/supplier-register`** (company / fleet / routes / certifications / SLA agreement) → edge fn
  `supplier-register` (uploads docs to private `supplier-applications` bucket, captures IP+timestamp, generates
  the signed-agreement PDF, inserts a Pending `supplier_applications` row, emails applicant + admins).
- SLA single-sourced in `lib/subcontractorSla.ts` — **GIT min R1 500 000,00** + **ECT Act 25 of 2002** clause.
- Vetting screen `SupplierApplicationDetailModal` (full detail + signed-URL doc viewing via role-gated
  `supplier-doc-url`). Approve → `suppliers` row + auth login (`admin-create-user`, role Supplier) + welcome email.

## Session 2 — Invitation broadcast ✅ LIVE
- `CarrierInviteCampaign` (Management → Subcontractors → Invite Carriers): paste/upload transporter emails →
  branded invite with a personalised `?invite=<token>` link → funnel On List → Invited → Applied → Vetted.
- Carrier routing steering (`lib/carrierEligibility.ts`): subbie pickers lead with vetted carriers.
- Invite email carries "already registered? log in" + `missioncontrol@fbn-transport.co.za`.

## Session 3 — Subcontractor logged-in portal ✅ LIVE (5 phases)
Carrier portal (`components/SupplierPortal.tsx`, light brand theme; super admin views via Users → Portal Logins).
- **P1 Dashboard** (`SupplierDashboard`): open RFQs w/ countdowns, active loads, outstanding PODs + inline upload, compliance R/A/G, posted-loads/invoices tiles.
- **P2 RFQ board + My Loads**: RFQ countdown + decline-with-reason + vehicle dropdown; My Loads status advance (canonical `nextStep`) + exception flagging (waybill_events). RLS `waybill_events` scoped by role.
- **P3 Invoicing**: `subcontractor_invoices` table + RLS; carrier creates from POD'd loads, statuses Submitted→Approved/Queried→Paid; FBN accounts review (`CarrierInvoicesReview`); statement print.
- **P4 Load Board**: `load_board_posts` table + RLS; carrier posts → admin authorises (`LoadBoardReview`) → visible to approved carriers; fill/withdraw.
- **P5 Documents reminders + Profile**: `cert-expiry-reminders` edge fn + daily cron (30-day + on-expiry email; GIT expiry flags carrier); profile editing via role-checked `supplier-self-update`; change password; view agreement.

**Cross-cutting (Session 3):** every date input converted to the DD/MM/YYYY `DateField` program-wide, enforced by a post-edit guard hook. Carrier portal restyled to the light brand theme.

## Session 4 — Client portal ✅ LIVE
Light-themed client portal (`components/ClientPortal.tsx`, navy sidebar + gold active; super admin views via
Users → Portal Logins / ClientPortalAccessView; `auth_client_id()` RLS = clients see only their own records).
- **Public `/client-register`** (no login, `components/client/ClientRegister.tsx`) → edge fn `client-register`
  (inserts a PENDING client: registration_status='pending', cod + unvetted) → emails applicant + admins.
  `clients` extended (registration_number, industry, billing_address, preferred_routes, cargo_types,
  typical_load_sizes, marketing_email/whatsapp_optin, registration_status).
- **Approve from Clients tab** (`ClientManagementView`: Pending filter + PENDING badge + "Approve & create
  login") → `handleApproveClientRegistration` marks approved, creates the Client login (admin-create-user),
  emails a branded welcome with credentials.
- **Dashboard** (`ClientDashboard`): active loads / open quotes / outstanding invoices / total loads + panels.
- **Request a Quote** (`ClientQuoteRequestForm`, address autocomplete + DateField + HAZMAT UN/class) → edge fn
  `client-quote-request` (verify_jwt; resolves client from JWT; drops a 'Requested' quote into the staff Quotes
  pipeline + notifies ops). **My Quotes** (`ClientQuotesView`): status list + accept/decline on Sent.
- **My Loads** (`ClientJobCard`): status timeline, vehicle+driver+contact, controller ETA, ops exceptions,
  POD download.
- **Financial Documents** (`ClientFinancials`, lighter scope chosen): invoices from each load's invoice
  number/date + payment status, outstanding highlighted, printable statement, remittance upload (emailed to
  fbndebtors@). ⬜ Deferred: full client-invoice/statement/credit-note backend (build when FBN raises client
  invoices in-app).

**Existing client foundation (reuse, do NOT rebuild):** `ClientLogin` (`?portal=client`), `ClientPortal` shell,
`ClientDashboardView` + `ClientJobCard` (My Shipments + POD modal), `ClientBookingForm` (basic quote request),
`ClientQuoteView` (deep-link accept/reject), `viewingClientAsAdmin` impersonation, `auth_client_id()` RLS on
clients/quotes/load_confirmations. `clients` table already has contacts, branches, category, account_status,
vetted, vat_no, invoice_details.
