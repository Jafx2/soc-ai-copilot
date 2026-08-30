"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Key, RefreshCw, ShieldCheck, AlertOctagon, Database,
  FileX2, Loader2, Zap, Terminal, Globe, Bot, Brain,
  Shield, ShieldAlert, ShieldOff, Radio, Eye, EyeOff,
  AlertTriangle, ChevronDown, ExternalLink, Trash2, Check, X
} from "lucide-react";
import type {
  AIAnalysis, AIKeyConfig, AIProvider, AttackVector,
  WsEvent, WsIncidentOpen, WsLogEvent, WsDefenseAction
} from "@/types";

// ─── localStorage helpers ────────────────────────────────────────────────────
const LS_KEY = "soc_ai_key_config";
function saveKey(c: AIKeyConfig) { localStorage.setItem(LS_KEY, JSON.stringify(c)); }
function loadKey(): AIKeyConfig | null { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function clearKey() { localStorage.removeItem(LS_KEY); }

type AIProvider = "groq" | "openai" | "deepseek" | "gemini";
const AI_PROVIDERS: Record<AIProvider, { label: string; placeholder: string; docsUrl: string }> = {
  groq: { label: "Groq — Llama 3 (Free)", placeholder: "gsk_...", docsUrl: "https://console.groq.com/keys" },
  openai: { label: "OpenAI — GPT-4o-mini", placeholder: "sk-...", docsUrl: "https://platform.openai.com/api-keys" },
  deepseek: { label: "DeepSeek Chat", placeholder: "sk-...", docsUrl: "https://platform.deepseek.com" },
  gemini: { label: "Google Gemini", placeholder: "AIza...", docsUrl: "https://aistudio.google.com/app/apikey" },
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = BASE_URL.replace(/^http/, "ws");

// ─── Attack vectors ───────────────────────────────────────────────────────────
const VECTORS = [
  { id: "SQL_INJECTION" as AttackVector, label: "SQL Injection", technique: "T1190", tactic: "Initial Access", severity: "HIGH" as const, color: "amber" },
  { id: "DATA_EXFILTRATION" as AttackVector, label: "Data Exfiltration", technique: "T1041", tactic: "Exfiltration", severity: "CRITICAL" as const, color: "rose" },
  { id: "RANSOMWARE" as AttackVector, label: "Ransomware Execution", technique: "T1486", tactic: "Impact", severity: "CRITICAL" as const, color: "rose" },
];

// ─── Severity helpers ─────────────────────────────────────────────────────────
function severityColor(s: string) {
  return s === "CRITICAL" ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
    : s === "HIGH" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-slate-400 bg-slate-700/30 border-slate-600/30";
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
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

  const socketRef = useRef<{ send: (...a: unknown[]) => void; close: () => void } | null>(null);
  const rawLogsRef = useRef<Record<string, unknown>[]>([]);
  const incidentRef = useRef<WsIncidentOpen | null>(null);

  useEffect(() => { setAIConfig(loadKey()); }, []);

  const handleEvent = useCallback(async (ev: WsEvent) => {
    setEvents(p => [...p, ev]);
    if (ev.type === "INCIDENT_OPEN") { setIncident(ev as WsIncidentOpen); incidentRef.current = ev as WsIncidentOpen; rawLogsRef.current = []; }
    if (ev.type === "LOG_EVENT") { rawLogsRef.current.push((ev as WsLogEvent).data); }
    if (ev.type === "DEFENSE_ACTION") { rawLogsRef.current.push({ defense: (ev as WsDefenseAction).action }); }
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
      socketRef.current = { send: () => { }, close: () => ws.close() };
    } catch { setIsRunning(false); }
  }, [handleEvent]);

  useEffect(() => () => socketRef.current?.close(), []);

  const reset = () => { setEvents([]); setIncident(null); setAnalysis(null); setActiveVector(null); };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 flex items-center gap-4 px-6 h-14 border-b border-slate-800 bg-[#070b12]/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none">SOC AI Copilot</p>
            <p className="text-[10px] text-slate-500 leading-none mt-px">Threat Simulation Dashboard</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full border ${isRunning ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-rose-400 animate-pulse" : "bg-emerald-400"}`} />
          {isRunning ? "SIMULATION ACTIVE" : "SYSTEMS NOMINAL"}
        </div>

        <button onClick={reset} disabled={isRunning} title="Reset" className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>

        <button onClick={() => setKeyModalOpen(true)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${aiConfig ? "border-slate-700 text-slate-400 hover:border-slate-600" : "border-cyan-700/50 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10"}`}>
          <Key className="w-3.5 h-3.5" />
          {aiConfig ? `${aiConfig.provider} · ${aiConfig.key.slice(0, 6)}…` : "Add API Key"}
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 grid grid-cols-[340px_1fr_300px] gap-px bg-slate-800/40 overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>

        {/* ── Col 1: Attack injector + recent ── */}
        <aside className="bg-[#070b12] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Threat Injector</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {VECTORS.map(v => {
                const active = activeVector === v.id && isRunning;
                const colors = { amber: { ring: "border-amber-500/50 bg-amber-500/5", icon: "bg-amber-500/10 border-amber-500/20 text-amber-400", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" }, rose: { ring: "border-rose-500/50 bg-rose-500/5", icon: "bg-rose-500/10 border-rose-500/20 text-rose-400", badge: "bg-rose-500/15 text-rose-300 border-rose-500/30" } }[v.color];
                return (
                  <button key={v.id} onClick={() => !isRunning && launch(v.id)} disabled={isRunning}
                    className={`relative w-full text-left rounded-xl border transition-all duration-200 overflow-hidden ${isRunning ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-110"} ${active ? "border-cyan-500/50 bg-cyan-500/5" : `border-slate-700/60 bg-slate-900/40 hover:${colors!.ring}`}`}>
                    {active && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />}
                    <div className="p-3.5 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${active ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : colors!.icon}`}>
                        {active ? <Loader2 className="w-4 h-4 animate-spin" /> : v.id === "SQL_INJECTION" ? <Database className="w-4 h-4" /> : v.id === "DATA_EXFILTRATION" ? <Zap className="w-4 h-4" /> : <FileX2 className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100 truncate">{v.label}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${colors!.badge}`}>{v.severity}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-cyan-400/70 bg-cyan-900/20 border border-cyan-800/40 px-1.5 py-px rounded">{v.technique}</span>
                          <span className="text-[10px] text-slate-500">{v.tactic}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-700 text-center mt-3">All simulations are synthetic — no real systems affected.</p>
          </div>

          {/* Recent attacks */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Recent Attacks</p>
            <div className="space-y-2">
              {events.filter(e => e.type === "INCIDENT_OPEN").length === 0
                ? <p className="text-xs text-slate-700 text-center mt-6">No attacks simulated yet.</p>
                : events.filter(e => e.type === "INCIDENT_OPEN").map((e, i) => {
                  const inc = e as WsIncidentOpen;
                  return (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${inc.severity === "CRITICAL" ? "bg-rose-500" : "bg-amber-500"}`} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-300 truncate">{inc.attack_type.replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-slate-600 truncate">{inc.source_ip} · {inc.country}</p>
                      </div>
                      <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${severityColor(inc.severity)}`}>{inc.severity}</span>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </aside>

        {/* ── Col 2: Telemetry feed ── */}
        <main className="bg-[#070b12] flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Live Telemetry</span>
            {isRunning && <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />STREAMING</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-0.5">
            {events.length === 0
              ? <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-700"><Terminal className="w-10 h-10 opacity-20" /><p className="text-xs">Waiting for simulation…</p></div>
              : events.map((ev, i) => <TelemetryLine key={i} ev={ev} />)
            }
            <div id="tele-bottom" />
          </div>
        </main>

        {/* ── Col 3: Threat intel + AI copilot ── */}
        <aside className="bg-[#070b12] flex flex-col overflow-hidden divide-y divide-slate-800">

          {/* Threat Intel */}
          <div className="flex flex-col" style={{ flex: incident ? "0 0 auto" : "1" }}>
            <div className="flex items-center gap-2 px-4 py-3 shrink-0">
              <Globe className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Threat Intel</span>
              {isRunning && incident && <Radio className="w-3 h-3 text-violet-400 animate-pulse ml-auto" />}
            </div>
            {!incident
              ? <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-700"><ShieldOff className="w-7 h-7 opacity-30" /><p className="text-xs">No active threat.</p></div>
              : <div className="px-4 pb-4 space-y-3">
                {/* Risk ring */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <svg className="w-14 h-14 -rotate-90 shrink-0" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={incident.risk_score >= 90 ? "#f43f5e" : incident.risk_score >= 70 ? "#f59e0b" : "#10b981"} strokeWidth="3.5" strokeDasharray={`${incident.risk_score} 100`} strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className={`text-2xl font-black font-mono ${incident.risk_score >= 90 ? "text-rose-400" : incident.risk_score >= 70 ? "text-amber-400" : "text-emerald-400"}`}>{incident.risk_score}<span className="text-xs text-slate-500 font-normal">/100</span></p>
                    <p className="text-[10px] text-slate-500">Risk Score</p>
                    <p className="text-[10px] font-mono text-cyan-300 mt-0.5">{incident.mitre_technique}</p>
                  </div>
                </div>
                {/* Geo */}
                <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 divide-y divide-slate-800/60">
                  {[["IP", incident.source_ip, true], ["Country", incident.country, false], ["City", incident.city, false], ["ASN", incident.asn, true]].map(([l, v, mono]) => (
                    <div key={String(l)} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{l}</span>
                      <span className={`text-[11px] text-slate-300 ${mono ? "font-mono" : ""} truncate ml-2`}>{String(v)}</span>
                    </div>
                  ))}
                </div>
                {/* Flags */}
                <div className="flex flex-wrap gap-1.5">
                  {[["TOR", incident.is_tor, "purple"], ["VPN", incident.is_vpn, "amber"], ["PROXY", incident.is_proxy, "orange"]].map(([l, a]) => (
                    <span key={String(l)} className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${a ? "bg-purple-500/15 border-purple-500/30 text-purple-300" : "bg-slate-800/50 border-slate-700/40 text-slate-600"}`}>{String(l)}</span>
                  ))}
                </div>
              </div>
            }
          </div>

          {/* AI Copilot */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 shrink-0">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">AI Copilot</span>
              {aiConfig && <button onClick={() => setKeyModalOpen(true)} className="ml-auto text-[9px] text-slate-600 hover:text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded transition-colors">{aiConfig.provider}</button>}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {!aiConfig && (
                <div className="flex flex-col items-center text-center gap-3 pt-4">
                  <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Brain className="w-5 h-5 text-cyan-400" /></div>
                  <p className="text-xs font-medium text-slate-300">Connect AI Copilot</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">Add a Groq, OpenAI, or DeepSeek key for AI-powered analysis.</p>
                  <button onClick={() => setKeyModalOpen(true)} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-cyan-900/30">Configure API key</button>
                </div>
              )}
              {aiConfig && isAnalyzing && (
                <div className="flex flex-col items-center justify-center gap-3 pt-8">
                  <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                  <p className="text-xs text-slate-400">Analysing telemetry…</p>
                </div>
              )}
              {aiConfig && !isAnalyzing && !analysis && (
                <div className="flex flex-col items-center justify-center gap-2 pt-8 text-slate-700">
                  <ShieldAlert className="w-7 h-7 opacity-30" />
                  <p className="text-xs">Run a simulation to trigger analysis.</p>
                </div>
              )}
              {analysis && !isAnalyzing && (
                <div className="space-y-3">
                  {/* Risk bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Risk</span>
                      <span className={`text-sm font-black font-mono ${analysis.risk_score >= 90 ? "text-rose-400" : "text-amber-400"}`}>{analysis.risk_score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${analysis.risk_score >= 90 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${analysis.risk_score}%` }} />
                    </div>
                  </div>
                  {/* MITRE */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-900/30 border border-cyan-800/50 px-2 py-0.5 rounded">{analysis.mitre_technique}</span>
                    <span className="text-[10px] text-slate-400">{analysis.mitre_tactic}</span>
                  </div>
                  {/* Summary */}
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                    <p className="text-[11px] text-slate-300 leading-relaxed">{analysis.summary}</p>
                  </div>
                  {/* Defense */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-900/10 border border-emerald-700/25">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-emerald-400 mb-0.5">{analysis.action_taken.replace(/_/g, " ")}</p>
                      <p className="text-[11px] text-emerald-200/70 leading-relaxed">{analysis.action_detail}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── API Key Modal ── */}
      {keyModalOpen && <APIKeyModal onClose={() => setKeyModalOpen(false)} onSave={c => { setAIConfig(c); saveKey(c); setKeyModalOpen(false); }} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEMETRY LINE
// ═══════════════════════════════════════════════════════════════════════════════
function TelemetryLine({ ev }: { ev: WsEvent }) {
  const ts = "timestamp" in ev ? new Date((ev as WsIncidentOpen).timestamp).toLocaleTimeString("en-US", { hour12: false }) : "--:--:--";
  if (ev.type === "INCIDENT_OPEN") {
    const e = ev as WsIncidentOpen;
    return (
      <div className="flex gap-2 py-0.5 border-b border-slate-800/40">
        <span className="text-slate-600 shrink-0 w-16">{ts}</span>
        <span className="text-rose-400 font-bold shrink-0 w-20">[ALERT]</span>
        <span className="text-slate-200 break-all"><span className="text-cyan-300">{e.attack_type}</span>{" · "}<span className="text-amber-300">{e.source_ip}</span>{" · "}{e.country}{" · risk "}<span className={e.risk_score >= 90 ? "text-rose-400 font-bold" : "text-amber-400"}>{e.risk_score}/100</span>{e.is_tor && <span className="ml-2 text-[9px] bg-purple-900/40 text-purple-300 border border-purple-700/40 px-1 py-px rounded">TOR</span>}</span>
      </div>
    );
  }
  if (ev.type === "LOG_EVENT") {
    const e = ev as WsLogEvent;
    return (
      <div className="flex gap-2 py-0.5">
        <span className="text-slate-600 shrink-0 w-16">{ts}</span>
        <span className="text-emerald-500 font-bold shrink-0 w-20">[{String(e.sequence).padStart(2, "0")}:{String((e.data as Record<string, unknown>).event)}]</span>
        <span className="text-slate-500 break-all">{JSON.stringify(e.data)}</span>
      </div>
    );
  }
  if (ev.type === "DEFENSE_ACTION") {
    const e = ev as WsDefenseAction;
    return (
      <div className="flex gap-2 py-1 border-t border-cyan-900/20 mt-1">
        <span className="text-slate-600 shrink-0 w-16">{ts}</span>
        <span className="text-cyan-400 font-bold shrink-0 w-20">[DEFENSE]</span>
        <span className="text-cyan-200 break-all">✦ <span className="font-semibold">{e.action}</span>{" — "}{e.detail}</span>
      </div>
    );
  }
  if (ev.type === "SIMULATION_COMPLETE") {
    return (
      <div className="flex gap-2 py-1 border-t border-slate-700/40 mt-1">
        <span className="text-slate-600 shrink-0 w-16">{ts}</span>
        <span className="text-slate-500 font-bold shrink-0 w-20">[DONE]</span>
        <span className="text-slate-500">Simulation complete. Awaiting AI analysis…</span>
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API KEY MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function APIKeyModal({ onClose, onSave }: { onClose: () => void; onSave: (c: AIKeyConfig) => void }) {
  const [provider, setProvider] = useState<AIProvider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { const s = loadKey(); if (s) { setProvider(s.provider); setApiKey(s.key); } }, []);

  const isValid = apiKey.trim().length > 10;
  const prov = AI_PROVIDERS[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md mx-4 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-slate-700/60">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Bot className="w-5 h-5 text-cyan-400" /></div>
          <div className="flex-1"><p className="text-sm font-semibold text-slate-100">AI Copilot — API Key</p><p className="text-xs text-slate-500">BYOK · Never stored on our servers</p></div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70 leading-relaxed">Key sent directly to <span className="text-amber-300 font-medium">{prov.label}</span> — not stored anywhere on our infrastructure.</p>
          </div>
          {/* Provider */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Provider</label>
            <div className="relative">
              <select value={provider} onChange={e => setProvider(e.target.value as AIProvider)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-pointer">
                {(Object.keys(AI_PROVIDERS) as AIProvider[]).map(p => <option key={p} value={p}>{AI_PROVIDERS[p].label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
            <a href={prov.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"><ExternalLink className="w-3 h-3" />Get a free key</a>
          </div>
          {/* Key input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={prov.placeholder} autoComplete="off" className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono" />
              <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center gap-3 px-6 pb-5">
          <button onClick={() => { clearKey(); setApiKey(""); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"><Trash2 className="w-3.5 h-3.5" />Clear</button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => isValid && onSave({ provider, key: apiKey.trim() })} disabled={!isValid} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isValid ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30" : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}>
            <Check className="w-4 h-4" />Save key
          </button>
        </div>
      </div>
    </div>
  );
}