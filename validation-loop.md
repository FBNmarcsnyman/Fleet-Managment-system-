# Email & Form Validation Loop

A repeatable checklist to run **after any change to an email, a document, or a
form** in the FBN Fleet system. Most of our recurring bugs (2026-06) were email
wording / save / threading issues — this loop catches them before they ship.

## When to run
- Any edit to `lib/loadEmails.ts`, `lib/loadconPdf.ts`, `lib/emailTemplate.ts`,
  the `send-email` / `load-public` edge functions, or any form that creates/edits a load.

## Email loop
1. **One builder only.** Confirm the change is in the shared `lib/loadEmails.ts`
   builders (`sendLoadConToSupplier` / `sendOrderToClient`). No component re-inlines
   email HTML. (This was the "accept this load after delivery" root cause.)
2. **State-aware wording.** Re-send the email for a load in EACH state and read the body:
   - On route → "confirm acceptance / send driver details" (subbie); "booked" (client).
   - Already delivered (status OR past delivery date) → "already delivered, upload POD"
     (subbie); "delivered, awaiting POD" (client). No accept link.
3. **Client/subbie separation.** A client must NEVER receive the LoadCon/rate; a subbie
   never the client identity/rate. `dropAddrs` must still strip the other side.
4. **Subject + threading.** Order, status updates (app AND `load-public` edge), and POD
   all use the identical `clientSubject(lc)` so they thread. Routing codes match.
5. **TEST MODE.** With TEST MODE on, every email/WhatsApp redirects to the controller —
   confirm a real send doesn't leak to clients during testing.
6. **Recipients.** Right To/CC: docs→`cc_email`, updates→`cc_updates`, upload-POD→
   `pod_upload_email`, ops always copied. Multi-CC is split (no comma-joined single address).

## Form loop
1. **Standard inputs**: DateField (DD/MM/YYYY), `type=time`, AddressAutocompleteInput
   (company name pulls through), commodity/packaging datalists, hazardous toggle.
2. **Edit mirrors create**: editing a record offers the same pick-lists (not plain text).
3. **Every field saves**: each editable field is mapped in the relevant `to*Update` mapper.
   Save, hard-refresh, confirm it persisted (query the row if unsure).
4. **Required**: required-field validation with a clear toast; delivery date enforced.
5. **Freeze-proof writes**: `directInsert/Update/Select` or `invokeFn` — never bare
   `supabase.from()` for user actions.

## Close the loop
- `npx tsc --noEmit` + `npx vite build` pass.
- Verify the deploy reached LIVE by content (grep the live bundle), not bundle hash.
