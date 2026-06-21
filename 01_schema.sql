-- ============================================================================
-- FBN FLEET MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- Target:    Supabase (PostgreSQL 15+)
-- Tenant:    Multi-tenant ready (FBN Transport only for now)
-- Auth:      Supabase Auth (auth.users)
-- Storage:   Supabase Storage (separate buckets for files)
-- Strategy:  Moderate Row Level Security (added in 02_rls_policies.sql)
-- ============================================================================

-- ============================================================================
-- PART 1: EXTENSIONS & SETUP
-- ============================================================================

-- UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Case-insensitive text (handy for emails, registration numbers)
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================================
-- PART 2: ORGANIZATIONS (Multi-tenant anchor)
-- ============================================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    legal_name      TEXT,
    registration_no TEXT,
    vat_no          TEXT,
    address         TEXT,
    phone           TEXT,
    email           CITEXT,
    logo_url        TEXT,
    primary_color   TEXT DEFAULT '#1A2B4C', -- FBN navy
    accent_color    TEXT DEFAULT '#F5C518', -- FBN yellow
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the one and only tenant for now
INSERT INTO organizations (id, name, legal_name, email, phone, address)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'FBN Transport',
    'FBN Transport (Pty) Ltd',
    'quotes@fbn-transport.co.za',
    '031 205 1705',
    'Durban, South Africa'
);

-- Convenience function: get current user's organization
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
    SELECT (current_setting('request.jwt.claims', true)::jsonb->>'org_id')::UUID;
$$;

-- ============================================================================
-- PART 3: BRANCHES & ROUTES
-- ============================================================================

CREATE TABLE branches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,           -- 'FBN JHB', 'FBN DBN', 'FBN CPT', 'LOADMASTER'
    name            TEXT NOT NULL,
    address         TEXT,
    phone           TEXT,
    email           CITEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, code)
);

INSERT INTO branches (organization_id, code, name) VALUES
    ('00000000-0000-0000-0000-000000000001', 'FBN DBN', 'FBN Durban'),
    ('00000000-0000-0000-0000-000000000001', 'FBN JHB', 'FBN Johannesburg'),
    ('00000000-0000-0000-0000-000000000001', 'FBN CPT', 'FBN Cape Town'),
    ('00000000-0000-0000-0000-000000000001', 'LOADMASTER', 'Loadmaster');

-- ADDITION #5 from migration plan: Routes/Lanes as proper entity
CREATE TABLE routes (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    origin                   TEXT NOT NULL,
    destination              TEXT NOT NULL,
    distance_km              NUMERIC(10,2),
    toll_cost                NUMERIC(10,2) DEFAULT 0,
    average_fuel_liters      NUMERIC(10,2),
    estimated_hours          NUMERIC(5,2),
    target_sell_per_kg       NUMERIC(10,2),
    target_sell_per_pallet   NUMERIC(10,2),
    target_sell_per_cbm      NUMERIC(10,2),
    target_sell_per_deck_m   NUMERIC(10,2),
    minimum_sell_full_load   NUMERIC(10,2),
    target_sell_full_load    NUMERIC(10,2),
    premium_sell_full_load   NUMERIC(10,2),
    notes                    TEXT,
    is_active                BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_routes_org ON routes(organization_id);
CREATE INDEX idx_routes_origin_dest ON routes(origin, destination);

-- ============================================================================
-- PART 4: USERS, ROLES & PERMISSIONS
-- ============================================================================
-- Note: auth.users is managed by Supabase Auth. We mirror profile data here.

CREATE TYPE user_role AS ENUM (
    'Super Admin',
    'Admin',
    'Staff',
    'Workshop Manager',
    'Driver',
    'Client',
    'Supplier'
);

CREATE TABLE profiles (
    id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                     TEXT NOT NULL,
    email                    CITEXT NOT NULL,
    phone                    TEXT,
    role                     user_role NOT NULL DEFAULT 'Staff',
    permissions              TEXT[] NOT NULL DEFAULT '{}',
    assigned_branch_ids      UUID[] NOT NULL DEFAULT '{}',
    assigned_vehicle_ids     UUID[] NOT NULL DEFAULT '{}',

    -- Driver-specific fields (ADDITION #4 from migration plan)
    license_number           TEXT,
    license_expiry           DATE,
    pdp_expiry               DATE,
    dg_cert_expiry           DATE,           -- DG certification (HAZMAT)
    medical_expiry           DATE,
    induction_date           DATE,
    last_refresher_date      DATE,

    -- Linked accounts for Client/Supplier portal users
    client_id                UUID,           -- FK added later (forward ref)
    supplier_id              UUID,           -- FK added later (forward ref)

    -- UI prefs
    navigation_preferences   JSONB,

    is_active                BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================================
-- PART 5: CLIENTS & SUPPLIERS
-- ============================================================================

CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    contact_person  TEXT,
    contact_email   CITEXT,
    contact_phone   TEXT,
    address         TEXT,
    sla_level       TEXT,
    credit_limit    NUMERIC(12,2),
    payment_terms_days INTEGER DEFAULT 30,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_clients_name ON clients(name);

CREATE TYPE supplier_type AS ENUM ('Workshop', 'Transport', 'Other');
CREATE TYPE compliance_status AS ENUM ('Compliant', 'Expired', 'Pending');

CREATE TABLE suppliers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    type                supplier_type NOT NULL DEFAULT 'Transport',
    contact_person      TEXT,
    contact_email       CITEXT,
    contact_phone       TEXT,
    address             TEXT,
    average_rating      NUMERIC(3,2),
    compliance_status   compliance_status NOT NULL DEFAULT 'Pending',
    expiry_date         DATE,
    bee_status          TEXT,
    haz_compliant       BOOLEAN DEFAULT false,
    specializations     TEXT[] DEFAULT '{}',
    regions             TEXT,
    fleet_size          TEXT,
    controller_contact  TEXT,
    accounts_contact    TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_vetted           BOOLEAN NOT NULL DEFAULT false,
    vetted_at           TIMESTAMPTZ,
    vehicle_types       TEXT[] DEFAULT '{}',
    trailer_types       TEXT[] DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX idx_suppliers_type ON suppliers(type);

-- Now we can wire up the forward refs on profiles
ALTER TABLE profiles ADD CONSTRAINT profiles_client_fk
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_supplier_fk
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE TYPE compliance_doc_type AS ENUM ('GIT', 'BEE', 'TAX', 'LOGS', 'COY_REG', 'OTH');
CREATE TYPE doc_status AS ENUM ('Valid', 'Expired', 'Pending Review');

CREATE TABLE supplier_compliance_docs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    type            compliance_doc_type NOT NULL,
    name            TEXT NOT NULL,
    file_url        TEXT,           -- Supabase Storage path
    file_name       TEXT,
    expiry_date     DATE,
    status          doc_status NOT NULL DEFAULT 'Pending Review',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supplier_docs_supplier ON supplier_compliance_docs(supplier_id);

CREATE TABLE supplier_rate_cards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    file_url        TEXT,
    file_name       TEXT,
    effective_from  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supplier onboarding applications
CREATE TYPE supplier_application_status AS ENUM ('Pending', 'Approved', 'Rejected');

CREATE TABLE supplier_applications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status              supplier_application_status NOT NULL DEFAULT 'Pending',
    submitted_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    company_name        TEXT NOT NULL,
    contact_person      TEXT,
    contact_email       CITEXT,
    contact_phone       TEXT,
    address             TEXT,
    specializations     TEXT[] DEFAULT '{}',
    routes              TEXT,
    fleet_size          TEXT,
    bee_status          TEXT,
    haz_compliant       BOOLEAN DEFAULT false,
    vehicle_types       TEXT[] DEFAULT '{}',
    trailer_types       TEXT[] DEFAULT '{}',
    invite_token        TEXT,
    fleet_list_url      TEXT,
    rate_card_url       TEXT,
    insurance_url       TEXT,
    approved_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carrier (subcontractor) invitation campaign. FBN uploads transporter emails,
-- sends a branded marketing invite with a personalised accept link, and tracks
-- each carrier down the funnel: Pending -> Invited -> Applied -> Vetted (or Declined).
CREATE TABLE subcontractor_invites (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    company_name        TEXT,
    contact_person      TEXT,
    token               TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Invited', 'Applied', 'Vetted', 'Declined')),
    sent_count          INT NOT NULL DEFAULT 0,
    last_sent_at        TIMESTAMPTZ,
    applied_at          TIMESTAMPTZ,
    application_id      UUID REFERENCES supplier_applications(id) ON DELETE SET NULL,
    supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    notes               TEXT,
    created_by_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, email),
    UNIQUE (token)
);
CREATE INDEX idx_subcontractor_invites_org ON subcontractor_invites(organization_id);
CREATE INDEX idx_subcontractor_invites_token ON subcontractor_invites(token);

-- ============================================================================
-- PART 6: VEHICLES, TIRES & COMPLIANCE
-- ============================================================================

CREATE TYPE vehicle_status AS ENUM ('On the road', 'In for service', 'Off the road', 'Sold');

CREATE TABLE vehicles (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id              UUID NOT NULL REFERENCES branches(id),
    name                   TEXT NOT NULL,
    make                   TEXT,
    model                  TEXT,
    year                   INTEGER,
    registration           CITEXT NOT NULL,
    vin                    TEXT,
    weight_category        TEXT,
    status                 vehicle_status NOT NULL DEFAULT 'On the road',
    purchase_price         NUMERIC(12,2),
    current_value          NUMERIC(12,2),
    linked_vehicle_id      UUID REFERENCES vehicles(id) ON DELETE SET NULL, -- for Superlinks (truck<->trailer)
    current_odometer       NUMERIC(12,2),
    current_hours          NUMERIC(12,2),
    assigned_driver_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    health_score           NUMERIC(5,2),

    -- ADDITION #1 from migration plan: Vehicle capacity profile
    pallet_spaces          INTEGER,
    payload_kg             NUMERIC(10,2),
    cubic_meters           NUMERIC(10,2),
    deck_meters            NUMERIC(10,2),

    -- ADDITION #2 from migration plan: Vehicle cost economics
    cost_per_km_target     NUMERIC(10,2),
    monthly_fixed_cost     NUMERIC(12,2),

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, registration)
);
CREATE INDEX idx_vehicles_org ON vehicles(organization_id);
CREATE INDEX idx_vehicles_branch ON vehicles(branch_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_driver ON vehicles(assigned_driver_id);

-- ADDITION #3 from migration plan: Vehicle compliance docs
CREATE TYPE vehicle_compliance_type AS ENUM (
    'COF', 'LICENSE_DISC', 'TRACKER_CERT', 'INSURANCE', 'PERMIT', 'CROSS_BORDER', 'DG_PERMIT', 'OTHER'
);

CREATE TABLE vehicle_compliance_docs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    type            vehicle_compliance_type NOT NULL,
    name            TEXT NOT NULL,
    file_url        TEXT,
    file_name       TEXT,
    issue_date      DATE,
    expiry_date     DATE,
    status          doc_status NOT NULL DEFAULT 'Valid',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vehicle_docs_vehicle ON vehicle_compliance_docs(vehicle_id);
CREATE INDEX idx_vehicle_docs_expiry ON vehicle_compliance_docs(expiry_date);

-- Tires
CREATE TYPE tire_status AS ENUM ('In Storage', 'Mounted', 'Out for Retread', 'Scrapped');
CREATE TYPE tire_type AS ENUM ('New', 'Retread');

CREATE TABLE tires (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    serial_number       TEXT NOT NULL,
    brand               TEXT,
    size                TEXT,
    type                tire_type NOT NULL DEFAULT 'New',
    purchase_date       DATE,
    purchase_price      NUMERIC(10,2),
    status              tire_status NOT NULL DEFAULT 'In Storage',
    assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    assigned_position   TEXT,
    retread_details     JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tires_org ON tires(organization_id);
CREATE INDEX idx_tires_vehicle ON tires(assigned_vehicle_id);

CREATE TABLE tire_mount_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tire_id             UUID NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
    vehicle_id          UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    position            TEXT,
    mounted_date        DATE,
    removed_date        DATE,
    mounted_odometer    NUMERIC(12,2),
    removed_odometer    NUMERIC(12,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tire_mounts_tire ON tire_mount_history(tire_id);

CREATE TABLE tire_inspections (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tire_id             UUID NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
    date                DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_odometer    NUMERIC(12,2),
    tread_depth_mm      NUMERIC(5,2),
    pressure_psi        NUMERIC(5,2),
    notes               TEXT,
    inspected_by_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 7: FUEL & BOWSERS
-- ============================================================================

CREATE TABLE fuel_prices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    start_date      DATE NOT NULL,
    price_per_liter NUMERIC(10,4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fuel_prices_date ON fuel_prices(start_date DESC);

CREATE TABLE bowsers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id       UUID REFERENCES branches(id),
    name            TEXT NOT NULL,
    capacity_liters NUMERIC(10,2),
    current_stock_liters NUMERIC(10,2) DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bowser_refills (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bowser_id            UUID NOT NULL REFERENCES bowsers(id) ON DELETE CASCADE,
    date                 DATE NOT NULL,
    liters               NUMERIC(10,2) NOT NULL,
    cost_per_liter       NUMERIC(10,4) NOT NULL,
    rebate_percentage    NUMERIC(5,2) DEFAULT 0,
    final_cost_per_liter NUMERIC(10,4) NOT NULL,
    supplier             TEXT,
    reference_number     TEXT NOT NULL,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bowser_refills_bowser ON bowser_refills(bowser_id);

CREATE TABLE fuel_entries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id          UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    odometer            NUMERIC(12,2) NOT NULL,
    liters              NUMERIC(10,2) NOT NULL,
    trip_distance_km    NUMERIC(10,2),         -- optional explicit override
    source_bowser_id    UUID REFERENCES bowsers(id) ON DELETE SET NULL,
    cost_per_liter      NUMERIC(10,4),          -- snapshot of price at time of fill
    total_cost          NUMERIC(12,2),          -- snapshot
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fuel_entries_vehicle ON fuel_entries(vehicle_id);
CREATE INDEX idx_fuel_entries_date ON fuel_entries(date DESC);

-- ============================================================================
-- PART 8: COSTS, REVENUE & BUDGETS
-- ============================================================================

CREATE TABLE service_intervals (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id         UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    description        TEXT NOT NULL,
    distance_interval  NUMERIC(10,2),
    time_interval_days INTEGER,
    hours_interval     NUMERIC(10,2),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE service_entries (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id         UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    date               DATE NOT NULL,
    start_odometer     NUMERIC(12,2),
    end_odometer       NUMERIC(12,2),
    start_hours        NUMERIC(12,2),
    end_hours          NUMERIC(12,2),
    description        TEXT NOT NULL,
    cost               NUMERIC(12,2) NOT NULL DEFAULT 0,
    attachment_url     TEXT,
    attachment_name    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_service_entries_vehicle ON service_entries(vehicle_id);

CREATE TABLE other_costs (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id         UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    date               DATE NOT NULL,
    category           TEXT NOT NULL,
    amount             NUMERIC(12,2) NOT NULL,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE recurring_frequency AS ENUM ('monthly', 'annually');

CREATE TABLE recurring_costs (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id         UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    category           TEXT NOT NULL,
    amount             NUMERIC(12,2) NOT NULL,
    frequency          recurring_frequency NOT NULL DEFAULT 'monthly',
    start_date         DATE NOT NULL,
    end_date           DATE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE revenue_entries (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id         UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    date               DATE NOT NULL,
    description        TEXT NOT NULL,
    amount             NUMERIC(12,2) NOT NULL,
    load_confirmation_id UUID,           -- FK added later
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_id          UUID NOT NULL,           -- could reference vehicle, branch, or org
    target_type        TEXT NOT NULL,           -- 'vehicle' | 'branch' | 'organization'
    amount             NUMERIC(12,2) NOT NULL,
    start_date         DATE NOT NULL,
    period             TEXT NOT NULL DEFAULT 'monthly',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE forecasts (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_id          UUID NOT NULL,
    target_type        TEXT NOT NULL,
    generated_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    forecasted_costs   JSONB NOT NULL,
    insights           TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 9: CHECKLISTS & JOB CARDS
-- ============================================================================

CREATE TABLE checklist_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    items           JSONB NOT NULL DEFAULT '[]', -- array of {id, label, requiresPhotoOnFail}
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE checklist_submission_status AS ENUM ('Submitted', 'Reviewed');

CREATE TABLE checklist_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id     UUID NOT NULL REFERENCES checklist_templates(id),
    template_name   TEXT NOT NULL,           -- snapshot in case template changes
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id),
    user_name       TEXT NOT NULL,           -- snapshot
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    odometer        NUMERIC(12,2),
    hours           NUMERIC(12,2),
    results         JSONB NOT NULL,          -- array of ChecklistItemResult
    status          checklist_submission_status NOT NULL DEFAULT 'Submitted',
    reviewed_by_id  UUID REFERENCES profiles(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_checklist_subs_vehicle ON checklist_submissions(vehicle_id);
CREATE INDEX idx_checklist_subs_date ON checklist_submissions(date DESC);

CREATE TYPE job_card_status AS ENUM (
    'Reported', 'Awaiting Inspection', 'Awaiting Parts', 'Pending Scheduling',
    'Scheduled', 'In Progress', 'Awaiting Sign-off', 'Resolved'
);
CREATE TYPE job_card_type AS ENUM ('Repair', 'Service', 'Inspection', 'Tyre Change', 'Spot Check');
CREATE TYPE priority_level AS ENUM ('Low', 'Medium', 'High', 'Critical');

CREATE TABLE job_cards (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id            UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    submission_id         UUID REFERENCES checklist_submissions(id) ON DELETE SET NULL,
    checklist_item_id     TEXT,
    service_interval_id   UUID REFERENCES service_intervals(id) ON DELETE SET NULL,
    item_description      TEXT NOT NULL,
    reporter_notes        TEXT,
    reporter_attachment_url TEXT,
    type                  job_card_type NOT NULL,
    status                job_card_status NOT NULL DEFAULT 'Reported',
    priority              priority_level NOT NULL DEFAULT 'Medium',
    severity              priority_level NOT NULL DEFAULT 'Medium',
    assigned_to_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reported_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    proposed_start_date   DATE,
    proposed_end_date     DATE,
    completion_date       TIMESTAMPTZ,
    labor_hours           NUMERIC(8,2),
    notes                 JSONB DEFAULT '[]',    -- array of {userId, text, timestamp}
    parts_used            JSONB DEFAULT '[]',    -- array of {partId, quantity, unitCost}
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_job_cards_vehicle ON job_cards(vehicle_id);
CREATE INDEX idx_job_cards_status ON job_cards(status);
CREATE INDEX idx_job_cards_assigned ON job_cards(assigned_to_user_id);

CREATE TABLE planned_services (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id         UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    description        TEXT NOT NULL,
    start_date         DATE NOT NULL,
    end_date           DATE NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 10: PARTS & PURCHASE ORDERS
-- ============================================================================

CREATE TABLE parts (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id            UUID REFERENCES branches(id),       -- branch-scoped inventory (NULL = org-wide)
    name                 TEXT NOT NULL,
    part_number          TEXT,
    supplier_id          UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    quantity_in_stock    NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock_level      NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost                 NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_parts_org ON parts(organization_id);
CREATE INDEX idx_parts_branch ON parts(branch_id);

CREATE TYPE purchase_request_status AS ENUM (
    'Pending', 'Awaiting Quotes', 'Awaiting Approval', 'Approved',
    'Rejected', 'Ordered', 'Completed'
);

CREATE TABLE purchase_requests (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    part_id                UUID REFERENCES parts(id) ON DELETE SET NULL,
    job_card_id            UUID REFERENCES job_cards(id) ON DELETE SET NULL,
    quantity               NUMERIC(10,2) NOT NULL,
    requested_by_user_id   UUID REFERENCES profiles(id),
    requested_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    is_urgent              BOOLEAN NOT NULL DEFAULT false,
    status                 purchase_request_status NOT NULL DEFAULT 'Pending',
    quotes                 JSONB DEFAULT '[]',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE purchase_order_status AS ENUM ('Ordered', 'Partially Received', 'Received');

CREATE TABLE purchase_orders (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    po_number             TEXT NOT NULL,
    purchase_request_id   UUID REFERENCES purchase_requests(id) ON DELETE SET NULL,
    supplier_id           UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    order_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    items                 JSONB NOT NULL DEFAULT '[]',
    total_cost            NUMERIC(12,2) NOT NULL DEFAULT 0,
    status                purchase_order_status NOT NULL DEFAULT 'Ordered',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, po_number)
);

-- ============================================================================
-- PART 11: OPERATIONS - QUOTES, LOADS, MANIFESTS
-- ============================================================================

CREATE TYPE quote_status AS ENUM ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired');

CREATE TABLE quotes (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    quote_number          TEXT NOT NULL,
    client_id             UUID NOT NULL REFERENCES clients(id),
    route_id              UUID REFERENCES routes(id) ON DELETE SET NULL,
    date                  DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date           DATE,
    items                 JSONB NOT NULL DEFAULT '[]',  -- QuoteItem[]
    legs                  JSONB NOT NULL DEFAULT '[]',  -- QuoteLeg[]
    subcontractor_quotes  JSONB NOT NULL DEFAULT '[]',  -- SubcontractorQuote[]
    total_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status                quote_status NOT NULL DEFAULT 'Draft',
    sent_to_client        BOOLEAN NOT NULL DEFAULT false,
    customer_order_number TEXT,
    notes                 TEXT,
    special_requirements  TEXT,
    collection_date       DATE,
    commodity             TEXT,
    packaging             TEXT,
    load_spec             TEXT,
    created_by_id         UUID REFERENCES profiles(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, quote_number)
);
CREATE INDEX idx_quotes_org ON quotes(organization_id);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);

CREATE TYPE load_confirmation_status AS ENUM (
    'Booked', 'Driver Assigned', 'At Collection Point', 'Collected',
    'At Collection Depot', 'In Transit', 'At Destination Depot',
    'Out for Delivery', 'Delivered', 'POD Submitted', 'Invoiced', 'Cancelled'
);
CREATE TYPE payment_status AS ENUM ('Awaiting POD', 'Awaiting Review', 'Ready for Payment', 'Paid');

CREATE TABLE load_confirmations (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    load_con_number             TEXT NOT NULL,
    quote_id                    UUID REFERENCES quotes(id) ON DELETE SET NULL,
    client_id                   UUID NOT NULL REFERENCES clients(id),
    supplier_id                 UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    route_id                    UUID REFERENCES routes(id) ON DELETE SET NULL,
    collection_branch_id        UUID REFERENCES branches(id),
    destination_branch_id       UUID REFERENCES branches(id),
    date                        DATE NOT NULL DEFAULT CURRENT_DATE,
    items                       JSONB NOT NULL DEFAULT '[]',
    legs                        JSONB NOT NULL DEFAULT '[]',
    total_amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
    supplier_rate               NUMERIC(12,2),
    priority                    priority_level NOT NULL DEFAULT 'Medium',
    status                      load_confirmation_status NOT NULL DEFAULT 'Booked',
    collection_point            TEXT,
    delivery_point              TEXT,
    delivery_area               TEXT,
    collection_date             DATE,
    delivery_date               DATE,
    vehicle_id                  UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id                   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    pod_photo_url               TEXT,
    pod_signature_url           TEXT,
    payment_status              payment_status DEFAULT 'Awaiting POD',
    customer_order_number       TEXT,
    invoice_number              TEXT,
    invoice_date                DATE,
    cargo_photo_urls            TEXT[] DEFAULT '{}',
    damage_report               TEXT,
    notes                       JSONB DEFAULT '[]',
    pod_analysis                JSONB,           -- {recipientName, documentIssues, isSignaturePresent}
    sent_to_supplier_date       TIMESTAMPTZ,
    subcontractor_vehicle_reg   TEXT,
    subcontractor_driver_name   TEXT,
    subcontractor_driver_cell   TEXT,
    commodity                   TEXT,
    packaging                   TEXT,
    load_spec                   TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, load_con_number)
);
CREATE INDEX idx_loadcon_org ON load_confirmations(organization_id);
CREATE INDEX idx_loadcon_client ON load_confirmations(client_id);
CREATE INDEX idx_loadcon_status ON load_confirmations(status);
CREATE INDEX idx_loadcon_vehicle ON load_confirmations(vehicle_id);
CREATE INDEX idx_loadcon_driver ON load_confirmations(driver_id);
CREATE INDEX idx_loadcon_date ON load_confirmations(date DESC);

-- Now wire up revenue_entries FK
ALTER TABLE revenue_entries ADD CONSTRAINT revenue_loadcon_fk
    FOREIGN KEY (load_confirmation_id) REFERENCES load_confirmations(id) ON DELETE SET NULL;

CREATE TYPE manifest_status AS ENUM ('In Transit', 'Arrived');

CREATE TABLE manifests (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    manifest_number          TEXT NOT NULL,
    origin_branch_id         UUID NOT NULL REFERENCES branches(id),
    destination_branch_id    UUID NOT NULL REFERENCES branches(id),
    dispatch_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    arrival_date             DATE,
    vehicle_id               UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id                UUID REFERENCES profiles(id) ON DELETE SET NULL,
    load_confirmation_ids    UUID[] NOT NULL DEFAULT '{}',
    status                   manifest_status NOT NULL DEFAULT 'In Transit',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, manifest_number)
);

CREATE TYPE trip_sheet_status AS ENUM ('Out for Delivery', 'Completed');

CREATE TABLE trip_sheets (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trip_sheet_number        TEXT NOT NULL,
    branch_id                UUID NOT NULL REFERENCES branches(id),
    dispatch_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    completion_date          DATE,
    vehicle_id               UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id                UUID REFERENCES profiles(id) ON DELETE SET NULL,
    load_confirmation_ids    UUID[] NOT NULL DEFAULT '{}',
    status                   trip_sheet_status NOT NULL DEFAULT 'Out for Delivery',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, trip_sheet_number)
);

-- ============================================================================
-- PART 12: INCIDENTS & HR
-- ============================================================================

CREATE TYPE incident_status AS ENUM (
    'Reported', 'Claim Submitted', 'Awaiting Quotes',
    'Awaiting Repair', 'Repairs Complete', 'Closed'
);
CREATE TYPE at_fault_party AS ENUM ('Driver', 'Third Party');

CREATE TABLE incident_reports (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id               UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    user_id                  UUID REFERENCES profiles(id),
    date                     DATE NOT NULL DEFAULT CURRENT_DATE,
    incident_type            TEXT NOT NULL,     -- 'Accident', 'Near-miss', 'Traffic Violation', 'Fine', custom
    description              TEXT NOT NULL,
    third_party_involved     BOOLEAN NOT NULL DEFAULT false,
    attachment_urls          TEXT[] DEFAULT '{}',
    status                   incident_status NOT NULL DEFAULT 'Reported',
    quotes                   JSONB DEFAULT '[]',
    notes                    TEXT,
    at_fault_party           at_fault_party,
    insurance_claim_number   TEXT,
    saps_case_number         TEXT,
    final_repairer           TEXT,
    final_repair_cost        NUMERIC(12,2),
    fine_number              TEXT,
    fine_amount              NUMERIC(12,2),
    violation_code           TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_incidents_vehicle ON incident_reports(vehicle_id);

CREATE TYPE hr_case_status AS ENUM ('Pending', 'Actioned', 'Closed');

CREATE TABLE hr_cases (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    driver_id          UUID NOT NULL REFERENCES profiles(id),
    incident_id        UUID REFERENCES incident_reports(id) ON DELETE SET NULL,
    tire_id            UUID REFERENCES tires(id) ON DELETE SET NULL,
    vehicle_id         UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    damage_reason      TEXT NOT NULL,
    cost_to_recover    NUMERIC(12,2) NOT NULL DEFAULT 0,
    reported_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    status             hr_case_status NOT NULL DEFAULT 'Pending',
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 13: NOTIFICATIONS & MESSAGES
-- ============================================================================

CREATE TYPE notification_type AS ENUM ('JOB_CARD', 'SERVICE', 'INVENTORY', 'PURCHASE');

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    message         TEXT NOT NULL,
    link            JSONB,                       -- {view, params}
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id),
    user_name       TEXT NOT NULL,
    text            TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_vehicle ON messages(vehicle_id, timestamp DESC);

-- ============================================================================
-- PART 14: TIMESTAMP TRIGGERS (auto-update updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t
        );
    END LOOP;
END $$;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- Total tables: 35
-- Next: 02_rls_policies.sql (Row Level Security)
-- Then: 03_storage_setup.sql (Storage buckets)
-- ============================================================================
