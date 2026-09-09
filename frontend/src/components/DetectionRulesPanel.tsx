"use client";

import { useEffect, useState } from "react";
import { Loader2, Shield, Trash2 } from "lucide-react";

interface DetectionRule {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  severity_override: string;
  action_label: string;
  is_active: boolean;
  created_at: string;
}

interface RuleForm {
  name: string;
  description: string;
  event_type: string;
  severity_override: string;
  action_label: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const SEV_BADGE: Record<string, string> = {
  CRITICAL: "text-[#da3633] border-[#da3633]/30 bg-[#da3633]/8",
  HIGH: "text-[#d29922] border-[#d29922]/30 bg-[#d29922]/8",
  MEDIUM: "text-[#58a6ff] border-[#58a6ff]/30 bg-[#58a6ff]/8",
  LOW: "text-[#3fb950] border-[#238636]/30 bg-[#238636]/8",
};

const EMPTY_FORM: RuleForm = {
  name: "",
  description: "",
  event_type: "",
  severity_override: "MEDIUM",
  action_label: "ALERT_RAISED",
};

export default function DetectionRulesPanel() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);

  useEffect(() => {
    const loadRules = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/rules`);
        if (response.ok) setRules(await response.json());
      } finally {
        setLoading(false);
      }
    };
    void loadRules();
  }, []);

  const handleToggle = async (ruleId: string, current: boolean) => {
    const response = await fetch(`${BASE_URL}/api/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    if (response.ok) {
      const updated: DetectionRule = await response.json();
      setRules(existing => existing.map(rule => rule.id === ruleId ? { ...rule, ...updated } : rule));
    }
  };

  const handleDelete = async (ruleId: string) => {
    const response = await fetch(`${BASE_URL}/api/rules/${ruleId}`, { method: "DELETE" });
    if (response.ok) setRules(existing => existing.filter(rule => rule.id !== ruleId));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.event_type.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`${BASE_URL}/api/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        const created: DetectionRule = await response.json();
        setRules(existing => [...existing, created]);
        setForm(EMPTY_FORM);
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof RuleForm, value: string) => setForm(current => ({ ...current, [field]: value }));
  const inputClass = "text-[11px] font-mono bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-[#e6edf3] focus:outline-none focus:border-[#58a6ff] w-full";
  const activeCount = rules.filter(rule => rule.is_active).length;

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      <div className="h-9 flex items-center gap-2 px-4 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <Shield className="w-3.5 h-3.5 text-[#8b949e]" />
        <span className="text-xs font-medium text-[#8b949e]">Detection Rules</span>
        {activeCount > 0 && <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full bg-[#da3633]/20 text-[#da3633] border border-[#da3633]/20">{activeCount}</span>}
        <button onClick={() => setShowForm(true)} className="ml-auto text-[11px] px-2.5 py-1 rounded border border-[#238636]/40 text-[#3fb950] bg-[#238636]/8 hover:bg-[#238636]/15">New Rule</button>
      </div>

      {showForm && (
        <div className="border-b border-[#30363d] bg-[#161b22] px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-[10px] text-[#8b949e] uppercase tracking-wider">Rule Name<input required value={form.name} onChange={e => setField("name", e.target.value)} className={`mt-1 ${inputClass}`} /></label>
            <label className="text-[10px] text-[#8b949e] uppercase tracking-wider">Event Type<input value={form.event_type} onChange={e => setField("event_type", e.target.value)} placeholder="e.g. AUTH_BYPASS" className={`mt-1 ${inputClass}`} /></label>
            <label className="text-[10px] text-[#8b949e] uppercase tracking-wider">Severity Override<select value={form.severity_override} onChange={e => setField("severity_override", e.target.value)} className={`mt-1 ${inputClass}`}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
            <label className="text-[10px] text-[#8b949e] uppercase tracking-wider">Action Label<input value={form.action_label} onChange={e => setField("action_label", e.target.value)} className={`mt-1 ${inputClass}`} /></label>
          </div>
          <label className="block mt-3 text-[10px] text-[#8b949e] uppercase tracking-wider">Description<textarea rows={2} value={form.description} onChange={e => setField("description", e.target.value)} className={`mt-1 ${inputClass}`} /></label>
          <div className="flex justify-end gap-2 mt-3"><button onClick={() => setShowForm(false)} className="text-[11px] px-2.5 py-1 rounded text-[#8b949e] hover:text-[#c9d1d9]">Cancel</button><button onClick={handleCreate} disabled={saving} className="text-[11px] px-2.5 py-1 rounded border border-[#238636]/40 text-[#3fb950] bg-[#238636]/8 hover:bg-[#238636]/15 disabled:opacity-50">{saving ? "Saving..." : "Save Rule"}</button></div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[72px_minmax(180px,2fr)_minmax(120px,1fr)_100px_minmax(120px,1fr)_32px] gap-3 px-4 py-2 border-b border-[#30363d] bg-[#0d1117] text-[9px] font-mono font-bold text-[#8b949e] uppercase tracking-wider sticky top-0">
          <span>Status</span><span>Name</span><span>Event Type</span><span>Severity</span><span>Action</span><span />
        </div>
        {loading ? <div className="h-32 flex items-center justify-center"><Loader2 className="w-4 h-4 text-[#58a6ff] animate-spin" /></div> : rules.length === 0 ? <div className="h-32 flex items-center justify-center px-4 text-center text-[11px] text-[#484f58] font-mono">No detection rules configured. Create your first rule to begin evaluating telemetry events.</div> : rules.map(rule => (
          <div key={rule.id} className="grid grid-cols-[72px_minmax(180px,2fr)_minmax(120px,1fr)_100px_minmax(120px,1fr)_32px] gap-3 items-center px-4 py-2 border-b border-[#21262d] hover:bg-[#161b22] font-mono text-[11px]">
            <div onClick={() => void handleToggle(rule.id, rule.is_active)} className={`relative w-7 h-4 rounded-full cursor-pointer transition-colors duration-200 ${rule.is_active ? "bg-[#238636]" : "bg-[#30363d]"}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${rule.is_active ? "translate-x-3.5" : "translate-x-0.5"}`} /></div>
            <div className="min-w-0"><div className="text-[#c9d1d9] truncate">{rule.name}</div>{rule.description && <div className="text-[#484f58] text-[10px] truncate mt-0.5">{rule.description}</div>}</div>
            <span className="text-[#58a6ff] truncate">{rule.event_type}</span>
            <span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SEV_BADGE[rule.severity_override] ?? "text-[#8b949e] border-[#30363d]"}`}>{rule.severity_override}</span></span>
            <span className="text-[#8b949e] truncate">{rule.action_label}</span>
            <button onClick={() => void handleDelete(rule.id)} aria-label={`Delete ${rule.name}`} className="text-[#484f58] hover:text-[#da3633]"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
