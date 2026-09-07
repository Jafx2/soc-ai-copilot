"""
SOC AI Copilot ΓÇö FastAPI Backend
=================================
Provides:
  - REST endpoints for incidents, defense logs, and blocked IPs
  - WebSocket endpoint (/ws/telemetry) that streams live attack simulation events
  - Attack simulation engine for 3 MITRE ATT&CK vectors
  - AI analysis proxy (BYOK ΓÇö API key sent via X-AI-Key / X-AI-Provider headers)
  - Supabase persistence layer

Deploy to Render (Free Tier):
  Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import asyncio
import json
import os
from dotenv import load_dotenv
load_dotenv()
import random
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Literal

import httpx
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SOC AI Copilot API",
    description="Real-time threat simulation & AI-powered defensive response engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Supabase client (server-side ΓÇö uses service_role key)
# ---------------------------------------------------------------------------

SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY: str = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

AttackVector = Literal["SQL_INJECTION", "DATA_EXFILTRATION", "RANSOMWARE"]


class SimulateRequest(BaseModel):
    attack_type: AttackVector
    source_ip: str = Field(default_factory=lambda: _random_malicious_ip())


class AnalyzeRequest(BaseModel):
    incident_id: str
    attack_type: AttackVector
    raw_log: dict


class AIAnalysisResult(BaseModel):
    summary: str
    mitre_technique: str
    mitre_tactic: str
    action_taken: str
    action_detail: str
    risk_score: int


# ---------------------------------------------------------------------------
# Attack simulation payloads (MITRE ATT&CK aligned)
# ---------------------------------------------------------------------------

ATTACK_PROFILES: dict[AttackVector, dict] = {
    "SQL_INJECTION": {
        "mitre_technique": "T1190",
        "mitre_tactic": "Initial Access",
        "severity": "HIGH",
        "description": "Exploit Public-Facing Application",
        "log_events": [
            {"event": "HTTP_REQUEST",    "method": "POST", "path": "/api/login",         "payload": "' OR 1=1; DROP TABLE users; --"},
            {"event": "WAF_ALERT",       "rule_id": "SQL-942100",                         "action": "DETECT"},
            {"event": "DB_ERROR",        "code": "42601",  "query_fragment": "OR 1=1",    "rows_affected": 0},
            {"event": "AUTH_BYPASS",     "result": "SUCCESS",                             "user": "admin"},
            {"event": "PRIVILEGE_ESC",   "from": "guest",  "to": "dbo",                  "method": "UNION SELECT"},
            {"event": "DATA_DUMP",       "table": "users",  "rows_exfiltrated": 14_892},
            {"event": "DEFENSE_TRIGGER", "action": "IP_BLOCKED",                          "firewall": "ngfw-01"},
        ],
    },
    "DATA_EXFILTRATION": {
        "mitre_technique": "T1041",
        "mitre_tactic": "Exfiltration",
        "severity": "CRITICAL",
        "description": "Exfiltration Over C2 Channel",
        "log_events": [
            {"event": "DNS_QUERY",       "fqdn": "exfil.attacker.io",              "type": "A",    "ttl": 60},
            {"event": "TLS_HANDSHAKE",   "server_name": "cdn.attacker.io",         "ja3": "769,47-53-5-10-49171-49172-49161-49162-50,65281-0-23-35-13-16,29-23-24,0"},
            {"event": "DATA_STAGED",     "path": "/tmp/.hidden_archive.tar.gz",    "size_mb": 847},
            {"event": "UPLOAD_START",    "destination": "45.33.32.156:443",        "protocol": "HTTPS"},
            {"event": "BYTES_SENT",      "chunk": 1, "size_mb": 250,              "cumulative_mb": 250},
            {"event": "BYTES_SENT",      "chunk": 2, "size_mb": 250,              "cumulative_mb": 500},
            {"event": "BYTES_SENT",      "chunk": 3, "size_mb": 250,              "cumulative_mb": 750},
            {"event": "DEFENSE_TRIGGER", "action": "SESSION_KILLED",              "interface": "eth0"},
        ],
    },
    "RANSOMWARE": {
        "mitre_technique": "T1486",
        "mitre_tactic": "Impact",
        "severity": "CRITICAL",
        "description": "Data Encrypted for Impact",
        "log_events": [
            {"event": "PROCESS_SPAWN",   "parent": "winword.exe",  "child": "powershell.exe", "pid": 4412, "cmdline": "powershell -EncodedCommand SQBuAHYAbwBrAGUALQBXAGUAYgBSAGUAcQB1AGUAcwB0"},
            {"event": "AMSI_BYPASS",     "technique": "patch_amsi.dll",           "result": "SUCCESS"},
            {"event": "SHADOW_DELETE",   "command": "vssadmin delete shadows /all /quiet"},
            {"event": "FILE_ENCRYPT",    "path": "C:\\Users\\*",  "extension": ".locked", "count": 1_204},
            {"event": "RANSOM_DROP",     "file": "C:\\Users\\Public\\README_DECRYPT.txt"},
            {"event": "C2_BEACON",       "url": "http://onion.ransomhub.onion/beacon", "interval_s": 300},
            {"event": "DEFENSE_TRIGGER", "action": "PROCESS_KILLED",              "pid": 4412, "host": "WKSTN-07"},
        ],
    },
}

# ---------------------------------------------------------------------------
# Defensive actions mapped per vector
# ---------------------------------------------------------------------------

DEFENSE_ACTIONS: dict[AttackVector, dict] = {
    "SQL_INJECTION":    {"action": "IP_BLOCKED",        "detail_tpl": "IP {ip} isolated ΓÇö rule added to NGFW-01 & WAF. Suricata SID:2100498 triggered."},
    "DATA_EXFILTRATION":{"action": "SESSION_KILLED",    "detail_tpl": "Outbound session to 45.33.32.156:443 terminated. Interface eth0 rate-limited. DLP alert raised."},
    "RANSOMWARE":       {"action": "PROCESS_TERMINATED","detail_tpl": "PID 4412 (powershell.exe) killed on WKSTN-07. Host quarantined from VLAN 10. Snapshot initiated."},
}

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

_MALICIOUS_IPS = [
    "185.220.101.47",  # Known Tor exit node
    "193.32.162.12",   # RU AS ΓÇö blacklisted
    "45.142.212.100",  # NL bulletproof hosting
    "194.165.16.76",
    "91.108.4.0",
    "5.188.206.14",
]

_COUNTRIES = {
    "185.220.101.47": ("Germany",      "Frankfurt", "AS58173"),
    "193.32.162.12":  ("Russia",       "Moscow",    "AS49392"),
    "45.142.212.100": ("Netherlands",  "Amsterdam", "AS207713"),
    "194.165.16.76":  ("Iran",         "Tehran",    "AS58224"),
    "91.108.4.0":     ("Russia",       "Moscow",    "AS62014"),
    "5.188.206.14":   ("Seychelles",   "Victoria",  "AS209650"),
}


def _random_malicious_ip() -> str:
    return random.choice(_MALICIOUS_IPS)


def _enrich_ip(ip: str) -> dict:
    country, city, asn = _COUNTRIES.get(ip, ("Unknown", "Unknown", "AS0"))
    return {
        "country": country,
        "city": city,
        "asn": asn,
        "is_tor": ip in {"185.220.101.47", "45.142.212.100"},
        "is_vpn": ip in {"194.165.16.76"},
        "is_proxy": False,
        "risk_score": random.randint(78, 98),
    }


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, payload: dict):
        data = json.dumps(payload)
        for ws in list(self.active):
            try:
                await ws.send_text(data)
            except Exception:
                self.active.remove(ws)


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Attack simulation streaming generator
# ---------------------------------------------------------------------------

async def _stream_attack(
    attack_type: AttackVector,
    source_ip: str,
    incident_id: str,
) -> AsyncGenerator[dict, None]:
    """Yields one telemetry event at a time with realistic inter-event delays."""
    profile = ATTACK_PROFILES[attack_type]
    geo = _enrich_ip(source_ip)

    # Phase 1 ΓÇö preamble / scan
    yield {
        "type": "INCIDENT_OPEN",
        "incident_id": incident_id,
        "attack_type": attack_type,
        "mitre_technique": profile["mitre_technique"],
        "mitre_tactic": profile["mitre_tactic"],
        "severity": profile["severity"],
        "source_ip": source_ip,
        **geo,
        "timestamp": _utc_now(),
    }
    await asyncio.sleep(0.6)

    # Phase 2 ΓÇö individual log events
    for i, event in enumerate(profile["log_events"]):
        try:
            supabase.table("telemetry_logs").insert({
                "incident_id": incident_id,
                "sequence": i + 1,
                "source_ip": source_ip,
                "event_type": str(event.get("event", "UNKNOWN")),
                "event_data": event,
                "timestamp": _utc_now(),
            }).execute()
        except Exception:
            pass
        yield {
            "type": "LOG_EVENT",
            "incident_id": incident_id,
            "sequence": i + 1,
            "source_ip": source_ip,
            "data": event,
            "timestamp": _utc_now(),
        }
        await asyncio.sleep(random.uniform(0.4, 1.1))

    # Phase 3 ΓÇö defensive action summary
    defense = DEFENSE_ACTIONS[attack_type]
    yield {
        "type": "DEFENSE_ACTION",
        "incident_id": incident_id,
        "action": defense["action"],
        "detail": defense["detail_tpl"].format(ip=source_ip),
        "automated": True,
        "timestamp": _utc_now(),
    }
    await asyncio.sleep(0.3)

    yield {"type": "SIMULATION_COMPLETE", "incident_id": incident_id, "timestamp": _utc_now()}


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": _utc_now()}


@app.get("/api/incidents")
async def list_incidents(limit: int = 50, status: str | None = None):
    query = supabase.table("incidents").select("*").order("created_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status.upper())
    result = query.execute()
    return result.data


@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    result = supabase.table("incidents").select("*, defense_logs(*)").eq("id", incident_id).single().execute()
    if not result.data:
        raise HTTPException(404, "Incident not found")
    return result.data


@app.get("/api/blocked-ips")
async def list_blocked_ips():
    result = supabase.table("blocked_ips").select("*").eq("is_active", True).order("blocked_at", desc=True).execute()
    return result.data


@app.get("/api/telemetry/logs")
async def list_telemetry_logs(
    limit: int = 100,
    event_type: str | None = None,
    incident_id: str | None = None,
):
    query = (
        supabase.table("telemetry_logs")
        .select("*")
        .order("timestamp", desc=True)
        .limit(limit)
    )
    if event_type:
        query = query.eq("event_type", event_type)
    if incident_id:
        query = query.eq("incident_id", incident_id)
    result = query.execute()
    return result.data


@app.post("/api/simulate")
async def trigger_simulation(body: SimulateRequest):
    """
    Persists a new incident and returns its ID.
    The WebSocket endpoint (/ws/telemetry) streams the live events.
    """
    profile = ATTACK_PROFILES[body.attack_type]
    geo = _enrich_ip(body.source_ip)
    incident_id = str(uuid.uuid4())

    # Persist incident
    supabase.table("incidents").insert({
        "id": incident_id,
        "attack_type": body.attack_type,
        "mitre_technique": profile["mitre_technique"],
        "mitre_tactic": profile["mitre_tactic"],
        "severity": profile["severity"],
        "source_ip": body.source_ip,
        "status": "OPEN",
        **geo,
    }).execute()

    return {"incident_id": incident_id, "source_ip": body.source_ip}


@app.post("/api/analyze")
async def analyze_with_ai(
    body: AnalyzeRequest,
    x_ai_key: str = Header(..., alias="X-AI-Key"),
    x_ai_provider: str = Header(default="groq", alias="X-AI-Provider"),
):
    """
    BYOK proxy ΓÇö the client sends its own AI API key in the header.
    Supports: groq (default), openai, deepseek.
    """
    profile = ATTACK_PROFILES[body.attack_type]
    defense = DEFENSE_ACTIONS[body.attack_type]

    system_prompt = (
        "You are a Senior SOC Analyst and Threat Intelligence expert. "
        "Respond ONLY with a JSON object ΓÇö no markdown, no code fences. "
        "Schema: {summary, mitre_technique, mitre_tactic, action_taken, action_detail, risk_score}"
    )
    user_prompt = (
        f"Analyze this security incident:\n"
        f"Attack Type: {body.attack_type}\n"
        f"Raw Telemetry: {json.dumps(body.raw_log, indent=2)}\n\n"
        f"Return a JSON with:\n"
        f"- summary: 2-3 sentence analyst explanation in plain English\n"
        f"- mitre_technique: ATT&CK technique ID (e.g. {profile['mitre_technique']})\n"
        f"- mitre_tactic: ATT&CK tactic name\n"
        f"- action_taken: one of IP_BLOCKED | SESSION_KILLED | PROCESS_TERMINATED\n"
        f"- action_detail: one sentence describing the automated defensive action\n"
        f"- risk_score: integer 0-100"
    )

    provider_config = {
        "groq":     {"url": "https://api.groq.com/openai/v1/chat/completions",   "model": "llama3-70b-8192"},
        "openai":   {"url": "https://api.openai.com/v1/chat/completions",         "model": "gpt-4o-mini"},
        "deepseek": {"url": "https://api.deepseek.com/v1/chat/completions",       "model": "deepseek-chat"},
    }
    config = provider_config.get(x_ai_provider.lower(), provider_config["groq"])

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            config["url"],
            headers={"Authorization": f"Bearer {x_ai_key}", "Content-Type": "application/json"},
            json={
                "model": config["model"],
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 600,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"AI provider error: {resp.text}")

    raw_content: str = resp.json()["choices"][0]["message"]["content"]

    try:
        analysis: dict = json.loads(raw_content)
    except json.JSONDecodeError:
        # Fallback ΓÇö return the raw text wrapped
        analysis = {
            "summary":         raw_content,
            "mitre_technique": profile["mitre_technique"],
            "mitre_tactic":    profile["mitre_tactic"],
            "action_taken":    defense["action"],
            "action_detail":   defense["detail_tpl"].format(ip="<source_ip>"),
            "risk_score":      75,
        }

    # Persist to defense_logs
    supabase.table("defense_logs").insert({
        "incident_id":   body.incident_id,
        "action_taken":  analysis.get("action_taken", defense["action"]),
        "action_detail": analysis.get("action_detail", ""),
        "raw_log":       body.raw_log,
        "ai_summary":    analysis.get("summary", ""),
        "ai_mitre_map":  f"{analysis.get('mitre_technique')} ΓÇö {analysis.get('mitre_tactic')}",
        "ai_model_used": config["model"],
        "automated":     True,
    }).execute()

    # Update incident status
    supabase.table("incidents").update({"status": "MITIGATED"}).eq("id", body.incident_id).execute()

    # Add to blocked IPs if applicable
    if analysis.get("action_taken") == "IP_BLOCKED":
        supabase.table("blocked_ips").upsert({
            "ip_address": body.raw_log.get("source_ip", "0.0.0.0"),
            "reason":     f"{body.attack_type} ΓÇö {analysis.get('mitre_technique')}",
            "incident_id": body.incident_id,
        }, on_conflict="ip_address").execute()

    return AIAnalysisResult(**analysis)


# ---------------------------------------------------------------------------
# WebSocket ΓÇö live telemetry stream
# ---------------------------------------------------------------------------

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Wait for the client to send a simulation trigger
            raw = await websocket.receive_text()
            payload: dict = json.loads(raw)

            attack_type: AttackVector = payload.get("attack_type", "SQL_INJECTION")
            source_ip: str = payload.get("source_ip", _random_malicious_ip())
            incident_id: str = payload.get("incident_id", str(uuid.uuid4()))

            # Stream events back to THIS client only
            async for event in _stream_attack(attack_type, source_ip, incident_id):
                await websocket.send_text(json.dumps(event))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        await websocket.send_text(json.dumps({"type": "ERROR", "message": str(exc)}))
        manager.disconnect(websocket)
