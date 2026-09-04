# SOC AI Copilot

A full-stack Security Operations Center dashboard for SecOps analysts. Simulates real-world cyberattack vectors in real time via WebSockets, processes live telemetry, and runs automated incident triage powered by a bring-your-own-key AI engine.

---

## Overview

SOC AI Copilot is a threat simulation dashboard built for demonstration, education, and portfolio purposes. It replicates the core workflow of a real SOC: an attack is injected, telemetry flows through detection nodes, defensive actions fire automatically, and an AI analyst produces a structured triage report.

The project is fully deployed: the frontend runs on Vercel and the backend runs on Render.

---

## Architecture

```
Frontend (Next.js / Vercel)
    |
    |-- REST (POST /api/simulate, POST /api/analyze)
    |-- WebSocket (/ws/telemetry)
    |
Backend (FastAPI / Render)
    |
    |-- Supabase (PostgreSQL)
         |-- incidents
         |-- defense_logs
         |-- blocked_ips
```

---

## Tech Stack

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Lucide React (icons)

**Backend**
- FastAPI
- Uvicorn (ASGI server)
- httpx (async HTTP for AI provider proxy)
- python-dotenv
- Supabase Python client

**Infrastructure**
- Vercel (frontend hosting)
- Render (backend hosting, free tier)
- Supabase (managed PostgreSQL)

---

## Features

### Attack Simulation Engine
Three MITRE ATT&CK-aligned attack vectors, each with a realistic sequence of log events streamed over WebSocket:

| Vector | Technique | Tactic | Severity |
|---|---|---|---|
| Exploit: Public Application | T1190 | Initial Access | HIGH |
| Exfil: C2 Channel Transfer | T1041 | Exfiltration | CRITICAL |
| Impact: Ransomware Payload | T1486 | Impact | CRITICAL |

### Live Event Stream
- Real-time telemetry feed with columnar log format (TIME, LEVEL, TYPE, SOURCE, DETAIL)
- Table structure and synthetic initialization logs visible on load, before any simulation runs
- Color-coded event types: ALERT, INFO, ACTION, SYS
- Auto-scroll to latest event

### Incident Context Panel
- Source IP geolocation (country, city, ASN)
- Threat flags: TOR exit node, VPN, proxy detection
- Risk score bar (0-100) with color thresholds
- MITRE technique and tactic mapping

### Automated Incident Triage (AI)
- Bring-your-own-key (BYOK) model: the user supplies their own API key, which is forwarded directly to the provider and never stored server-side
- Supported providers: Groq (Llama-3-70B), OpenAI (GPT-4o-mini), DeepSeek (Chat), Google (Gemini 2.0)
- Triage output: analyst summary, MITRE classification, confidence score, automated response action

### Supabase Persistence
- Every simulated incident is written to the `incidents` table
- Defense actions and AI triage results are stored in `defense_logs`
- Blocked IPs are upserted into `blocked_ips`

### UI Details
- GitHub Dark / Datadog-inspired design system
- Palette: `#0d1117` canvas, `#161b22` panels, `#30363d` borders
- Live SVG sparkline on Events/sec metric (updates every 800ms)
- Animated status indicator with pulse on both active and idle states
- Vector cards with vertical layout to prevent badge/label collision
- Smooth CORS-to-triage pipeline: preflight handled, credentials disabled for wildcard origin

---

## Project Structure

```
soc-ai-copilot/
├── frontend/
│   └── src/
│       └── app/
│           └── page.tsx        # Main dashboard (all UI components)
│           └── types/          # Shared TypeScript types
├── backend/
│   └── main.py                 # FastAPI app, simulation engine, WebSocket, AI proxy
│   └── requirements.txt
└── README.md
```

---

## Environment Variables

**Backend (Render)**

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (no trailing slash) |
| `SUPABASE_SERVICE_KEY` | Supabase `service_role` key (not the `anon` key) |

**Frontend (Vercel)**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Full URL of your Render backend, e.g. `https://soc-ai-copilot.onrender.com` |

---

## Local Development

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Create a `.env` file in `/backend`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Create a `.env.local` file in `/frontend`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Deployment

**Backend on Render**
- Service type: Web Service
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as environment variables
- CORS is configured with `allow_origins=["*"]` and `allow_credentials=False`

**Frontend on Vercel**
- Connect the repo, set root directory to `frontend`
- Add `NEXT_PUBLIC_API_URL` pointing to your Render service URL

---

## Database Schema

Run the following in the Supabase SQL Editor:

```sql
CREATE TABLE incidents (
    id UUID PRIMARY KEY,
    attack_type TEXT NOT NULL,
    mitre_technique TEXT,
    mitre_tactic TEXT,
    severity TEXT,
    source_ip TEXT,
    country TEXT,
    city TEXT,
    asn TEXT,
    is_tor BOOLEAN DEFAULT FALSE,
    is_vpn BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    risk_score INTEGER,
    status TEXT DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE defense_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES incidents(id),
    action_taken TEXT,
    action_detail TEXT,
    raw_log JSONB,
    ai_summary TEXT,
    ai_mitre_map TEXT,
    ai_model_used TEXT,
    automated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT UNIQUE,
    reason TEXT,
    incident_id UUID REFERENCES incidents(id),
    is_active BOOLEAN DEFAULT TRUE,
    blocked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE defense_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips DISABLE ROW LEVEL SECURITY;
```

---

## Known Limitations

- Render free tier instances spin down after 15 minutes of inactivity. The first request after a cold start may take 30-60 seconds.
- The AI triage call (`/api/analyze`) requires a valid API key from a supported provider. Without one, the simulation runs but the triage panel stays empty.
- Detection Rules, Threat Intel, and Audit Log tabs are frontend placeholders with no backend implementation.

---

## Author

Angel Jafeth Valle Salgado
Computer Science student, Universidad Metropolitana de Honduras