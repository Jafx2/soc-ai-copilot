-- =============================================================================
-- SOC AI Copilot — Database Schema
-- Target: Supabase (PostgreSQL 15+)
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fast ILIKE searches on IPs / techniques

-- ---------------------------------------------------------------------------
-- ENUM types — keeps severity and status fields consistent across the app
-- ---------------------------------------------------------------------------
CREATE TYPE severity_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE incident_status AS ENUM ('OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'FALSE_POSITIVE');

-- ---------------------------------------------------------------------------
-- TABLE: incidents
-- One row per simulated (or real) attack event ingested by the platform.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Attack classification
    attack_type      TEXT        NOT NULL,           -- e.g. "SQL_INJECTION", "RANSOMWARE", "DATA_EXFILTRATION"
    mitre_technique  TEXT        NOT NULL,           -- e.g. "T1190", "T1041", "T1486"
    mitre_tactic     TEXT,                           -- e.g. "Initial Access", "Exfiltration", "Impact"
    severity         severity_level NOT NULL DEFAULT 'MEDIUM',

    -- Network origin
    source_ip        INET        NOT NULL,
    source_port      INTEGER     CHECK (source_port BETWEEN 1 AND 65535),
    destination_ip   INET,
    destination_port INTEGER     CHECK (destination_port BETWEEN 1 AND 65535),

    -- Geolocation & reputation (populated by the enrichment service)
    country          TEXT,
    city             TEXT,
    asn              TEXT,                           -- Autonomous System Number
    is_tor           BOOLEAN     NOT NULL DEFAULT FALSE,
    is_vpn           BOOLEAN     NOT NULL DEFAULT FALSE,
    is_proxy         BOOLEAN     NOT NULL DEFAULT FALSE,
    risk_score       SMALLINT    CHECK (risk_score BETWEEN 0 AND 100),

    -- Lifecycle
    status           incident_status NOT NULL DEFAULT 'OPEN',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- TABLE: defense_logs
-- Audit trail of every defensive action taken against an incident,
-- including the raw telemetry log and the AI-generated analysis.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS defense_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,

    -- Defensive action metadata
    action_taken    TEXT        NOT NULL,            -- e.g. "IP_BLOCKED", "PROCESS_TERMINATED", "SESSION_KILLED"
    action_detail   TEXT,                            -- e.g. "PID 4412 terminated on host WKSTN-07"
    automated       BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Raw telemetry
    raw_log         JSONB       NOT NULL DEFAULT '{}',  -- structured log payload from the backend

    -- AI analysis
    ai_summary      TEXT,                           -- LLM-generated explanation in natural language
    ai_mitre_map    TEXT,                           -- Full ATT&CK mapping string from AI
    ai_model_used   TEXT,                           -- e.g. "llama3-70b-8192", "gpt-4o-mini"

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- TABLE: blocked_ips
-- Simulated firewall blocklist — the platform writes here when it "blocks"
-- an IP, and the frontend reads from here to show the active block list.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blocked_ips (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address  INET        NOT NULL UNIQUE,
    reason      TEXT        NOT NULL,
    incident_id UUID        REFERENCES incidents(id) ON DELETE SET NULL,
    blocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,                        -- NULL = permanent block
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------------
-- Indexes — tuned for the most common dashboard queries
-- ---------------------------------------------------------------------------

-- incidents — list view filters
CREATE INDEX idx_incidents_created_at    ON incidents (created_at DESC);
CREATE INDEX idx_incidents_severity      ON incidents (severity);
CREATE INDEX idx_incidents_status        ON incidents (status);
CREATE INDEX idx_incidents_source_ip     ON incidents USING GIST (source_ip inet_ops);
CREATE INDEX idx_incidents_mitre         ON incidents (mitre_technique);

-- defense_logs — timeline joins
CREATE INDEX idx_defense_logs_incident   ON defense_logs (incident_id, created_at DESC);

-- blocked_ips — fast existence checks
CREATE INDEX idx_blocked_ips_address     ON blocked_ips USING GIST (ip_address inet_ops);
CREATE INDEX idx_blocked_ips_active      ON blocked_ips (is_active, blocked_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers — keep updated_at fresh automatically
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security (RLS) — Supabase best practice
-- Anon key can only SELECT; service_role key can do everything.
-- ---------------------------------------------------------------------------
ALTER TABLE incidents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE defense_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips  ENABLE ROW LEVEL SECURITY;

-- Read-only for the anon/public role (dashboard viewers)
CREATE POLICY "anon_read_incidents"
    ON incidents FOR SELECT USING (true);

CREATE POLICY "anon_read_defense_logs"
    ON defense_logs FOR SELECT USING (true);

CREATE POLICY "anon_read_blocked_ips"
    ON blocked_ips FOR SELECT USING (true);

-- Full access for the service_role (backend API)
CREATE POLICY "service_full_incidents"
    ON incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_defense_logs"
    ON defense_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_blocked_ips"
    ON blocked_ips FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Seed data — a handful of example incidents for the demo dashboard
-- ---------------------------------------------------------------------------
INSERT INTO incidents (attack_type, mitre_technique, mitre_tactic, severity, source_ip, country, risk_score, is_tor, status)
VALUES
  ('SQL_INJECTION',      'T1190', 'Initial Access',  'HIGH',     '185.220.101.47', 'Germany',        95, TRUE,  'MITIGATED'),
  ('DATA_EXFILTRATION',  'T1041', 'Exfiltration',    'CRITICAL', '193.32.162.12',  'Russia',         88, FALSE, 'OPEN'),
  ('RANSOMWARE',         'T1486', 'Impact',           'CRITICAL', '45.142.212.100', 'Netherlands',    91, TRUE,  'INVESTIGATING');
