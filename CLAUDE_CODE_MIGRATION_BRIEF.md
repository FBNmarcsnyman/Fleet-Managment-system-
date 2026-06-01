\# FBN Fleet Management — Supabase Migration Brief



For: Claude Code

Repo: Fleet-Managment-system-

Stack: React 18 + TypeScript + Vite + Tailwind CSS

Target: Migrate from browser localStorage persistence to Supabase (PostgreSQL + Auth + Storage)

Status: Database is built, tested, and live. Bootstrap admin user exists. React app still uses localStorage.



\---



\## 0. Read this entire document before writing any code



This brief is the source of truth for the migration. Don't improvise — every rule here was decided with the user (Marc Snyman, Executive Lead at FBN Transport). When in doubt, ask Marc rather than guessing.



Your job for this migration is bounded: swap the persistence layer, wire up real auth, and move file uploads to Supabase Storage. Do NOT add features, redesign UI, or refactor unrelated components. Phase 1 ships when the existing UI works on Supabase instead of localStorage.



\---



\## 1. Context: what this app is



FBN Transport is a South African specialized logistics company (Durban + Johannesburg + Cape Town branches, plus a LOADMASTER linehaul fleet). The app is a Fleet Management System covering vehicles, drivers, fuel, services, checklists, job cards, parts, suppliers, quotes, load confirmations, manifests, trip sheets, incidents, HR cases, and finance.



The current React app was built in Google AI Studio and migrated to GitHub. It's well-architected (domain-driven context providers: Fleet, Operations, Workshop, Management, Common, Auth, UI all wrapping a central RawDataContext) but persists data to browser localStorage. That makes it single-user, single-device, no real auth, no backup. Migration unlocks: multi-user, multi-device, real auth, branch-scoped role permissions, file storage in the cloud, proper backups.



Important domain terminology: DI (Delivery Instruction), waybill, POD (Proof of Delivery), LOADCON (Load Confirmation), COB (Close of Business), SQAS (compliance standard), DG (Dangerous Goods / HAZMAT), PrDP (Professional Driving Permit).



\---



\## 2. What's already done (do NOT recreate any of this)



The Supabase backend is complete and live. Do not run the SQL files. Do not modify the schema. The database has:



\- 40 tables covering every entity the app uses

\- 12 helper functions for auth/role/branch checks

\- 74 Row Level Security policies enforcing role + branch scoping

\- 7 Storage buckets with 26 access policies

\- Seeded data: 1 organization (FBN Transport), 4 branches (FBN DBN, FBN JHB, FBN CPT, LOADMASTER)

\- 1 bootstrap user: Marc Snyman (Super Admin) — his auth.users record and his profiles record both exist



The three SQL files that built this (01\_schema.sql, 02\_rls\_policies.sql, 03\_storage\_setup.sql) are in the project root for reference. Read them to understand the data model — but never run them again.



\---



\## 3. The architecture decisions (don't second-guess these)



These were debated and decided. Build accordingly.



\- Persistence: Supabase Postgres (replaces localStorage)

\- Auth: Supabase Auth (email + password to start)

\- File storage: Supabase Storage (replaces base64-in-localStorage)

\- Multi-tenancy: Schema is tenant-ready (organization\_id column on every table). For now there is exactly ONE org: FBN Transport, id 00000000-0000-0000-0000-000000000001.

\- Roles: Super Admin, Admin, Staff (=Operations), Workshop Manager, Driver, Client, Supplier

\- Branch scoping: Staff/Workshop see only their assigned\_branch\_ids + LOADMASTER (every branch sees LM because it runs interbranch transfers). Empty array = sees nothing. Admins see all.

\- Permission flags: Stored as permissions TEXT\[] on profiles. First flag in use: 'manage\_fuel' (lets Staff users manage fuel/bowsers without being Admin).

\- AI integration: Existing app uses Gemini API. Swap to Anthropic Claude API as part of Phase 1 (uses claude-sonnet-4-20250514).

\- Public quote form / supplier application form: Deferred to Phase 2 (needs anonymous-role policies). Not in this migration.



\---



\## 4. The data model



Existing TypeScript interfaces in types.ts map almost 1:1 to database tables (snake\_case in DB, camelCase in TS). The Vite project should use a generated TypeScript types file from Supabase — generate it with the Supabase CLI using this command (replace <project\_id> with the actual project ID):



npx supabase gen types typescript --project-id <project\_id> > src/lib/database.types.ts



Five fields were added during migration (be aware of these in components):



1\. Vehicles gained: pallet\_spaces, payload\_kg, cubic\_meters, deck\_meters (capacity), cost\_per\_km\_target, monthly\_fixed\_cost (economics).

2\. vehicle\_compliance\_docs is a NEW table — COF, license disc, tracker certificate, insurance, permits per vehicle.

3\. Profiles (drivers) gained: dg\_cert\_expiry, medical\_expiry, induction\_date, last\_refresher\_date (in addition to existing license\_expiry, pdp\_expiry).

4\. routes is a NEW table — pre-defined lanes (Durban-Johannesburg, etc.) with target sell rates per pallet/cbm/kg/deck-m and min/target/premium full-load rates. Quotes and load\_confirmations reference route\_id.

5\. Parts gained: branch\_id (parts inventory is branch-scoped now).



Key relationships:

\- profiles.id = auth.users.id (one-to-one with Supabase Auth)

\- profiles.organization\_id -> organizations.id (always FBN's UUID for now)

\- vehicles.branch\_id -> branches.id

\- load\_confirmations has BOTH collection\_branch\_id and destination\_branch\_id (a load touches two branches)

\- manifests has origin\_branch\_id and destination\_branch\_id

\- POD / signature / cargo photos: store the file in pod-photos Storage bucket, save just the path/URL in the load\_confirmations columns.



Path conventions for Storage uploads (every upload's path MUST begin with the organization ID):

\- pod-photos/{org\_id}/{load\_confirmation\_id}/{filename}

\- vehicle-compliance/{org\_id}/{vehicle\_id}/{filename}

\- supplier-docs/{org\_id}/{supplier\_id}/{filename}

\- workshop-files/{org\_id}/{type}/{entity\_id}/{filename}  (type = service|jobcard|checklist)

\- incident-files/{org\_id}/{incident\_id}/{filename}

\- supplier-applications/{org\_id}/{application\_id}/{filename}

\- public-assets/{org\_id}/{filename}



The storage RLS policies depend on this structure to enforce org isolation. Get the path wrong and uploads will be rejected.



\---



\## 5. The migration plan (do these IN ORDER)



\### Task 1: Project setup



1\. Install Supabase client: npm install @supabase/supabase-js

2\. Create .env.local in the project root with these three values (Marc will provide):

&#x20;  VITE\_SUPABASE\_URL=<the project URL>

&#x20;  VITE\_SUPABASE\_ANON\_KEY=<the anon key>

&#x20;  VITE\_ANTHROPIC\_API\_KEY=<Anthropic API key for AI features>

&#x20;  Never commit .env.local. Confirm .gitignore already excludes it.

3\. Create src/lib/supabase.ts — a single shared client instance using createClient from @supabase/supabase-js. Export it as a singleton.

4\. Generate TypeScript types from Supabase using the command in section 4 above and save to src/lib/database.types.ts. Pass the typed Database generic to createClient.



\### Task 2: Replace localStorage with Supabase in RawDataContext



This is the heart of the migration. The existing RawDataContext (find it in contexts/ or src/contexts/) loads/saves all the app's state to localStorage via useReducer and useEffect.



Replace it with a Supabase-backed version that:

1\. On mount: fetches initial data from each table the app uses (vehicles, profiles, fuel\_entries, etc.) — only data the current user can see (RLS handles filtering automatically).

2\. On state changes: mutates Supabase via .insert(), .update(), .delete() calls instead of writing to localStorage.

3\. Real-time: subscribes to postgres\_changes on each table so when another user makes a change, this user's UI updates without a refresh.



Do not change the shape of the context's public API. Every component that consumes useFleet(), useOperations(), etc. should keep working without modification. The point of the well-designed context layer is that the persistence swap is invisible to consumers.



\### Task 3: Replace mock auth with Supabase Auth



The existing Login/ClientLogin components have mock auth. Replace with real auth:

1\. Login form calls supabase.auth.signInWithPassword({ email, password }).

2\. On success, supabase.auth.getSession() provides the session. Store it in the AuthContext.

3\. On app load, hydrate session from supabase.auth.getSession() and listen to supabase.auth.onAuthStateChange.

4\. Logout calls supabase.auth.signOut().

5\. The current user's profiles row is fetched once on login (by id = auth.user.id) and stored in AuthContext. Use it for role checks throughout the app.

6\. Password reset: use supabase.auth.resetPasswordForEmail(). Keep it simple — the existing UI can have a "Forgot password" link added.

7\. No "Create account" flow yet. New users are created by Admins via the user management UI.



\### Task 4: Replace file uploads (base64 -> Storage)



Wherever the app currently uploads a file (POD photos, compliance docs, cargo photos, etc.), change from base64-into-state to Supabase Storage upload. Use signed URLs to display private files; getPublicUrl() for public-assets bucket.



\### Task 5: Replace Gemini AI with Anthropic Claude



The existing app uses Google Gemini. Replace with the Anthropic SDK:

npm uninstall @google/generative-ai

npm install @anthropic-ai/sdk



Wherever the app calls Gemini (look in VehicleChat.tsx, dispatch assistant, POD analysis), call Anthropic instead. Use model claude-sonnet-4-20250514. Keep the calling code structure the same; just swap the SDK.



\### Task 6: Verification



Once tasks 1-5 are done, verify by:

1\. Marc logs in with marcsnyman@fbn-transport.co.za and his password

2\. He sees an empty system (no mock data — Supabase has no vehicles/loads yet)

3\. He creates a vehicle -> it appears in Supabase Table Editor under vehicles

4\. He uploads a vehicle compliance doc -> it appears in the vehicle-compliance Storage bucket

5\. He logs out, opens in a different browser, logs back in — sees the same vehicle (proving it's not in localStorage)



\---



\## 6. Hard rules — do not violate



\- Do not modify the schema. Don't add tables, columns, or change types. If something seems missing, ask Marc.

\- Do not bypass RLS by using the service\_role key in client code. The browser only uses the anon key.

\- Do not commit .env.local. Verify .gitignore covers it.

\- Do not leave mock data in production. Delete or feature-flag mockData.ts so it doesn't pollute the real database.

\- Do not change UI/UX in this migration. Visual changes wait for a separate phase.

\- Do not refactor for refactoring's sake. The architecture is good. Touch only what the migration requires.

\- Do not forget the organization\_id when inserting into any table. Every insert needs it set to FBN's UUID (00000000-0000-0000-0000-000000000001). The RLS won't auto-fill it.

\- Do not delete data without confirmation. Use soft deletes (is\_active = false) where the schema supports it.

\- Test on Marc's Super Admin account first. Other roles get tested after the basic flow works.



\---



\## 7. Things you may want to ask Marc about before starting



Before writing any code, run through these. He'd rather you ask than guess.



1\. Project ID: confirm the exact Supabase project ID (visible in the project URL).

2\. Anon key + URL: Marc has these saved. Get them before starting .env.local.

3\. Anthropic API key: Marc may need to generate one at console.anthropic.com if he hasn't already.

4\. Existing AI calls: show Marc each place the app calls Gemini before swapping, so he can confirm the behavior.

5\. The mock-data wipe: confirm Marc is OK with the app starting empty after migration (no mock vehicles, no mock loads).

6\. Git workflow: Marc uses GitHub Desktop. Commit incrementally — one logical change per commit — so Marc can review in GitHub Desktop's diff viewer between commits.



\---



\## 8. The first thing to do when Claude Code starts



1\. Run dir (Windows) to see the project structure.

2\. Read package.json to confirm the stack.

3\. Read types.ts to confirm the data model.

4\. Read contexts/ (or wherever RawDataContext lives) to understand the current state shape.

5\. Read this brief one more time.

6\. Then start a conversation with Marc: confirm specific questions from section 7, and lay out your plan before writing any code.



\---



\## 9. Out of scope for this migration (Phase 2+)



These are real needs but explicitly deferred. Do not build them in this migration:



\- Public quote-request form (anonymous user submits a quote request from the FBN website)

\- Public supplier-application form (anonymous user applies to become a subcontractor)

\- WhatsApp integration for driver dispatch

\- QuickBooks sync

\- Telematics integration (Cartrack/Netstar/MiX)

\- Container \& port tracking subsystem (demurrage/detention)

\- Warehouse / storage management subsystem

\- Backload / empty-km tracking module

\- Customer order / PO entity linking multiple loads

\- Proper Invoice entity with AR aging

\- Vehicle CPK derived view (we'll add this as a Postgres view once we know which metrics matter most in the UI)



If something in the migration touches one of these areas, stop and check with Marc.



\---



\## 10. When you're done



Phase 1 is complete when:



\- App runs locally with Supabase backend (no localStorage)

\- Marc can log in as Super Admin with his real email/password

\- Marc can create a vehicle, a client, a quote, a load — all persist to Supabase

\- Marc can upload a POD photo — it lands in pod-photos bucket

\- Multiple browser sessions on different machines see the same data

\- All AI features work via Anthropic instead of Gemini

\- Code is committed to GitHub in clean, reviewable chunks

\- The app is functionally identical to before — just running on real cloud infrastructure



That's the goal. New features come in Phase 2 once the foundation is proven.



\---



End of brief. Read this entire document before writing any code.

