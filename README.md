# 🛡️ SOC AI Copilot — Interactive Threat Simulation Dashboard

> A real-time Blue Team portfolio project demonstrating SOC analyst workflows,
> MITRE ATT&CK-aligned threat simulation, and AI-powered defensive response.

![Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Stack](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Stack](https://img.shields.io/badge/MITRE_ATT%26CK-v15-red)
![Stack](https://img.shields.io/badge/Deploy-Vercel_%2B_Render-000?logo=vercel)

---

## 🎯 What This Project Demonstrates

| Skill | How |
|---|---|
| **Threat Simulation** | 3 MITRE ATT&CK-aligned attack vectors (T1190, T1041, T1486) |
| **Real-Time Telemetry** | WebSocket stream of structured JSON/Syslog events |
| **Threat Intelligence** | IP geolocation, TOR/VPN/Proxy detection, risk scoring |
| **AI Security Analysis** | BYOK LLM integration (Groq / OpenAI / DeepSeek) |
| **Automated Response** | Simulated IP block, process kill, session termination |
| **Data Persistence** | Structured incident & defense log schema in PostgreSQL |
| **Secure Design** | RLS policies, service-role auth, no key storage server-side |

---

## 🏗️ Architecture

```
┌─────────────────┐   WebSocket + REST   ┌──────────────────────┐
│  Next.js 14     │ ◄──────────────────► │  FastAPI + Uvicorn   │
│  (Vercel)       │                      │  (Render Free Tier)  │
│                 │   X-AI-Key header    │          │           │
│  BYOK Modal     │ ──────────────────►  │   BYOK AI Proxy      │
│  localStorage   │                      │          │           │
└─────────────────┘                      └──────────┼───────────┘
                                                    │ service_role
                                         ┌──────────▼───────────┐
                                         │  Supabase PostgreSQL  │
                                         │  incidents            │
                                         │  defense_logs         │
                                         │  blocked_ips          │
                                         └──────────────────────┘
```

---

## 📁 Repository Structure

```
soc-ai-copilot/
├── backend/
│   ├── main.py               # FastAPI app — WebSocket, simulation, AI proxy
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx      # Dashboard root — state + layout
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── attack/
│   │   │   │   └── AttackPanel.tsx      # Threat injector (3 vectors)
│   │   │   ├── telemetry/
│   │   │   │   └── TelemetryFeed.tsx    # Live WebSocket console
│   │   │   ├── dashboard/
│   │   │   │   └── ThreatIntelPanel.tsx # IP geo + threat flags
│   │   │   └── ai/
│   │   │       ├── APIKeyModal.tsx      # BYOK key manager
│   │   │       └── CopilotPanel.tsx    # AI analysis + defense actions
│   │   ├── lib/
│   │   │   └── api.ts        # HTTP client, WS factory, localStorage helpers
│   │   └── types/
│   │       └── index.ts      # Shared TypeScript types
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── .env.local.example
│
├── database/
│   └── schema.sql            # Full Supabase schema with RLS + seed data
│
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### 1. Database — Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**
3. Paste and run `database/schema.sql`
4. Copy your **Project URL** and **service_role** key from Settings → API

### 2. Backend — Local

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your Supabase credentials

uvicorn main:app --reload
# → http://localhost:8000
```

### 3. Frontend — Local

```bash
cd frontend
npm install

cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

---

## ☁️ Free Tier Deployment

### Backend → Render

1. Connect your GitHub repo to [render.com](https://render.com)
2. **New Web Service** → select the `backend/` folder
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_API_URL to your Render URL in Vercel dashboard
```

---

## 🤖 BYOK AI Providers

| Provider | Model | Free Tier |
|---|---|---|
| **Groq** | `llama3-70b-8192` | ✅ Generous free tier |
| **OpenAI** | `gpt-4o-mini` | 💳 ~$0.01 per analysis |
| **DeepSeek** | `deepseek-chat` | ✅ Very affordable |

Get your key → click **"Add API Key"** in the dashboard → analysis runs client-side proxied.

---

## 🎯 Simulated Attack Vectors

| Vector | MITRE Technique | Tactic | Severity |
|---|---|---|---|
| SQL Injection | T1190 | Initial Access | HIGH |
| Data Exfiltration | T1041 | Exfiltration | CRITICAL |
| Ransomware Execution | T1486 | Impact | CRITICAL |

---

## 🔐 Security Design Decisions

- **BYOK**: AI API keys are stored only in `localStorage` and transmitted via `X-AI-Key` header — never persisted server-side.
- **RLS**: Supabase Row Level Security restricts writes to `service_role` key only; public dashboard is read-only.
- **Simulation isolation**: All attack payloads are synthetic in-memory objects — no real network traffic is generated.

---

## 📄 License

MIT — use freely for portfolio, learning, and interviews.
