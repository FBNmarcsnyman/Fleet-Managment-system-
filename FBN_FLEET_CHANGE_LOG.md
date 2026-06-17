# FBN Fleet Management System — Change Log
> Maintained by Marc Snyman | Last updated: 2026-06-17
> Use this file at the start of every Claude Code session — paste it in with the instruction: "Read this change log and action the next PENDING item."

---

## How to use this log

| Field | Description |
|---|---|
| **ID** | Unique reference — use in Claude Code to track the task |
| **Type** | Bug / Change / Feature |
| **Priority** | P1 = fix now / P2 = next session / P3 = backlog |
| **Status** | PENDING / IN PROGRESS / DONE |
| **Files likely affected** | Best guess at which files Claude Code will need to touch |

---

## Change Items

---

### CHG-001
- **Type:** Bug
- **Priority:** P1
- **Status:** PENDING
- **Title:** User role assignment hangs on save
- **Description:** On the Users screen, when changing a user's role (e.g. Driver → Admin or any role update), clicking save causes the UI to hang indefinitely. It is unclear whether the save completes in Supabase or fails silently.
- **Expected behaviour:** Role change saves successfully, UI confirms with a success state and returns to normal.
- **To investigate:** Check for missing await/async on the Supabase update call; check if RLS policy is blocking the write for certain role combinations; confirm whether the record actually updates in the DB despite the hang.
- **Files likely affected:** Users management component, Supabase role update function/hook
- **Notes:** Confirm with Marc whether any specific role combinations are worse than others.

---

### CHG-002
- **Type:** Change
- **Priority:** P2
- **Status:** PENDING
- **Title:** ETA at loading point — replace free-text with date + time picker
- **Description:** On the Load Acceptance screen (triggered from transporter email), the "ETA at loading point" field currently accepts free text (e.g. 18/06/2026 08:00). This must be replaced with a proper date picker and time input.
- **Expected behaviour:** User sees a date selector calendar + time input (or combined datetime picker). Selected value formats consistently before saving.
- **Screen:** Load Acceptance modal — field: "ETA at loading point"
- **Files likely affected:** Load acceptance form component, LoadCon email template trigger
- **Notes:** Confirm with Marc — separate date + time fields, or single combined datetime picker? Time free-type or increments?

---

### CHG-003
- **Type:** Feature
- **Priority:** P2
- **Status:** PENDING
- **Title:** Status update communications engine — email/WhatsApp chain to transporter + client
- **Description:** When load statuses are updated (driver assigned, departed, en route, arrived, delivered, POD received), the system must automatically send communications as follows:

  **To transporter (subcontractor):**
  - Email + WhatsApp notification at each status milestone
  - Requests confirmation/update for the NEXT phase
  - Continues requesting until transporter responds or POD is received and file is closed
  - Non-response is flagged against the transporter's KPI scorecard

  **To client:**
  - Email update at each key milestone
  - Actual POD document (or notification of receipt) sent on file close

  **FBN employee override:**
  - If transporter does not update, FBN employee can action the status update manually
  - System still sends client update and still requests next phase update from transporter
  - Chain continues until POD received + file closed

- **Status milestones to define (confirm with Marc):**
  - Load assigned
  - Departed loading point
  - En route
  - Arrived at delivery point
  - Delivered
  - POD uploaded / file closed

- **Files likely affected:** Load status update component, notification service, KPI scorecard module (see CHG-003b below), email/WhatsApp integration layer
- **Notes:** This is a large feature — recommend breaking into sub-tasks in Claude Code. KPI scorecard impact to be scoped separately as CHG-003b. Confirm: does this apply to FBN own drivers too, or subcontractors only?

---

### CHG-003b
- **Type:** Feature
- **Priority:** P3
- **Status:** PENDING
- **Title:** Transporter KPI scorecard — update response tracking
- **Description:** Transporter non-response to status update requests (from CHG-003) must be recorded and reflected in a KPI scorecard per transporter. Scorecard tracks responsiveness across loads over time.
- **Expected behaviour:** Each missed update request increments a negative KPI signal against that transporter. Scorecard visible in transporter profile or reporting screen.
- **Files likely affected:** Transporter profile, KPI/reporting module
- **Notes:** Confirm with Marc — is the KPI scorecard already partially built, or greenfield? What other KPI metrics feed into it?

---

### CHG-004
- **Type:** Feature
- **Priority:** P2
- **Status:** PENDING
- **Title:** Get POD — request, upload, store, notify client
- **Description:** A "Get POD" button on the load record triggers the following flow:

  1. **Request sent** to subcontractor/driver via email + WhatsApp with a unique upload link
  2. **Transporter/driver uploads** POD document (photo or PDF) via the link
  3. **POD stored** against the load record in Supabase
  4. **Client notified** by email — either POD attached or notification of receipt (confirm with Marc)
  5. **Load file closed**

- **Files likely affected:** Load detail component, POD upload endpoint (public token-based, similar to load acceptance), Supabase storage, client notification service, email template
- **Notes:** Confirm with Marc:
  - Email + WhatsApp both, or per-transporter preference?
  - Upload via link or attachment reply?
  - POD also pushed to Google Drive folder?
  - Client gets the actual document or just a notification?
  - Accepted file types: JPG (phone photo), PDF, or both?

---

## Completed Items

*None yet.*

---

## Session Notes

| Date | Session Summary |
|---|---|
| 2026-06-17 | Initial change log created. 4 items logged (CHG-001 to CHG-004). Several items have open clarification questions — resolve before implementing. |

