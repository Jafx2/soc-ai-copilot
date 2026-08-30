"use client";
import { AlertOctagon, Database, FileX2, Loader2, Zap } from "lucide-react";
import type { AttackVector } from "@/types";
interface VectorMeta { id: AttackVector; label: string; description: string; tactic: string; technique: string; severity: "HIGH"|"CRITICAL"; icon: React.ReactNode; accentClass: string; }
const VECTORS: VectorMeta[] = [
  { id:"SQL_INJECTION", label:"SQL Injection / App Exploit", description:"Malformed SQL payload targeting a public login endpoint to bypass auth and dump the users table.", tactic:"Initial Access", technique:"T1190", severity:"HIGH", icon:<Database className="w-5 h-5"/>, accentClass:"border-amber-500/40 hover:border-amber-400/70 hover:bg-amber-500/5" },
  { id:"DATA_EXFILTRATION", label:"Mass Data Exfiltration", description:"847 MB archive staged in /tmp and tunnelled over TLS to a C2 server masquerading as a CDN.", tactic:"Exfiltration", technique:"T1041", severity:"CRITICAL", icon:<Zap className="w-5 h-5"/>, accentClass:"border-rose-500/40 hover:border-rose-400/70 hover:bg-rose-500/5" },
  { id:"RANSOMWARE", label:"Ransomware Execution", description:"Macro-dropped PowerShell payload deletes VSS snapshots and encrypts 1,204 files via living-off-the-land.", tactic:"Impact", technique:"T1486", severity:"CRITICAL", icon:<FileX2 className="w-5 h-5"/>, accentClass:"border-rose-600/50 hover:border-rose-500/80 hover:bg-rose-600/5" },
];
const SEVERITY_BADGE: Record<string,string> = { HIGH:"bg-amber-500/15 text-amber-300 border border-amber-500/30", CRITICAL:"bg-rose-500/15 text-rose-300 border border-rose-500/30" };
interface AttackPanelProps { onLaunch:(vector:AttackVector)=>void; isRunning:boolean; activeVector:AttackVector|null; }
export default function AttackPanel({ onLaunch, isRunning, activeVector }:AttackPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1"><AlertOctagon className="w-4 h-4 text-rose-400"/><span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Threat Injector</span></div>
      {VECTORS.map((vec)=>{ const isActive=activeVector===vec.id&&isRunning; const isDisabled=isRunning; return (
        <button key={vec.id} onClick={()=>!isDisabled&&onLaunch(vec.id)} disabled={isDisabled} className={`group relative w-full text-left rounded-xl border bg-slate-900/60 transition-all duration-200 overflow-hidden ${isDisabled?"opacity-50 cursor-not-allowed":"cursor-pointer"} ${isActive?"border-cyan-500/60 bg-cyan-500/5 ring-1 ring-cyan-500/20":vec.accentClass}`}>
          {isActive&&<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"/>}
          <div className="px-4 py-3.5 flex items-start gap-3.5">
            <div className={`mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${isActive?"bg-cyan-500/10 border-cyan-500/30 text-cyan-400":vec.id==="SQL_INJECTION"?"bg-amber-500/10 border-amber-500/20 text-amber-400":"bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>{isActive?<Loader2 className="w-5 h-5 animate-spin text-cyan-400"/>:vec.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold text-slate-100">{vec.label}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SEVERITY_BADGE[vec.severity]}`}>{vec.severity}</span></div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{vec.description}</p>
              <div className="flex items-center gap-3 mt-2"><span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-900/20 border border-cyan-800/40 px-1.5 py-0.5 rounded">{vec.technique}</span><span className="text-[10px] text-slate-500">{vec.tactic}</span></div>
            </div>
          </div>
        </button>
      );})}
      <p className="text-[10px] text-slate-600 text-center mt-1">All simulations are synthetic — no real systems are affected.</p>
    </div>
  );
}
