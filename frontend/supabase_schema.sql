-- ============================================================================
-- TABLE 1: CARRIERS (Census schema — Company Census File az4n-8mr2)
-- ~4.5M records from data.transportation.gov
-- All text columns are CHARACTER VARYING (Census default)
-- JSONB columns: dockets, cargo, insurance, equipment
-- ============================================================================
CREATE TABLE IF NOT EXISTS carriers (
    id BIGSERIAL PRIMARY KEY,
    dot_number CHARACTER VARYING,
    legal_name CHARACTER VARYING,
    dba_name CHARACTER VARYING,
    carrier_operation CHARACTER VARYING,    -- A=Interstate, B=Intrastate HM, C=Intrastate Non-HM
    hm_ind CHARACTER VARYING,              -- Y/N hazmat indicator
    pc_ind CHARACTER VARYING,              -- Passenger carrier indicator
    status_code CHARACTER VARYING,         -- A=Active
    phy_street CHARACTER VARYING,
    phy_city CHARACTER VARYING,
    phy_state CHARACTER VARYING,
    phy_zip CHARACTER VARYING,
    phy_country CHARACTER VARYING,
    mailing_street CHARACTER VARYING,
    mailing_city CHARACTER VARYING,
    mailing_state CHARACTER VARYING,
    mailing_zip CHARACTER VARYING,
    mailing_country CHARACTER VARYING,
    telephone CHARACTER VARYING,           -- May have ".0" suffix
    email_address CHARACTER VARYING,
    mcs150_date CHARACTER VARYING,
    mcs150_mileage CHARACTER VARYING,
    mcs150_mileage_year CHARACTER VARYING,
    add_date CHARACTER VARYING,            -- YYYYMMDD format
    oic_state CHARACTER VARYING,
    nbr_power_unit CHARACTER VARYING,
    total_drivers CHARACTER VARYING,
    total_cdl CHARACTER VARYING,
    truck_units CHARACTER VARYING,
    classdef CHARACTER VARYING,            -- Semicolon-separated (e.g., "AUTHORIZED FOR HIRE;EXEMPT FOR HIRE")
    dun_bradstreet_no CHARACTER VARYING,   -- DUNS number
    company_officer_1 CHARACTER VARYING,   -- Company representative
    dockets JSONB,                         -- Array of docket strings (e.g., ["MC143680", "FF12345"])
    cargo JSONB,                           -- Object with cargo keys (e.g., {"General Freight": "X"})
    insurance JSONB,                       -- Array of insurance filing objects
    equipment JSONB,                       -- Equipment details
    temp BIGINT,                           -- Numeric MC number extracted from dockets (e.g., 143680)
    -- Enrichment columns (from scraper, not Census)
    safety_rating CHARACTER VARYING,
    safety_rating_date CHARACTER VARYING,
    basic_scores JSONB,
    oos_rates JSONB,
    inspections JSONB,
    crashes JSONB,
    insurance_policies JSONB,              -- Scraped insurance (separate from Census insurance JSONB)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES: Optimized for 4.5M records
-- B-tree indexes for exact-match and range queries
-- GIN indexes for JSONB containment queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_carriers_dot_number ON carriers(dot_number);
CREATE INDEX IF NOT EXISTS idx_carriers_temp ON carriers(temp);                -- MC number lookup
CREATE INDEX IF NOT EXISTS idx_carriers_status_code ON carriers(status_code);  -- Active filter
CREATE INDEX IF NOT EXISTS idx_carriers_phy_state ON carriers(phy_state);      -- State filter
CREATE INDEX IF NOT EXISTS idx_carriers_carrier_operation ON carriers(carrier_operation);
CREATE INDEX IF NOT EXISTS idx_carriers_hm_ind ON carriers(hm_ind);            -- Hazmat filter
CREATE INDEX IF NOT EXISTS idx_carriers_legal_name ON carriers(legal_name);    -- Name search
CREATE INDEX IF NOT EXISTS idx_carriers_email ON carriers(email_address);
CREATE INDEX IF NOT EXISTS idx_carriers_duns ON carriers(dun_bradstreet_no);
CREATE INDEX IF NOT EXISTS idx_carriers_add_date ON carriers(add_date);        -- Years in business

-- GIN indexes for JSONB array/object containment
CREATE INDEX IF NOT EXISTS idx_carriers_dockets_gin ON carriers USING GIN (dockets);
CREATE INDEX IF NOT EXISTS idx_carriers_cargo_gin ON carriers USING GIN (cargo);
CREATE INDEX IF NOT EXISTS idx_carriers_insurance_gin ON carriers USING GIN (insurance);

-- Partial index for active carriers (most common query)
CREATE INDEX IF NOT EXISTS idx_carriers_active ON carriers(status_code) WHERE status_code = 'A';

-- Enable RLS for carriers
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carriers table
DROP POLICY IF EXISTS "Enable read access for anonymous users" ON carriers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON carriers;

CREATE POLICY "Enable read access for anonymous users" ON carriers
    FOR SELECT
    USING (true);

CREATE POLICY "Enable all access for authenticated users" ON carriers
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABLE 2: FMCSA_REGISTER (MISSING IN ORIGINAL SCHEMA - NOW ADDED)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fmcsa_register (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    decided TEXT,
    category TEXT,
    date_fetched TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(number, date_fetched)
);

-- Create indexes for fmcsa_register table
CREATE INDEX IF NOT EXISTS idx_fmcsa_register_number ON fmcsa_register(number);
CREATE INDEX IF NOT EXISTS idx_fmcsa_register_date_fetched ON fmcsa_register(date_fetched DESC);
CREATE INDEX IF NOT EXISTS idx_fmcsa_register_category ON fmcsa_register(category);

-- Enable RLS for fmcsa_register
ALTER TABLE fmcsa_register ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fmcsa_register table
DROP POLICY IF EXISTS "Enable read access for anonymous users" ON fmcsa_register;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fmcsa_register;

CREATE POLICY "Enable read access for anonymous users" ON fmcsa_register
    FOR SELECT
    USING (true);

CREATE POLICY "Enable all access for authenticated users" ON fmcsa_register
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABLE 3: USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    plan TEXT NOT NULL DEFAULT 'Free' CHECK (plan IN ('Free', 'Starter', 'Pro', 'Enterprise')),
    daily_limit INTEGER NOT NULL DEFAULT 50,
    records_extracted_today INTEGER NOT NULL DEFAULT 0,
    last_active TEXT DEFAULT 'Never',
    ip_address TEXT,
    is_online BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Enable RLS for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
DROP POLICY IF EXISTS "Enable read access for anonymous users" ON users;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON users;

CREATE POLICY "Enable read access for anonymous users" ON users
    FOR SELECT
    USING (true);

CREATE POLICY "Enable all access for authenticated users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABLE 4: BLOCKED_IPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_by TEXT
);

-- Create indexes for blocked_ips table
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);

-- Enable RLS for blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocked_ips table
DROP POLICY IF EXISTS "Enable all access for blocked_ips" ON blocked_ips;
DROP POLICY IF EXISTS "Enable read access for blocked_ips" ON blocked_ips;

CREATE POLICY "Enable all access for blocked_ips" ON blocked_ips
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable read access for blocked_ips" ON blocked_ips
    FOR SELECT
    USING (true);

-- ============================================================================
-- TRIGGER FUNCTIONS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================

-- Function for carriers table
CREATE OR REPLACE FUNCTION update_carriers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for carriers table
DROP TRIGGER IF EXISTS update_carriers_updated_at ON carriers;
CREATE TRIGGER update_carriers_updated_at BEFORE UPDATE ON carriers
    FOR EACH ROW EXECUTE FUNCTION update_carriers_updated_at();

-- Function for fmcsa_register table
CREATE OR REPLACE FUNCTION update_fmcsa_register_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for fmcsa_register table
DROP TRIGGER IF EXISTS update_fmcsa_register_updated_at ON fmcsa_register;
CREATE TRIGGER update_fmcsa_register_updated_at BEFORE UPDATE ON fmcsa_register
    FOR EACH ROW EXECUTE FUNCTION update_fmcsa_register_updated_at();

-- Function for users table
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default admin user (only if not exists)
INSERT INTO users (user_id, name, email, role, plan, daily_limit, records_extracted_today, ip_address, is_online, is_blocked)
VALUES ('1', 'Admin User', 'wooohan3@gmail.com', 'admin', 'Enterprise', 100000, 0, '192.168.1.1', false, false)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE carriers IS 'FMCSA Census data (Company Census File az4n-8mr2) — ~4.5M records';
COMMENT ON COLUMN carriers.dot_number IS 'USDOT Number';
COMMENT ON COLUMN carriers.temp IS 'Numeric MC number extracted from dockets JSONB (e.g., 143680 for MC143680)';
COMMENT ON COLUMN carriers.dockets IS 'JSONB array of docket strings like ["MC143680", "FF12345"]';
COMMENT ON COLUMN carriers.cargo IS 'JSONB object with cargo type keys and "X" values, e.g., {"General Freight": "X"}';
COMMENT ON COLUMN carriers.insurance IS 'JSONB array of insurance filing objects from Census data';
COMMENT ON COLUMN carriers.classdef IS 'Semicolon-separated operation classifications, e.g., "AUTHORIZED FOR HIRE;EXEMPT FOR HIRE"';
COMMENT ON COLUMN carriers.carrier_operation IS 'Single char: A=Interstate, B=Intrastate HM, C=Intrastate Non-HM';
COMMENT ON COLUMN carriers.status_code IS 'A=Active, N=Not Active';
COMMENT ON COLUMN carriers.add_date IS 'Date added in YYYYMMDD format — used for years in business calculation';
COMMENT ON COLUMN carriers.hm_ind IS 'Hazmat indicator: Y or N';

COMMENT ON TABLE fmcsa_register IS 'FMCSA Daily Register entries with motor carrier decisions and notices';
COMMENT ON COLUMN fmcsa_register.number IS 'Docket number (e.g., MC-123456)';
COMMENT ON COLUMN fmcsa_register.title IS 'Entry title or description';
COMMENT ON COLUMN fmcsa_register.decided IS 'Date decided (MM/DD/YYYY format)';
COMMENT ON COLUMN fmcsa_register.category IS 'Category of decision (NAME CHANGE, REVOCATION, etc.)';
COMMENT ON COLUMN fmcsa_register.date_fetched IS 'Date when this entry was scraped';

COMMENT ON TABLE users IS 'User accounts for FreightIntel AI application';
COMMENT ON TABLE blocked_ips IS 'Blocked IP addresses for security';
COMMENT ON COLUMN users.user_id IS 'Application-level unique user ID';
COMMENT ON COLUMN users.role IS 'User role: user or admin';
COMMENT ON COLUMN users.plan IS 'Subscription plan: Free, Starter, Pro, Enterprise';
COMMENT ON COLUMN users.daily_limit IS 'Maximum MC records allowed per day';
COMMENT ON COLUMN users.is_blocked IS 'Whether the user is blocked from accessing the system';
