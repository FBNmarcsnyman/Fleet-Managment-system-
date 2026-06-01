-- ============================================================================
-- FBN FLEET MANAGEMENT SYSTEM - ROW LEVEL SECURITY POLICIES (v2 - clean split)
-- ============================================================================

-- ============================================================================
-- PART 0: CLEANUP (makes this file safe to run multiple times)
-- ============================================================================
-- Drops any pre-existing policies and helper functions from previous runs so
-- this file can be re-executed without "already exists" errors.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS auth_profile()                CASCADE;
DROP FUNCTION IF EXISTS auth_org_id()                 CASCADE;
DROP FUNCTION IF EXISTS auth_role()                   CASCADE;
DROP FUNCTION IF EXISTS auth_client_id()              CASCADE;
DROP FUNCTION IF EXISTS auth_supplier_id()            CASCADE;
DROP FUNCTION IF EXISTS auth_is_admin()               CASCADE;
DROP FUNCTION IF EXISTS auth_is_ops()                 CASCADE;
DROP FUNCTION IF EXISTS auth_is_workshop()            CASCADE;
DROP FUNCTION IF EXISTS auth_has_permission(TEXT)     CASCADE;
DROP FUNCTION IF EXISTS is_loadmaster_branch(UUID)    CASCADE;
DROP FUNCTION IF EXISTS auth_can_see_branch(UUID)     CASCADE;
DROP FUNCTION IF EXISTS auth_can_see_vehicle(UUID)    CASCADE;

-- ============================================================================
-- Strategy: Moderate RLS with branch-scoped access and clear role separation
--
-- ROLE GUIDE
-- ----------
-- Super Admin / Admin : Full access across the organization
-- Staff (Operations)  : Quotes, loads, manifests, trip sheets, routes, clients,
--                       cost dashboards. READ-ONLY on service intervals/entries
--                       and planned services (to know what's off the road).
--                       NO access to fuel/bowsers, workshop internals.
-- Workshop Manager    : Vehicles, checklists, job cards, tires, service work,
--                       parts (branch-scoped), POs, suppliers, incidents.
--                       NO access to ops (loads/manifests/quotes/trip sheets)
--                       or fuel/bowsers.
-- Driver              : Own profile, own assigned vehicles, own loads/trip
--                       sheets, own checklist submissions, own fuel entries,
--                       own incident reports.
-- Client portal user  : Own client record, own quotes, own loads.
-- Supplier portal user: Own supplier record, own compliance docs, own loads.
--
-- BRANCH SCOPING
-- --------------
-- Staff and Workshop are scoped to assigned_branch_ids + LOADMASTER.
-- Empty assigned_branch_ids = no access (must be explicitly assigned).
-- Admins always see all branches.
--
-- FUEL & BOWSERS
-- --------------
-- Admin manages by default. Drivers can insert own fuel entries (data entry).
-- Staff users can be granted the 'manage_fuel' permission flag on their
-- profile.permissions array, giving them full fuel/bowser access without
-- making them full Admin.
-- Ops sees Vehicle CPK on the vehicle dashboard (derived metric), not raw
-- fuel records.
--
-- PERMISSION FLAGS (profile.permissions array)
-- --------------------------------------------
-- Permissions can be granted to any user to widen their access beyond their
-- role's default. Admins implicitly have ALL permissions.
--   'manage_fuel'  - full access to bowsers, fuel prices, refills, fuel entries
--   (more can be added over time without schema changes)
--
-- IMPORTANT: This file MUST be run AFTER 01_schema.sql.
-- ============================================================================

-- ============================================================================
-- PART 1: HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION auth_profile()
RETURNS profiles
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT * FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_client_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT client_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_supplier_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT supplier_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT role IN ('Admin', 'Super Admin')
    FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_is_ops()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT role IN ('Admin', 'Super Admin', 'Staff')
    FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_is_workshop()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT role IN ('Admin', 'Super Admin', 'Workshop Manager')
    FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Check if current user has a specific permission flag set on their profile.
-- Admins implicitly have ALL permissions. Permission strings used so far:
--   'manage_fuel'  -> grants Staff users full access to fuel/bowsers
-- Add more permissions over time without schema changes.
CREATE OR REPLACE FUNCTION auth_has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT
        CASE
            WHEN role IN ('Admin', 'Super Admin') THEN true
            ELSE perm = ANY (permissions)
        END
    FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Is this branch the LOADMASTER linehaul branch? (every branch user sees LM)
CREATE OR REPLACE FUNCTION is_loadmaster_branch(target_branch UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM branches
        WHERE id = target_branch AND code = 'LOADMASTER'
    );
$$;

-- Can the current user see records belonging to this branch?
CREATE OR REPLACE FUNCTION auth_can_see_branch(target_branch UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT
        CASE
            WHEN role IN ('Admin', 'Super Admin') THEN true
            WHEN is_loadmaster_branch(target_branch) THEN true
            ELSE target_branch = ANY (assigned_branch_ids)
        END
    FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Can current user see records attached to this vehicle?
CREATE OR REPLACE FUNCTION auth_can_see_vehicle(target_vehicle UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT
        CASE
            WHEN (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Admin', 'Super Admin') THEN true
            ELSE EXISTS (
                SELECT 1 FROM vehicles v
                WHERE v.id = target_vehicle
                  AND auth_can_see_branch(v.branch_id)
            )
        END;
$$;

-- ============================================================================
-- PART 2: ENABLE RLS ON EVERY TABLE
-- ============================================================================

ALTER TABLE organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_compliance_docs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_rate_cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_applications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_compliance_docs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tires                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_mount_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_inspections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_prices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowsers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowser_refills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_intervals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_costs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_costs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_confirmations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifests                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_sheets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_cases                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: ORGANIZATIONS (tenant root)
-- ============================================================================

CREATE POLICY org_select ON organizations
    FOR SELECT TO authenticated
    USING (id = auth_org_id());

CREATE POLICY org_update ON organizations
    FOR UPDATE TO authenticated
    USING (id = auth_org_id() AND auth_is_admin())
    WITH CHECK (id = auth_org_id() AND auth_is_admin());

-- ============================================================================
-- PART 4: BRANCHES & ROUTES
-- ============================================================================

CREATE POLICY branches_select ON branches
    FOR SELECT TO authenticated
    USING (organization_id = auth_org_id());

CREATE POLICY branches_admin_write ON branches
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_admin())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_admin());

CREATE POLICY routes_select ON routes
    FOR SELECT TO authenticated
    USING (organization_id = auth_org_id());

CREATE POLICY routes_ops_write ON routes
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

-- ============================================================================
-- PART 5: PROFILES
-- ============================================================================

CREATE POLICY profiles_select_org ON profiles
    FOR SELECT TO authenticated
    USING (organization_id = auth_org_id());

CREATE POLICY profiles_update_self ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND organization_id = auth_org_id());

CREATE POLICY profiles_admin_all ON profiles
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_admin())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_admin());

-- ============================================================================
-- PART 6: CLIENTS (Ops-managed)
-- ============================================================================

CREATE POLICY clients_select ON clients
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_ops()
            OR auth_role() = 'Driver'
            OR id = auth_client_id()
        )
    );

CREATE POLICY clients_write ON clients
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

-- ============================================================================
-- PART 7: SUPPLIERS (Workshop + Ops both read/write - cover parts + subcontractors)
-- ============================================================================

CREATE POLICY suppliers_select ON suppliers
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin() OR auth_is_workshop() OR auth_is_ops()
            OR id = auth_supplier_id()
        )
    );

CREATE POLICY suppliers_write ON suppliers
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_is_workshop() OR auth_is_ops())
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_is_workshop() OR auth_is_ops())
    );

CREATE POLICY supplier_docs_select ON supplier_compliance_docs
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin() OR auth_is_workshop() OR auth_is_ops()
            OR supplier_id = auth_supplier_id()
        )
    );

CREATE POLICY supplier_docs_write ON supplier_compliance_docs
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin() OR auth_is_workshop() OR auth_is_ops()
            OR supplier_id = auth_supplier_id()
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin() OR auth_is_workshop() OR auth_is_ops()
            OR supplier_id = auth_supplier_id()
        )
    );

CREATE POLICY supplier_ratecards_all ON supplier_rate_cards
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin() OR auth_is_workshop() OR auth_is_ops()
            OR supplier_id = auth_supplier_id()
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin() OR auth_is_workshop() OR auth_is_ops()
            OR supplier_id = auth_supplier_id()
        )
    );

CREATE POLICY supplier_apps_all ON supplier_applications
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

-- ============================================================================
-- PART 8: VEHICLES (Workshop edits, Ops reads, Driver sees own)
-- ============================================================================

CREATE POLICY vehicles_select ON vehicles
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND auth_can_see_branch(branch_id)
            )
            OR (
                auth_role() = 'Driver'
                AND (
                    assigned_driver_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM profiles p
                        WHERE p.id = auth.uid()
                          AND vehicles.id = ANY (p.assigned_vehicle_ids)
                    )
                )
            )
        )
    );

CREATE POLICY vehicles_write ON vehicles
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_branch(branch_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_branch(branch_id)
    );

CREATE POLICY vehicle_docs_select ON vehicle_compliance_docs
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND auth_can_see_vehicle(vehicle_id)
            )
            OR (
                auth_role() = 'Driver'
                AND EXISTS (
                    SELECT 1 FROM vehicles v, profiles p
                    WHERE v.id = vehicle_compliance_docs.vehicle_id
                      AND p.id = auth.uid()
                      AND (
                          v.assigned_driver_id = auth.uid()
                          OR v.id = ANY (p.assigned_vehicle_ids)
                      )
                )
            )
        )
    );

CREATE POLICY vehicle_docs_write ON vehicle_compliance_docs
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    );

-- ============================================================================
-- PART 9: TIRES (Workshop-only, org-wide)
-- ============================================================================

CREATE POLICY tires_select ON tires
    FOR SELECT TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_workshop());

CREATE POLICY tires_write ON tires
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_workshop())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_workshop());

CREATE POLICY tire_mounts_all ON tire_mount_history
    FOR ALL TO authenticated
    USING (
        auth_is_workshop()
        AND EXISTS (
            SELECT 1 FROM tires t
            WHERE t.id = tire_mount_history.tire_id
              AND t.organization_id = auth_org_id()
        )
    )
    WITH CHECK (
        auth_is_workshop()
        AND EXISTS (
            SELECT 1 FROM tires t
            WHERE t.id = tire_mount_history.tire_id
              AND t.organization_id = auth_org_id()
        )
    );

CREATE POLICY tire_inspections_all ON tire_inspections
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_workshop() OR auth_role() = 'Driver')
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_workshop() OR auth_role() = 'Driver')
    );

-- ============================================================================
-- PART 10: FUEL & BOWSERS
-- ============================================================================
-- Access:
--   - Admin / Super Admin                : full manage
--   - Staff with 'manage_fuel' permission: full manage (flagged back-office)
--   - Driver                             : insert own vehicle's fuel entries
--   - Everyone else (Ops without flag, Workshop): NO access
--
-- Ops still sees Vehicle CPK on the vehicle dashboard (derived field, not raw).

CREATE POLICY fuel_prices_manage ON fuel_prices
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    );

CREATE POLICY bowsers_manage ON bowsers
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    );

CREATE POLICY bowser_refills_manage ON bowser_refills
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    );

CREATE POLICY fuel_entries_select ON fuel_entries
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR auth_has_permission('manage_fuel')
            OR EXISTS (
                SELECT 1 FROM vehicles v
                WHERE v.id = fuel_entries.vehicle_id
                  AND v.assigned_driver_id = auth.uid()
            )
        )
    );

CREATE POLICY fuel_entries_insert ON fuel_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR auth_has_permission('manage_fuel')
            OR EXISTS (
                SELECT 1 FROM vehicles v
                WHERE v.id = fuel_entries.vehicle_id
                  AND v.assigned_driver_id = auth.uid()
            )
        )
    );

CREATE POLICY fuel_entries_modify ON fuel_entries
    FOR UPDATE TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    );

CREATE POLICY fuel_entries_delete ON fuel_entries
    FOR DELETE TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_has_permission('manage_fuel'))
    );

-- ============================================================================
-- PART 11: SERVICE INTERVALS, ENTRIES, PLANNED SERVICES
-- Workshop writes (does the work). Ops READS (plans around it).
-- ============================================================================

CREATE POLICY service_intervals_select ON service_intervals
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND auth_can_see_vehicle(vehicle_id)
            )
        )
    );

CREATE POLICY service_intervals_write ON service_intervals
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    );

CREATE POLICY service_entries_select ON service_entries
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND auth_can_see_vehicle(vehicle_id)
            )
        )
    );

CREATE POLICY service_entries_write ON service_entries
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    );

CREATE POLICY planned_services_select ON planned_services
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND auth_can_see_vehicle(vehicle_id)
            )
        )
    );

CREATE POLICY planned_services_write ON planned_services
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    );

-- ============================================================================
-- PART 12: COSTS (Ops), REVENUE (Ops), BUDGETS & FORECASTS (Admin)
-- ============================================================================

CREATE POLICY other_costs_all ON other_costs
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

CREATE POLICY recurring_costs_all ON recurring_costs
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

CREATE POLICY revenue_entries_all ON revenue_entries
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

CREATE POLICY budgets_all ON budgets
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_admin())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_admin());

CREATE POLICY forecasts_all ON forecasts
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_admin())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_admin());

-- ============================================================================
-- PART 13: CHECKLISTS & JOB CARDS (Workshop-managed; Ops NOT involved)
-- ============================================================================

CREATE POLICY checklist_templates_select ON checklist_templates
    FOR SELECT TO authenticated
    USING (organization_id = auth_org_id());

CREATE POLICY checklist_templates_write ON checklist_templates
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_workshop())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_workshop());

CREATE POLICY checklist_subs_select ON checklist_submissions
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (auth_is_workshop() AND auth_can_see_vehicle(vehicle_id))
            OR user_id = auth.uid()
        )
    );

CREATE POLICY checklist_subs_insert ON checklist_submissions
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = auth_org_id()
        AND user_id = auth.uid()
    );

CREATE POLICY checklist_subs_review ON checklist_submissions
    FOR UPDATE TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    );

CREATE POLICY job_cards_select ON job_cards
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (auth_is_workshop() AND auth_can_see_vehicle(vehicle_id))
            OR assigned_to_user_id = auth.uid()
        )
    );

CREATE POLICY job_cards_write ON job_cards
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND auth_can_see_vehicle(vehicle_id)
    );

-- ============================================================================
-- PART 14: PARTS (Workshop, branch-scoped), PURCHASE REQUESTS & ORDERS
-- ============================================================================

CREATE POLICY parts_select ON parts
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND (branch_id IS NULL OR auth_can_see_branch(branch_id))
    );

CREATE POLICY parts_write ON parts
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND (branch_id IS NULL OR auth_can_see_branch(branch_id))
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND auth_is_workshop()
        AND (branch_id IS NULL OR auth_can_see_branch(branch_id))
    );

CREATE POLICY purchase_requests_all ON purchase_requests
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_workshop())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_workshop());

CREATE POLICY purchase_orders_all ON purchase_orders
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_workshop())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_workshop());

-- ============================================================================
-- PART 15: OPERATIONS - Quotes, Loads, Manifests, Trip Sheets (Ops-managed)
-- ============================================================================

CREATE POLICY quotes_select ON quotes
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_ops()
            OR client_id = auth_client_id()
        )
    );

CREATE POLICY quotes_write ON quotes
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

CREATE POLICY loadcon_select ON load_confirmations
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                auth_role() = 'Staff'
                AND (
                    collection_branch_id IS NULL
                    OR destination_branch_id IS NULL
                    OR auth_can_see_branch(collection_branch_id)
                    OR auth_can_see_branch(destination_branch_id)
                )
            )
            OR driver_id = auth.uid()
            OR client_id = auth_client_id()
            OR supplier_id = auth_supplier_id()
        )
    );

CREATE POLICY loadcon_driver_update ON load_confirmations
    FOR UPDATE TO authenticated
    USING (organization_id = auth_org_id() AND driver_id = auth.uid())
    WITH CHECK (organization_id = auth_org_id() AND driver_id = auth.uid());

CREATE POLICY loadcon_ops_write ON load_confirmations
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                auth_role() = 'Staff'
                AND (
                    collection_branch_id IS NULL
                    OR destination_branch_id IS NULL
                    OR auth_can_see_branch(collection_branch_id)
                    OR auth_can_see_branch(destination_branch_id)
                )
            )
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                auth_role() = 'Staff'
                AND (
                    collection_branch_id IS NULL
                    OR destination_branch_id IS NULL
                    OR auth_can_see_branch(collection_branch_id)
                    OR auth_can_see_branch(destination_branch_id)
                )
            )
        )
    );

CREATE POLICY manifests_select ON manifests
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                auth_role() = 'Staff'
                AND (
                    auth_can_see_branch(origin_branch_id)
                    OR auth_can_see_branch(destination_branch_id)
                )
            )
            OR driver_id = auth.uid()
        )
    );

CREATE POLICY manifests_write ON manifests
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                auth_role() = 'Staff'
                AND (
                    auth_can_see_branch(origin_branch_id)
                    OR auth_can_see_branch(destination_branch_id)
                )
            )
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                auth_role() = 'Staff'
                AND (
                    auth_can_see_branch(origin_branch_id)
                    OR auth_can_see_branch(destination_branch_id)
                )
            )
        )
    );

CREATE POLICY tripsheets_select ON trip_sheets
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (auth_role() = 'Staff' AND auth_can_see_branch(branch_id))
            OR driver_id = auth.uid()
        )
    );

CREATE POLICY tripsheets_write ON trip_sheets
    FOR ALL TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (auth_role() = 'Staff' AND auth_can_see_branch(branch_id))
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (auth_role() = 'Staff' AND auth_can_see_branch(branch_id))
        )
    );

-- ============================================================================
-- PART 16: INCIDENTS (Workshop + Ops both see) & HR CASES (Ops only)
-- ============================================================================

CREATE POLICY incidents_select ON incident_reports
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND (
                    vehicle_id IS NULL
                    OR auth_can_see_vehicle(vehicle_id)
                )
            )
            OR user_id = auth.uid()
        )
    );

CREATE POLICY incidents_driver_insert ON incident_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = auth_org_id()
        AND user_id = auth.uid()
    );

CREATE POLICY incidents_staff_write ON incident_reports
    FOR UPDATE TO authenticated
    USING (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND (
                    vehicle_id IS NULL
                    OR auth_can_see_vehicle(vehicle_id)
                )
            )
        )
    )
    WITH CHECK (
        organization_id = auth_org_id()
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND (
                    vehicle_id IS NULL
                    OR auth_can_see_vehicle(vehicle_id)
                )
            )
        )
    );

CREATE POLICY incidents_admin_delete ON incident_reports
    FOR DELETE TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_admin());

CREATE POLICY hr_cases_all ON hr_cases
    FOR ALL TO authenticated
    USING (organization_id = auth_org_id() AND auth_is_ops())
    WITH CHECK (organization_id = auth_org_id() AND auth_is_ops());

-- ============================================================================
-- PART 17: NOTIFICATIONS & MESSAGES
-- ============================================================================

CREATE POLICY notifications_own ON notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND organization_id = auth_org_id());

CREATE POLICY notifications_staff_create ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = auth_org_id()
        AND (auth_is_admin() OR auth_is_workshop() OR auth_is_ops())
    );

CREATE POLICY messages_select ON messages
    FOR SELECT TO authenticated
    USING (
        organization_id = auth_org_id()
        AND auth_can_see_vehicle(vehicle_id)
    );

CREATE POLICY messages_insert ON messages
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = auth_org_id()
        AND user_id = auth.uid()
        AND auth_can_see_vehicle(vehicle_id)
    );

CREATE POLICY messages_own_modify ON messages
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY messages_own_delete ON messages
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR auth_is_admin());

-- ============================================================================
-- END OF RLS POLICIES (v2)
-- ============================================================================
