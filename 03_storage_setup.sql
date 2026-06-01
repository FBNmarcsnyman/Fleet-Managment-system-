-- ============================================================================
-- FBN FLEET MANAGEMENT SYSTEM - SUPABASE STORAGE SETUP
-- ============================================================================

-- ============================================================================
-- PART 0: CLEANUP (makes this file safe to run multiple times)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname IN (
              'pod_photos_select', 'pod_photos_insert', 'pod_photos_modify', 'pod_photos_delete',
              'vehicle_compliance_select', 'vehicle_compliance_write', 'vehicle_compliance_update', 'vehicle_compliance_delete',
              'supplier_docs_select', 'supplier_docs_write', 'supplier_docs_update', 'supplier_docs_delete',
              'workshop_files_select', 'workshop_files_insert', 'workshop_files_update', 'workshop_files_delete',
              'incident_files_select', 'incident_files_insert', 'incident_files_update', 'incident_files_delete',
              'supplier_applications_select', 'supplier_applications_insert', 'supplier_applications_delete',
              'public_assets_insert', 'public_assets_update', 'public_assets_delete'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS storage_path_part(TEXT, INT) CASCADE;

-- ============================================================================
-- Creates the file storage buckets used by the app and applies access policies
-- to the storage.objects table (Supabase Storage uses standard PostgreSQL RLS).
--
-- IMPORTANT: This file MUST be run AFTER 01_schema.sql AND 02_rls_policies.sql
-- (it relies on the helper functions defined in file 02).
--
-- PATH CONVENTION
-- ---------------
-- Every uploaded file's path starts with the organization ID, then a
-- type-specific structure:
--
--   pod-photos/{org_id}/{load_confirmation_id}/{filename}
--   vehicle-compliance/{org_id}/{vehicle_id}/{filename}
--   supplier-docs/{org_id}/{supplier_id}/{filename}
--   workshop-files/{org_id}/{type}/{entity_id}/{filename}    -- type = service|jobcard|checklist
--   incident-files/{org_id}/{incident_id}/{filename}
--   supplier-applications/{org_id}/{application_id}/{filename}
--   public-assets/{org_id}/{filename}
--
-- The first folder (org_id) is enforced by RLS policies to prevent cross-org
-- access. Application code MUST construct paths in this exact format.
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE BUCKETS
-- ============================================================================
-- All buckets are private by default (require auth to access via signed URLs
-- or with proper RLS). Only 'public-assets' is public.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    -- POD photos, signatures, cargo photos. Up to 10MB per file. Images only.
    ('pod-photos', 'pod-photos', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),

    -- Vehicle compliance docs (COF, license disc, insurance certs). Up to 10MB.
    ('vehicle-compliance', 'vehicle-compliance', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),

    -- Supplier compliance docs + rate cards. Up to 20MB (rate cards can be big PDFs).
    ('supplier-docs', 'supplier-docs', false, 20971520,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-excel']),

    -- Service entries, job cards, checklist photos. Up to 10MB.
    ('workshop-files', 'workshop-files', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),

    -- Incident photos and supporting docs. Up to 15MB.
    ('incident-files', 'incident-files', false, 15728640,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),

    -- Supplier application uploads (fleet lists, rate cards, insurance certs).
    -- Allows uploads from anonymous applicants via a separate signed-upload flow.
    ('supplier-applications', 'supplier-applications', false, 20971520,
        ARRAY['image/jpeg', 'image/png', 'application/pdf',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-excel']),

    -- Public assets (org logos, branding). Publicly readable, admin-only write.
    ('public-assets', 'public-assets', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 2: HELPER FUNCTION FOR PATH PARSING
-- ============================================================================
-- Pulls the Nth folder from a storage object path. Index is 1-based.
-- Example: storage_path_part('abc/def/file.jpg', 1) = 'abc'

CREATE OR REPLACE FUNCTION storage_path_part(path TEXT, idx INT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
    SELECT split_part(path, '/', idx);
$$;

-- ============================================================================
-- PART 3: POD-PHOTOS BUCKET POLICIES
-- ============================================================================
-- Path: pod-photos/{org_id}/{load_confirmation_id}/{filename}
-- Visibility: anyone who can see the load (same rules as load_confirmations RLS)

-- SELECT: any authenticated user in the org who can see this load
CREATE POLICY pod_photos_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'pod-photos'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND EXISTS (
            SELECT 1 FROM load_confirmations lc
            WHERE lc.id::text = storage_path_part(name, 2)
              AND lc.organization_id = auth_org_id()
              AND (
                  auth_is_admin()
                  OR (
                      auth_role() = 'Staff'
                      AND (
                          lc.collection_branch_id IS NULL
                          OR lc.destination_branch_id IS NULL
                          OR auth_can_see_branch(lc.collection_branch_id)
                          OR auth_can_see_branch(lc.destination_branch_id)
                      )
                  )
                  OR lc.driver_id = auth.uid()
                  OR lc.client_id = auth_client_id()
                  OR lc.supplier_id = auth_supplier_id()
              )
        )
    );

-- INSERT: drivers can upload PODs for their loads; staff/admin can upload anything
CREATE POLICY pod_photos_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'pod-photos'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND EXISTS (
            SELECT 1 FROM load_confirmations lc
            WHERE lc.id::text = storage_path_part(name, 2)
              AND lc.organization_id = auth_org_id()
              AND (
                  auth_is_admin()
                  OR (
                      auth_role() = 'Staff'
                      AND (
                          lc.collection_branch_id IS NULL
                          OR auth_can_see_branch(lc.collection_branch_id)
                          OR auth_can_see_branch(lc.destination_branch_id)
                      )
                  )
                  OR lc.driver_id = auth.uid()
              )
        )
    );

-- UPDATE/DELETE: only admin or the original uploader
CREATE POLICY pod_photos_modify ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'pod-photos'
        AND (auth_is_admin() OR owner = auth.uid())
    )
    WITH CHECK (
        bucket_id = 'pod-photos'
        AND (auth_is_admin() OR owner = auth.uid())
    );

CREATE POLICY pod_photos_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'pod-photos'
        AND (auth_is_admin() OR owner = auth.uid())
    );

-- ============================================================================
-- PART 4: VEHICLE-COMPLIANCE BUCKET POLICIES
-- ============================================================================
-- Path: vehicle-compliance/{org_id}/{vehicle_id}/{filename}
-- Visibility: Admin, or Workshop/Ops who can see the vehicle, or assigned driver

CREATE POLICY vehicle_compliance_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'vehicle-compliance'
        AND storage_path_part(storage.objects.name, 1) = auth_org_id()::text
        AND (
            auth_is_admin()
            OR (
                (auth_is_workshop() OR auth_is_ops())
                AND auth_can_see_vehicle(storage_path_part(storage.objects.name, 2)::uuid)
            )
            OR (
                auth_role() = 'Driver'
                AND EXISTS (
                    SELECT 1 FROM vehicles v, profiles p
                    WHERE v.id::text = storage_path_part(storage.objects.name, 2)
                      AND p.id = auth.uid()
                      AND (
                          v.assigned_driver_id = auth.uid()
                          OR v.id = ANY (p.assigned_vehicle_ids)
                      )
                )
            )
        )
    );

-- INSERT/UPDATE/DELETE: Workshop only (within branch scope)
CREATE POLICY vehicle_compliance_write ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'vehicle-compliance'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND auth_is_workshop()
        AND auth_can_see_vehicle(storage_path_part(name, 2)::uuid)
    );

CREATE POLICY vehicle_compliance_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'vehicle-compliance'
        AND auth_is_workshop()
    )
    WITH CHECK (
        bucket_id = 'vehicle-compliance'
        AND auth_is_workshop()
    );

CREATE POLICY vehicle_compliance_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'vehicle-compliance'
        AND (auth_is_admin() OR (auth_is_workshop() AND owner = auth.uid()))
    );

-- ============================================================================
-- PART 5: SUPPLIER-DOCS BUCKET POLICIES
-- ============================================================================
-- Path: supplier-docs/{org_id}/{supplier_id}/{filename}
-- Visibility: Admin, Workshop, Ops, or the supplier itself (portal user)

CREATE POLICY supplier_docs_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'supplier-docs'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND (
            auth_is_admin()
            OR auth_is_workshop()
            OR auth_is_ops()
            OR storage_path_part(name, 2) = auth_supplier_id()::text
        )
    );

CREATE POLICY supplier_docs_write ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'supplier-docs'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND (
            auth_is_admin()
            OR auth_is_workshop()
            OR auth_is_ops()
            OR storage_path_part(name, 2) = auth_supplier_id()::text
        )
    );

CREATE POLICY supplier_docs_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'supplier-docs'
        AND (
            auth_is_admin()
            OR auth_is_workshop()
            OR auth_is_ops()
            OR (storage_path_part(name, 2) = auth_supplier_id()::text AND owner = auth.uid())
        )
    )
    WITH CHECK (
        bucket_id = 'supplier-docs'
        AND (
            auth_is_admin()
            OR auth_is_workshop()
            OR auth_is_ops()
            OR (storage_path_part(name, 2) = auth_supplier_id()::text AND owner = auth.uid())
        )
    );

CREATE POLICY supplier_docs_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'supplier-docs'
        AND (auth_is_admin() OR (auth_is_ops() AND owner = auth.uid()))
    );

-- ============================================================================
-- PART 6: WORKSHOP-FILES BUCKET POLICIES
-- ============================================================================
-- Path: workshop-files/{org_id}/{type}/{entity_id}/{filename}
--   type = 'service' | 'jobcard' | 'checklist'
-- Visibility: Workshop + Admin only (Ops doesn't manage workshop docs)

CREATE POLICY workshop_files_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'workshop-files'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND (
            auth_is_admin()
            OR auth_is_workshop()
            -- Drivers can see their own checklist photos
            OR (
                auth_role() = 'Driver'
                AND storage_path_part(name, 2) = 'checklist'
                AND EXISTS (
                    SELECT 1 FROM checklist_submissions cs
                    WHERE cs.id::text = storage_path_part(name, 3)
                      AND cs.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY workshop_files_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'workshop-files'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND (
            auth_is_admin()
            OR auth_is_workshop()
            -- Drivers upload checklist photos when submitting
            OR (
                auth_role() = 'Driver'
                AND storage_path_part(name, 2) = 'checklist'
            )
        )
    );

CREATE POLICY workshop_files_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'workshop-files'
        AND (auth_is_admin() OR auth_is_workshop() OR owner = auth.uid())
    )
    WITH CHECK (
        bucket_id = 'workshop-files'
        AND (auth_is_admin() OR auth_is_workshop() OR owner = auth.uid())
    );

CREATE POLICY workshop_files_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'workshop-files'
        AND (auth_is_admin() OR auth_is_workshop())
    );

-- ============================================================================
-- PART 7: INCIDENT-FILES BUCKET POLICIES
-- ============================================================================
-- Path: incident-files/{org_id}/{incident_id}/{filename}
-- Visibility: anyone who can see the incident (Workshop + Ops + Admin + reporter)

CREATE POLICY incident_files_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'incident-files'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND EXISTS (
            SELECT 1 FROM incident_reports ir
            WHERE ir.id::text = storage_path_part(name, 2)
              AND ir.organization_id = auth_org_id()
              AND (
                  auth_is_admin()
                  OR (
                      (auth_is_workshop() OR auth_is_ops())
                      AND (
                          ir.vehicle_id IS NULL
                          OR auth_can_see_vehicle(ir.vehicle_id)
                      )
                  )
                  OR ir.user_id = auth.uid()
              )
        )
    );

CREATE POLICY incident_files_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'incident-files'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND EXISTS (
            SELECT 1 FROM incident_reports ir
            WHERE ir.id::text = storage_path_part(name, 2)
              AND ir.organization_id = auth_org_id()
              AND (
                  auth_is_admin()
                  OR auth_is_workshop()
                  OR auth_is_ops()
                  OR ir.user_id = auth.uid()
              )
        )
    );

CREATE POLICY incident_files_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'incident-files'
        AND (auth_is_admin() OR auth_is_workshop() OR auth_is_ops() OR owner = auth.uid())
    )
    WITH CHECK (
        bucket_id = 'incident-files'
        AND (auth_is_admin() OR auth_is_workshop() OR auth_is_ops() OR owner = auth.uid())
    );

CREATE POLICY incident_files_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'incident-files'
        AND auth_is_admin()
    );

-- ============================================================================
-- PART 8: SUPPLIER-APPLICATIONS BUCKET POLICIES
-- ============================================================================
-- Path: supplier-applications/{org_id}/{application_id}/{filename}
-- Visibility:
--   - Authenticated Ops/Admin can read all
--   - Anonymous uploads handled separately (signed URL upload by anon role)
--   - Once approved, files would be moved/copied to supplier-docs bucket

CREATE POLICY supplier_applications_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'supplier-applications'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND auth_is_ops()
    );

CREATE POLICY supplier_applications_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'supplier-applications'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND auth_is_ops()
    );

CREATE POLICY supplier_applications_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'supplier-applications'
        AND auth_is_admin()
    );

-- NOTE: Public application form uploads (from anonymous applicants without
-- accounts) will need a separate signed-upload flow handled in app code.
-- We'll wire that up when we build the public supplier application form.

-- ============================================================================
-- PART 9: PUBLIC-ASSETS BUCKET POLICIES
-- ============================================================================
-- Path: public-assets/{org_id}/{filename}
-- Visibility: Public read (it's a public bucket). Admin write only.

CREATE POLICY public_assets_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'public-assets'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND auth_is_admin()
    );

CREATE POLICY public_assets_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'public-assets'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND auth_is_admin()
    )
    WITH CHECK (
        bucket_id = 'public-assets'
        AND storage_path_part(name, 1) = auth_org_id()::text
        AND auth_is_admin()
    );

CREATE POLICY public_assets_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'public-assets'
        AND auth_is_admin()
    );

-- ============================================================================
-- END OF STORAGE SETUP
-- ============================================================================
-- 7 buckets created with role+branch-scoped policies.
-- Files are accessed by app code using signed URLs (private buckets) or
-- public URLs (public-assets only).
--
-- All three SQL files are now ready to run against the live Supabase project.
-- ============================================================================
