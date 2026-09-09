CREATE TABLE IF NOT EXISTS detection_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    severity_override TEXT NOT NULL CHECK (severity_override IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    action_label TEXT NOT NULL DEFAULT 'ALERT_RAISED',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE detection_rules DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_detection_rules_event_type ON detection_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_detection_rules_is_active ON detection_rules(is_active);

INSERT INTO detection_rules (name, description, event_type, severity_override, action_label) VALUES
  ('SQL Injection Detected',    'Triggers on any SQL injection attempt event',    'HTTP_REQUEST',    'CRITICAL', 'BLOCK_AND_ALERT'),
  ('Auth Bypass Detected',      'Triggers when auth bypass event is observed',    'AUTH_BYPASS',     'CRITICAL', 'ISOLATE_SESSION'),
  ('Privilege Escalation',      'Triggers on privilege escalation attempt',       'PRIVILEGE_ESC',   'HIGH',     'ALERT_RAISED'),
  ('Data Staging Detected',     'Triggers when data staging is observed',         'DATA_STAGED',     'HIGH',     'ALERT_RAISED'),
  ('Ransomware Process Spawn',  'Triggers on suspicious process spawn',           'PROCESS_SPAWN',   'CRITICAL', 'KILL_PROCESS'),
  ('Shadow Copy Deletion',      'Triggers on VSS shadow delete command',          'SHADOW_DELETE',   'CRITICAL', 'BLOCK_AND_ALERT'),
  ('C2 Beacon Detected',        'Triggers on command and control beacon',         'C2_BEACON',       'CRITICAL', 'ISOLATE_SESSION');
