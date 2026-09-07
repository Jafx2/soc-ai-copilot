CREATE TABLE IF NOT EXISTS telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incidents(id),
    sequence INTEGER,
    source_ip TEXT,
    event_type TEXT,
    event_data JSONB,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE telemetry_logs DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_telemetry_logs_incident_id ON telemetry_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_event_type ON telemetry_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_timestamp ON telemetry_logs(timestamp DESC);
