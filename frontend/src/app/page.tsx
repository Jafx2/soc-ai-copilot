"use client";

/**
 * SOC AI Copilot — Enterprise Dashboard
 * Design: GitHub Dark / Datadog / CrowdStrike Falcon aesthetic
 * High data density, functional color system, zero decorative noise
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ChevronDown,
  ExternalLink, Eye, EyeOff,
  FileText, Filter, Key, Layers, Lock, RefreshCw,
  Settings, Shield, Terminal, Trash2, X, Zap
} from "lucide-react";
import type {
  AIAnalysis, AIKeyConfig, AttackVector,
  WsEvent, WsIncidentOpen, WsLogEvent, WsDefenseAction
} from "@/types";
import TelemetryMetrics from "@/components/TelemetryMetrics";
import ReportModal from "@/components/ReportModal";
import { generateReport } from "@/lib/generateReport";

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = BASE_URL.replace(/^http/, "ws");
const LS_KEY = "soc_ai_key_config";

type AIProviderKey = "groq" | "openai" | "deepseek" | "gemini";

const AI_PROVIDERS: Record<AIProviderKey, { label: string; placeholder: string; docsUrl: string }> = {
  groq: { label: "Groq / Llama-3-70B", placeholder: "gsk_...", docsUrl: "https://console.groq.com/keys" },
  openai: { label: "OpenAI / GPT-4o-mini", placeholder: "sk-...", docsUrl: "https://platform.openai.com/api-keys" },
  deepseek: { label: "DeepSeek / Chat", placeholder: "sk-...", docsUrl: "https://platform.deepseek.com" },
  gemini: { label: "Google / Gemini 2.0", placeholder: "AIza...", docsUrl: "https://aistudio.google.com/app/apikey" },
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
function saveKey(c: AIKeyConfig) { localStorage.setItem(LS_KEY, JSON.stringify(c)); }
function loadKey(): AIKeyConfig | null { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function clearKey() { localStorage.removeItem(LS_KEY); }

// ─── Attack vectors ───────────────────────────────────────────────────────────
const VECTORS = [
  { id: "SQL_INJECTION" as AttackVector, label: "Exploit: Public Application", technique: "T1190", tactic: "Initial Access", severity: "HIGH" as const },
  { id: "DATA_EXFILTRATION" as AttackVector, label: "Exfil: C2 Channel Transfer", technique: "T1041", tactic: "Exfiltration", severity: "CRITICAL" as const },
  { id: "RANSOMWARE" as AttackVector, label: "Impact: Ransomware Payload", technique: "T1486", tactic: "Impact", severity: "CRITICAL" as const },
];

// ─── Severity tokens ──────────────────────────────────────────────────────────
const SEV: Record<string, { dot: string; badge: string; label: string }> = {
  CRITICAL: { dot: "bg-[#da3633]", badge: "text-[#da3633] bg-[#da3633]/10 border-[#da3633]/20", label: "CRIT" },
  HIGH: { dot: "bg-[#d29922]", badge: "text-[#d29922] bg-[#d29922]/10 border-[#d29922]/20", label: "HIGH" },
  MEDIUM: { dot: "bg-[#58a6ff]", badge: "text-[#58a6ff] bg-[#58a6ff]/10 border-[#58a6ff]/20", label: "MED" },
  LOW: { dot: "bg-[#3fb950]", badge: "text-[#3fb950] bg-[#3fb950]/10 border-[#3fb950]/20", label: "LOW" },
};

// ─── Synthetic init logs for empty state ─────────────────────────────────────
const INIT_LOGS: { ts: string; level: string; type: string; source: string; detail: string; levelColor: string }[] = [
  { ts: "--:--:--", level: "SYS", type: "BOOT", source: "soc-core", detail: "Detection engine initialized - MITRE ATT&CK v15 loaded", levelColor: "text-[#484f58]" },
  { ts: "--:--:--", level: "SYS", type: "NODE_READY", source: "ngfw-01", detail: "Telemetry node online - awaiting traffic", levelColor: "text-[#484f58]" },
  { ts: "--:--:--", level: "SYS", type: "NODE_READY", source: "waf-proxy", detail: "Telemetry node online - awaiting traffic", levelColor: "text-[#484f58]" },
  { ts: "--:--:--", level: "SYS", type: "NODE_READY", source: "edr-agent", detail: "Telemetry node online - awaiting traffic", levelColor: "text-[#484f58]" },
  { ts: "--:--:--", level: "INFO", type: "STANDBY", source: "siem-core", detail: "Event stream open - inject a vector to begin simulation", levelColor: "text-[#3fb950]" },
];

// ─── Sparkline component ──────────────────────────────────────────────────────
function Sparkline({ width = 56, height = 18 }: { width?: number; height?: number }) {
  const [points, setPoints] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => 0.3 + Math.random() * 0.5)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setPoints(prev => {
        const next = [...prev.slice(1), 0.3 + Math.random() * 0.65];
        return next;
      });
    }, 800);
    return () => clearInterval(id);
  }, []);

  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (points.length - 1);

  const coords = points.map((v, i) => ({
    x: pad + i * step,
    y: pad + (1 - v) * h,
  }));

  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${coords[coords.length - 1].x.toFixed(1)} ${(pad + h).toFixed(1)}` +
    ` L ${coords[0].x.toFixed(1)} ${(pad + h).toFixed(1)} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#238636" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#238636" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <path d={linePath} fill="none" stroke="#3fb950" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" style={{ transition: "d 0.4s ease" }} />
    </svg>
  );
}

// ─── System metrics strip ─────────────────────────────────────────────────────
const SYSTEM_METRICS = [
  { label: "Events/sec", value: "2,847", delta: "+12%", ok: true, sparkline: true },
  { label: "Avg Latency", value: "18ms", delta: "-3ms", ok: true, sparkline: false },
  { label: "Active Rules", value: "1,204", delta: "", ok: true, sparkline: false },
  { label: "Queue Depth", value: "0", delta: "", ok: true, sparkline: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function Page() {
  const [aiConfig, setAIConfig] = useState<AIKeyConfig | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeVector, setActiveVector] = useState<AttackVector | null>(null);
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [incident, setIncident] = useState<WsIncidentOpen | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [reportModal, setReportModal] = useState<{ markdown: string; filename: string } | null>(null);

  const socketRef = useRef<{ close: () => void } | null>(null);
  const rawLogsRef = useRef<Record<string, unknown>[]>([]);
  const incidentRef = useRef<WsIncidentOpen | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setAIConfig(loadKey()); }, []);
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }, [events]);

  const handleEvent = useCallback(async (ev: WsEvent) => {
    setEvents(p => [...p, ev]);
    if (ev.type === "INCIDENT_OPEN") { setIncident(ev as WsIncidentOpen); incidentRef.current = ev as WsIncidentOpen; rawLogsRef.current = []; }
    if (ev.type === "LOG_EVENT") { rawLogsRef.current.push((ev as WsLogEvent).data); }
    if (ev.type === "DEFENSE_ACTION") { rawLogsRef.current.push({ action: (ev as WsDefenseAction).action }); }
    if (ev.type === "SIMULATION_COMPLETE") {
      setIsRunning(false);
      const key = loadKey(); const inc = incidentRef.current;
      if (key && inc) {
        setIsAnalyzing(true);
        try {
          const res = await fetch(`${BASE_URL}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-AI-Key": key.key, "X-AI-Provider": key.provider },
            body: JSON.stringify({ incident_id: inc.incident_id, attack_type: inc.attack_type, raw_log: { source_ip: inc.source_ip, events: rawLogsRef.current } }),
          });
          if (res.ok) setAnalysis(await res.json());
        } finally { setIsAnalyzing(false); }
      }
    }
  }, []);

  const launch = useCallback(async (vector: AttackVector) => {
    setEvents([]); setIncident(null); setAnalysis(null);
    setActiveVector(vector); setIsRunning(true);
    rawLogsRef.current = []; incidentRef.current = null;
    socketRef.current?.close();
    try {
      const r = await fetch(`${BASE_URL}/api/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attack_type: vector }) });
      const { incident_id, source_ip } = await r.json();
      const ws = new WebSocket(`${WS_URL}/ws/telemetry`);
      ws.onmessage = m => { try { handleEvent(JSON.parse(m.data)); } catch { } };
      ws.onclose = () => setIsRunning(false);
      ws.onopen = () => ws.send(JSON.stringify({ attack_type: vector, incident_id, source_ip }));
      socketRef.current = { close: () => ws.close() };
    } catch { setIsRunning(false); }
  }, [handleEvent]);

  useEffect(() => () => socketRef.current?.close(), []);
  const reset = () => { setEvents([]); setIncident(null); setAnalysis(null); setActiveVector(null); setIsRunning(false); };

  const handleExportReport = () => {
    if (!incident) return;
    const markdown = generateReport(incident, events, analysis);
    const filename = `INCIDENT_REPORT_${incident.source_ip.replace(/\./g, "_")}.md`;
    setReportModal({ markdown, filename });
  };

  const incidentCount = events.filter(e => e.type === "INCIDENT_OPEN").length;

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-[#e6edf3] overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Topbar ── */}
      <header className="h-11 flex items-center gap-0 border-b border-[#30363d] bg-[#161b22] shrink-0 px-4">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-4 border-r border-[#30363d] mr-4">
          <Shield className="w-4 h-4 text-[#58a6ff]" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-[#e6edf3] tracking-tight">SOC Copilot</span>
          <span className="text-[10px] text-[#8b949e] bg-[#30363d] px-1.5 py-0.5 rounded font-mono">v1.0</span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0 h-full text-xs">
          <TabItem label="Incident Response" active />
          <TabItem label="Detection Rules" />
          <TabItem label="Threat Intel" />
          <TabItem label="Audit Log" />
        </nav>

        <div className="flex-1" />

        {/* ── FIX 3: System metrics strip with sparkline on Events/sec ── */}
        <div className="hidden lg:flex items-center gap-5 mr-4 pr-4 border-r border-[#30363d]">
          {SYSTEM_METRICS.map(m => (
            <div key={m.label} className="flex items-center gap-2">
              {/* Sparkline sits to the left of the label+value group for Events/sec */}
              {m.sparkline && <Sparkline width={56} height={18} />}
              <div className="flex flex-col items-end leading-none gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-mono font-medium text-[#e6edf3]">{m.value}</span>
                  {m.delta && <span className={`text-[9px] font-mono ${m.ok ? "text-[#3fb950]" : "text-[#da3633]"}`}>{m.delta}</span>}
                </div>
                <span className="text-[9px] text-[#8b949e]">{m.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded border mr-3 transition-all duration-500 ${isRunning ? "border-[#d29922]/30 text-[#d29922] bg-[#d29922]/8" : "border-[#238636]/30 text-[#3fb950] bg-[#238636]/8"}`}>
          <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${isRunning ? "bg-[#d29922] animate-pulse" : "bg-[#3fb950] animate-pulse"}`} />
          {isRunning ? "Simulation running" : "All systems nominal"}
        </div>

        <button onClick={reset} disabled={isRunning} title="Reset session" className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-40 transition-colors mr-2">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button onClick={() => setKeyModalOpen(true)} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border transition-all ${aiConfig ? "border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#8b949e]" : "border-[#388bfd]/40 text-[#58a6ff] bg-[#58a6ff]/8 hover:bg-[#58a6ff]/15"}`}>
          <Key className="w-3 h-3" />
          {aiConfig ? `ML engine: ${aiConfig.provider}` : "Configure ML engine"}
        </button>
      </header>

      {/* ── Main layout ── */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "280px 1fr 320px" }}>

        {/* ── Col 1: Attack injector ── */}
        <aside className="border-r border-[#30363d] bg-[#0d1117] flex flex-col overflow-hidden">
          <SectionHeader icon={<Zap className="w-3.5 h-3.5" />} label="Attack Simulation" count={incidentCount} />

          <div className="flex-1 overflow-y-auto">
            {/* Injector */}
            <div className="p-3 border-b border-[#30363d]">
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2 px-1">Inject Vector</p>
              <div className="space-y-1.5">
                {VECTORS.map(v => {
                  const active = activeVector === v.id && isRunning;
                  const sev = SEV[v.severity];
                  return (
                    // ── FIX 1: Vertical layout prevents badge/title collision ──
                    <button
                      key={v.id}
                      onClick={() => !isRunning && launch(v.id)}
                      disabled={isRunning}
                      className={`w-full text-left rounded px-3 py-2.5 border transition-all ${active
                        ? "border-[#58a6ff]/40 bg-[#58a6ff]/8"
                        : isRunning
                          ? "border-[#30363d] opacity-50 cursor-not-allowed"
                          : "border-[#30363d] bg-[#161b22] hover:border-[#8b949e] hover:bg-[#21262d] cursor-pointer"
                        }`}
                    >
                      {/* Row 1: severity badge + technique — both shrink-0, never overlap */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${sev.badge}`}>
                          {sev.label}
                        </span>
                        <span className="text-[10px] font-mono text-[#58a6ff] shrink-0">{v.technique}</span>
                      </div>
                      {/* Row 2: label on its own line — full width, no collision risk */}
                      <p className="text-[11px] text-[#c9d1d9] font-medium leading-snug">{v.label}</p>
                      {/* Row 3: tactic */}
                      <p className="text-[10px] text-[#8b949e] mt-0.5">{v.tactic}</p>
                      {/* Row 4: progress bar if active */}
                      {active && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className="h-0.5 flex-1 bg-[#30363d] rounded-full overflow-hidden">
                            <div className="h-full bg-[#58a6ff] rounded-full animate-pulse" style={{ width: "60%" }} />
                          </div>
                          <span className="text-[9px] text-[#58a6ff] font-mono shrink-0">RUNNING</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session incidents */}
            <div className="p-3">
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2 px-1">Session Incidents</p>
              {events.filter(e => e.type === "INCIDENT_OPEN").length === 0
                ? <p className="text-[11px] text-[#484f58] px-1 italic">No incidents this session.</p>
                : events.filter(e => e.type === "INCIDENT_OPEN").map((e, i) => {
                  const inc = e as WsIncidentOpen;
                  const sev = SEV[inc.severity] ?? SEV.LOW;
                  return (
                    <div key={i} className="flex items-start gap-2 px-1 py-1.5 rounded hover:bg-[#161b22] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${sev.dot}`} />
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#c9d1d9] font-mono truncate">{inc.source_ip}</p>
                        <p className="text-[10px] text-[#8b949e] truncate">{inc.attack_type.replace(/_/g, " ")} · {inc.country}</p>
                      </div>
                      <span className={`ml-auto text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ${sev.badge}`}>{sev.label}</span>
                    </div>
                  );
                })
              }
            </div>

            {/* Detection nodes */}
            <div className="p-3 border-t border-[#30363d] mt-auto">
              <p className="text-[10px] text-[#8b949e] uppercase tracking-wider font-medium mb-2 px-1">Detection Nodes</p>
              {[["ngfw-01", "online"], ["waf-proxy", "online"], ["edr-agent", "online"], ["siem-core", "online"]].map(([node, status]) => (
                <div key={node} className="flex items-center gap-2 px-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] shrink-0" />
                  <span className="text-[11px] font-mono text-[#8b949e] flex-1">{node}</span>
                  <span className="text-[10px] text-[#3fb950]">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Col 2: Event feed ── */}
        <main className="flex flex-col overflow-hidden bg-[#0d1117]">
          <TelemetryMetrics events={events} isRunning={isRunning} />

          {/* Feed header */}
          <div className="h-9 flex items-center gap-3 px-4 border-b border-[#30363d] bg-[#161b22] shrink-0"></div>
          {/* Feed header */}
          <div className="h-9 flex items-center gap-3 px-4 border-b border-[#30363d] bg-[#161b22] shrink-0">
            <Terminal className="w-3.5 h-3.5 text-[#8b949e]" />
            <span className="text-xs font-medium text-[#8b949e]">Event Stream</span>
            <span className="text-[10px] font-mono text-[#484f58]">—</span>
            <span className="text-[10px] font-mono text-[#8b949e]">{events.length > 0 ? events.length : INIT_LOGS.length} events</span>
            {isRunning && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                <span className="text-[10px] text-[#3fb950] font-medium">LIVE</span>
              </div>
            )}
            <div className="flex-1" />
            <button className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-[#e6edf3] px-2 py-1 rounded border border-[#30363d] hover:border-[#8b949e] transition-colors">
              <Filter className="w-3 h-3" />Filter
            </button>
          </div>

          {/* ── FIX 2: Column headers always visible ── */}
          <div className="flex items-center gap-0 h-7 border-b border-[#30363d] bg-[#161b22] px-4 shrink-0">
            {[["TIME", "w-20"], ["LEVEL", "w-14"], ["TYPE", "w-28"], ["SOURCE", "w-32"], ["DETAIL", "flex-1"]].map(([l, w]) => (
              <div key={l} className={`${w} text-[9px] font-semibold text-[#484f58] uppercase tracking-wider pr-4`}>{l}</div>
            ))}
          </div>

          {/* Events — init logs shown when no live events exist */}
          <div ref={feedRef} className="flex-1 overflow-y-auto font-mono text-[11px]">
            {events.length === 0 ? (
              <>
                {INIT_LOGS.map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-0 px-4 py-0.5 hover:bg-[#161b22] transition-colors border-b border-[#21262d]/40"
                  >
                    <span className="w-20 text-[#484f58] shrink-0">{log.ts}</span>
                    <span className={`w-14 shrink-0 ${log.levelColor}`}>{log.level}</span>
                    <span className="w-28 text-[#484f58] shrink-0 truncate">{log.type}</span>
                    <span className="w-32 font-mono text-[#8b949e] shrink-0 truncate">{log.source}</span>
                    <span className="flex-1 text-[#484f58] truncate">{log.detail}</span>
                  </div>
                ))}
                {/* Blinking cursor row to signal the stream is live and waiting */}
                <div className="flex items-center gap-0 px-4 py-1">
                  <span className="w-20 text-[#484f58] shrink-0">--:--:--</span>
                  <span className="w-14 shrink-0" />
                  <span className="w-28 shrink-0" />
                  <span className="w-32 shrink-0" />
                  <span className="flex-1 flex items-center gap-1.5 text-[#484f58]">
                    <span className="inline-block w-1.5 h-3 bg-[#8b949e] opacity-60 animate-pulse" />
                  </span>
                </div>
              </>
            ) : (
              events.map((ev, i) => <EventRow key={i} ev={ev} />)
            )}
          </div>
        </main>

        {/* ── Col 3: Context panel ── */}
        <aside className="border-l border-[#30363d] bg-[#0d1117] flex flex-col overflow-hidden">

          {/* Incident context */}
          <div className="border-b border-[#30363d]">
            <SectionHeader icon={<Activity className="w-3.5 h-3.5" />} label="Incident Context" />
            {!incident ? (
              <div className="px-4 py-4">
                <p className="text-[11px] text-[#484f58] italic">No active incident.</p>
                <div className="mt-3 space-y-1.5">
                  {[["Last scan", "2m ago"], ["Policy ver.", "2024.12.1"], ["Rule set", "MITRE v15"]].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8b949e]">{k}</span>
                      <span className="text-[10px] font-mono text-[#c9d1d9]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#8b949e] uppercase tracking-wider">Risk Score</span>
                    <span className={`text-sm font-bold font-mono ${incident.risk_score >= 80 ? "text-[#da3633]" : incident.risk_score >= 60 ? "text-[#d29922]" : "text-[#3fb950]"}`}>{incident.risk_score}<span className="text-[10px] text-[#8b949e] font-normal">/100</span></span>
                  </div>
                  <div className="h-1 bg-[#30363d] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${incident.risk_score >= 80 ? "bg-[#da3633]" : incident.risk_score >= 60 ? "bg-[#d29922]" : "bg-[#238636]"}`} style={{ width: `${incident.risk_score}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {[
                    ["Source IP", incident.source_ip, true],
                    ["Country", incident.country, false],
                    ["ASN", incident.asn, true],
                    ["Technique", incident.mitre_technique, true],
                    ["Tactic", incident.mitre_tactic, false],
                    ["Severity", incident.severity, false],
                  ].map(([k, v, mono]) => (
                    <div key={String(k)} className="flex items-center justify-between gap-2">
                      <span className="text-[#8b949e] shrink-0">{k}</span>
                      <span className={`${mono ? "font-mono" : ""} text-[#c9d1d9] truncate text-right`}>{String(v)}</span>
                    </div>
                  ))}
                </div>

                <button onClick={handleExportReport} className="w-full text-left text-[11px] px-3 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#8b949e] transition-colors">
                  Export Forensic Report
                </button>

                <div className="flex gap-1.5 flex-wrap">
                  {incident.is_tor && <Flag label="TOR EXIT NODE" color="red" />}
                  {incident.is_vpn && <Flag label="VPN" color="yellow" />}
                  {incident.is_proxy && <Flag label="PROXY" color="yellow" />}
                  {!incident.is_tor && !incident.is_vpn && !incident.is_proxy && <span className="text-[10px] text-[#484f58]">No threat flags</span>}
                </div>
              </div>
            )}
          </div>

          {/* ML Triage panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label="Automated Incident Triage" action={
              !aiConfig
                ? <button onClick={() => setKeyModalOpen(true)} className="text-[10px] text-[#58a6ff] hover:underline">Configure engine →</button>
                : <span className="text-[10px] text-[#484f58] font-mono">{aiConfig.provider}</span>
            } />
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {!aiConfig && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#8b949e] leading-relaxed">ML Detection Engine not configured. Add an API key to enable automated triage, MITRE classification, and response recommendations.</p>
                  <button onClick={() => setKeyModalOpen(true)} className="w-full text-left text-[11px] px-3 py-2 rounded border border-[#58a6ff]/30 text-[#58a6ff] bg-[#58a6ff]/5 hover:bg-[#58a6ff]/10 transition-colors">
                    Configure SecOps Automation →
                  </button>
                </div>
              )}
              {aiConfig && isAnalyzing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
                    <div className="w-3 h-3 border border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
                    Running ML classification pipeline…
                  </div>
                  {["Parsing telemetry events", "MITRE ATT&CK lookup", "Threat scoring", "Generating response plan"].map((s, i) => (
                    <div key={s} className="flex items-center gap-2 px-2 py-1 rounded bg-[#161b22] border border-[#30363d]">
                      <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-[#3fb950]" : "bg-[#30363d]"}`} />
                      <span className="text-[10px] text-[#8b949e] font-mono">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {aiConfig && !isAnalyzing && !analysis && (
                <p className="text-[11px] text-[#484f58] italic">Triage output will appear here after a simulation run.</p>
              )}
              {analysis && !isAnalyzing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-[#161b22] border border-[#30363d]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#58a6ff] border border-[#58a6ff]/30 bg-[#58a6ff]/8 px-1.5 py-0.5 rounded">{analysis.mitre_technique}</span>
                      <span className="text-[10px] text-[#8b949e]">{analysis.mitre_tactic}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-[#8b949e] block">Confidence</span>
                      <span className="text-[11px] font-mono font-bold text-[#3fb950]">{analysis.risk_score}%</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1.5">Triage Summary</p>
                    <p className="text-[11px] text-[#c9d1d9] leading-relaxed bg-[#161b22] border border-[#30363d] rounded px-3 py-2">{analysis.summary}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1.5">Automated Response</p>
                    <div className="px-3 py-2 rounded border border-[#238636]/30 bg-[#238636]/8">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                        <span className="text-[10px] font-mono font-semibold text-[#3fb950]">{analysis.action_taken.replace(/_/g, "_")}</span>
                        <span className="ml-auto text-[9px] text-[#3fb950] border border-[#238636]/30 px-1 py-0.5 rounded">EXECUTED</span>
                      </div>
                      <p className="text-[11px] text-[#8b949e] leading-relaxed">{analysis.action_detail}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div >

      {/* ── Modal ── */}
      {keyModalOpen && <KeyModal onClose={() => setKeyModalOpen(false)} onSave={c => { setAIConfig(c); saveKey(c); setKeyModalOpen(false); }} />}
      {reportModal && <ReportModal markdown={reportModal.markdown} filename={reportModal.filename} onClose={() => setReportModal(null)} />}
    </div >
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function TabItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={`h-full flex items-center px-4 text-xs border-b-2 cursor-pointer transition-colors ${active ? "border-[#f78166] text-[#e6edf3] font-medium" : "border-transparent text-[#8b949e] hover:text-[#c9d1d9]"}`}>
      {label}
    </div>
  );
}

function SectionHeader({ icon, label, count, action }: { icon: React.ReactNode; label: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="h-9 flex items-center gap-2 px-4 border-b border-[#30363d] bg-[#161b22] shrink-0">
      <span className="text-[#8b949e]">{icon}</span>
      <span className="text-xs font-medium text-[#8b949e]">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-[#da3633]/20 text-[#da3633] border border-[#da3633]/20">{count}</span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function Flag({ label, color }: { label: string; color: "red" | "yellow" }) {
  const cls = color === "red"
    ? "border-[#da3633]/30 text-[#da3633] bg-[#da3633]/8"
    : "border-[#d29922]/30 text-[#d29922] bg-[#d29922]/8";
  return <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>;
}

// ─── Event row ────────────────────────────────────────────────────────────────
function EventRow({ ev }: { ev: WsEvent }) {
  const ts = "timestamp" in ev
    ? new Date((ev as WsIncidentOpen).timestamp).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  if (ev.type === "INCIDENT_OPEN") {
    const e = ev as WsIncidentOpen;
    return (
      <div className="flex items-center gap-0 px-4 py-1 border-b border-[#21262d] hover:bg-[#161b22] transition-colors">
        <span className="w-20 text-[#8b949e] shrink-0">{ts}</span>
        <span className="w-14 shrink-0"><span className="text-[9px] font-bold px-1 py-0.5 rounded border border-[#da3633]/30 text-[#da3633] bg-[#da3633]/8">ALERT</span></span>
        <span className="w-28 text-[#8b949e] shrink-0">INCIDENT_OPEN</span>
        <span className="w-32 font-mono text-[#58a6ff] shrink-0 truncate">{e.source_ip}</span>
        <span className="flex-1 text-[#c9d1d9] truncate">{e.attack_type.replace(/_/g, " ")} | {e.country} | risk <span className={e.risk_score >= 80 ? "text-[#da3633]" : "text-[#d29922]"}>{e.risk_score}/100</span>{e.is_tor ? " | TOR" : ""}</span>
      </div>
    );
  }
  if (ev.type === "LOG_EVENT") {
    const e = ev as WsLogEvent;
    const eventName = String((e.data as Record<string, unknown>).event ?? "EVENT");
    return (
      <div className="flex items-center gap-0 px-4 py-0.5 hover:bg-[#161b22] transition-colors">
        <span className="w-20 text-[#484f58] shrink-0">{ts}</span>
        <span className="w-14 shrink-0"><span className="text-[9px] font-mono text-[#3fb950]">INFO</span></span>
        <span className="w-28 text-[#484f58] font-mono shrink-0 truncate">{eventName}</span>
        <span className="w-32 font-mono text-[#8b949e] shrink-0 truncate">{e.source_ip}</span>
        <span className="flex-1 text-[#484f58] font-mono truncate">{JSON.stringify(e.data)}</span>
      </div>
    );
  }
  if (ev.type === "DEFENSE_ACTION") {
    const e = ev as WsDefenseAction;
    return (
      <div className="flex items-center gap-0 px-4 py-1 border-b border-[#21262d] bg-[#238636]/5 hover:bg-[#238636]/10 transition-colors">
        <span className="w-20 text-[#8b949e] shrink-0">{ts}</span>
        <span className="w-14 shrink-0"><span className="text-[9px] font-bold px-1 py-0.5 rounded border border-[#238636]/40 text-[#3fb950] bg-[#238636]/15">ACTION</span></span>
        <span className="w-28 text-[#3fb950] font-mono shrink-0 truncate">{e.action}</span>
        <span className="w-32 font-mono text-[#8b949e] shrink-0">automated</span>
        <span className="flex-1 text-[#8b949e] truncate">{e.detail}</span>
      </div>
    );
  }
  if (ev.type === "SIMULATION_COMPLETE") {
    return (
      <div className="flex items-center gap-0 px-4 py-1 border-b border-[#30363d]">
        <span className="w-20 text-[#484f58] shrink-0">{ts}</span>
        <span className="w-14 shrink-0"><span className="text-[9px] font-mono text-[#484f58]">SYS</span></span>
        <span className="w-28 text-[#484f58] font-mono shrink-0">SIM_DONE</span>
        <span className="w-32 shrink-0" />
        <span className="flex-1 text-[#484f58] italic">Simulation complete — triage pipeline running</span>
      </div>
    );
  }
  return null;
}

// ─── API Key Modal ─────────────────────────────────────────────────────────────
function KeyModal({ onClose, onSave }: { onClose: () => void; onSave: (c: AIKeyConfig) => void }) {
  const [provider, setProvider] = useState<AIProviderKey>("groq");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { const s = loadKey(); if (s) { setProvider(s.provider as AIProviderKey); setApiKey(s.key); } }, []);

  const isValid = apiKey.trim().length > 10;
  const prov = AI_PROVIDERS[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md mx-4 rounded-md border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#30363d]">
          <Settings className="w-4 h-4 text-[#8b949e]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#e6edf3]">SecOps Automation — ML Engine</p>
            <p className="text-[11px] text-[#8b949e]">BYOK · Key transmitted directly to provider, never persisted</p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2.5 p-3 rounded border border-[#d29922]/20 bg-[#d29922]/5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#d29922] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#d29922]/80 leading-relaxed">Key is forwarded via request header to <span className="font-semibold text-[#d29922]">{prov.label}</span>. Zero server-side storage.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] text-[#8b949e] uppercase tracking-wider font-medium">Provider / Model</label>
            <div className="relative">
              <select value={provider} onChange={e => setProvider(e.target.value as AIProviderKey)}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded border border-[#30363d] bg-[#0d1117] text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] cursor-pointer">
                {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map(p => <option key={p} value={p}>{AI_PROVIDERS[p].label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] pointer-events-none" />
            </div>
            <a href={prov.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#58a6ff] hover:underline">
              <ExternalLink className="w-3 h-3" />Get API key
            </a>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] text-[#8b949e] uppercase tracking-wider font-medium">API Key</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484f58] pointer-events-none" />
              <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={prov.placeholder} autoComplete="off"
                className="w-full pl-8 pr-10 py-2 rounded border border-[#30363d] bg-[#0d1117] text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff] font-mono" />
              <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#484f58] hover:text-[#8b949e] transition-colors">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-[#30363d]">
          <button onClick={() => { clearKey(); setApiKey(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#30363d] text-[11px] text-[#8b949e] hover:text-[#da3633] hover:border-[#da3633]/30 transition-colors">
            <Trash2 className="w-3 h-3" />Remove
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-[#30363d] text-[11px] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#8b949e] transition-colors">Cancel</button>
          <button onClick={() => isValid && onSave({ provider, key: apiKey.trim() })} disabled={!isValid}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[11px] font-medium transition-all ${isValid ? "border-[#238636] bg-[#238636] text-white hover:bg-[#2ea043] cursor-pointer" : "border-[#30363d] text-[#484f58] cursor-not-allowed"}`}>
            <FileText className="w-3 h-3" />Save configuration
          </button>
        </div>
      </div>
    </div>
  );
}
