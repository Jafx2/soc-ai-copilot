"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

interface ThreatIntelResult {
  ip_or_domain: string;
  risk_score: number;
  risk_level: string;
  country: string;
  reputation_summary: string;
  associated_threats: string[];
  recommended_action: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const LS_KEY = "soc_ai_key_config";

const QUICK_TARGETS = [
  { label: "Tor Exit Node", value: "185.220.101.47" },
  { label: "Known C2 Server", value: "45.33.32.156" },
  { label: "RU Bulletproof", value: "193.32.162.12" },
  { label: "Phishing Domain", value: "secure-login-verify.com" },
];

function loadKey(): { provider: string; key: string } | null {
  try {
    const r = localStorage.getItem(LS_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

const RISK_BADGE: Record<string, string> = {
  CRITICAL: "text-[#da3633] border-[#da3633]/30 bg-[#da3633]/8",
  HIGH: "text-[#d29922] border-[#d29922]/30 bg-[#d29922]/8",
  MEDIUM: "text-[#58a6ff] border-[#58a6ff]/30 bg-[#58a6ff]/8",
  LOW: "text-[#3fb950] border-[#238636]/30 bg-[#238636]/8",
};

function riskColor(score: number) {
  return score >= 80 ? "#da3633" : score >= 60 ? "#d29922" : score >= 40 ? "#58a6ff" : "#3fb950";
}

export default function ThreatIntelPanel() {
  const [target, setTarget] = useState("");
  const [result, setResult] = useState<ThreatIntelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<{ provider: string; key: string } | null>(null);

  useEffect(() => {
    setAiConfig(loadKey());
  }, []);

  const handleLookup = async () => {
    const config = loadKey();
    setAiConfig(config);
    if (!config) {
      setError("Configure the ML engine first (top right button)");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${BASE_URL}/api/threat-intel/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Key": config.key,
          "X-AI-Provider": config.provider,
        },
        body: JSON.stringify({ target: target.trim() }),
      });
      if (!response.ok) throw new Error("Lookup failed");
      setResult(await response.json());
    } catch {
      setError("Lookup failed. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      <div className="h-9 flex items-center gap-2 px-4 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <Search className="w-3.5 h-3.5 text-[#8b949e]" />
        <span className="text-xs font-medium text-[#8b949e]">Threat Intelligence Lookup</span>
        <div className="flex-1" />
        <span className={`text-[10px] font-mono ${aiConfig ? "text-[#484f58]" : "text-[#da3633]"}`}>
          {aiConfig ? `ML engine: ${aiConfig.provider}` : "Configure ML engine to use this module"}
        </span>
      </div>

      <div className="px-4 py-3 border-b border-[#30363d] bg-[#161b22] shrink-0 space-y-2">
        <div className="flex gap-2">
          <input value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLookup()} placeholder="Enter IP address or domain..." className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-[11px] font-mono text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors" />
          <button onClick={handleLookup} disabled={loading || !target.trim()} className="px-3 py-1.5 rounded border text-[11px] font-medium transition-all enabled:border-[#238636] enabled:bg-[#238636] enabled:text-white enabled:hover:bg-[#2ea043] disabled:border-[#30363d] disabled:text-[#484f58] disabled:cursor-not-allowed">
            {loading ? "Analyzing..." : "Investigate"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#484f58] uppercase tracking-wider">Quick targets</span>
          {QUICK_TARGETS.map((item) => <button key={item.value} onClick={() => setTarget(item.value)} className="text-[9px] font-mono px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors">{item.label}</button>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && <p className="text-[11px] text-[#da3633] font-mono">{error}</p>}
        {loading && <div className="flex flex-col items-center justify-center h-full gap-3 text-[#8b949e]"><div className="w-4 h-4 border border-[#58a6ff] border-t-transparent rounded-full animate-spin" /><p className="text-[11px] font-mono">Running threat intelligence analysis...</p></div>}
        {result && <div>
          <div className="p-3 rounded border border-[#30363d] bg-[#161b22] mb-3">
            <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-mono text-[#e6edf3] truncate">{result.ip_or_domain}</span><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${RISK_BADGE[result.risk_level] ?? "text-[#8b949e] border-[#30363d]"}`}>{result.risk_level}</span></div>
            <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden mt-2"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, result.risk_score))}%`, backgroundColor: riskColor(result.risk_score) }} /></div>
            <div className="flex justify-between mt-1"><span className="text-[9px] text-[#484f58]">0</span><span className="text-[11px] font-mono font-bold" style={{ color: riskColor(result.risk_score) }}>{result.risk_score}/100</span><span className="text-[9px] text-[#484f58]">100</span></div>
            <div className="flex justify-between mt-2"><span className="text-[10px] text-[#8b949e]">Country</span><span className="text-[10px] font-mono text-[#c9d1d9]">{result.country}</span></div>
          </div>
          <section className="mb-3"><p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1">Reputation Analysis</p><p className="text-[11px] text-[#c9d1d9] leading-relaxed bg-[#161b22] border border-[#30363d] rounded px-3 py-2">{result.reputation_summary}</p></section>
          <section className="mb-3"><p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1.5">Associated Threats</p>{result.associated_threats.length === 0 ? <p className="text-[11px] text-[#484f58] italic">No known threat associations</p> : <div className="flex flex-wrap gap-1.5">{result.associated_threats.map((threat) => <span key={threat} className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#da3633]/30 text-[#da3633] bg-[#da3633]/8">{threat}</span>)}</div>}</section>
          <section><p className="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1.5">Recommended Action</p><div className="px-3 py-2 rounded border border-[#238636]/30 bg-[#238636]/8"><div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" /><span className="text-[11px] text-[#3fb950] font-mono">{result.recommended_action}</span></div></div></section>
        </div>}
        {!loading && !result && !error && <div className="flex flex-col items-center justify-center h-full gap-2 text-[#484f58]"><p className="text-[11px] font-mono">Enter an IP address or domain to begin threat analysis.</p></div>}
      </div>
    </div>
  );
}
