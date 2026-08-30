"use client";
import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type { WsEvent, WsIncidentOpen, WsLogEvent, WsDefenseAction } from "@/types";
function renderEvent(event: WsEvent, index: number): React.ReactNode {
  const ts = "timestamp" in event ? new Date((event as WsIncidentOpen).timestamp).toLocaleTimeString("en-US",{hour12:false}) : "";
  switch(event.type) {
    case "INCIDENT_OPEN": { const e=event as WsIncidentOpen; return <div key={index} className="flex gap-2"><span className="text-slate-600 text-[10px] shrink-0 w-16 pt-px">{ts}</span><span className="text-rose-400 font-bold text-[10px] shrink-0 w-20 pt-px">[INCIDENT]</span><span className="text-xs text-slate-200 font-mono break-all"><span className="text-cyan-300">{e.attack_type}</span>{" from "}<span className="text-amber-300">{e.source_ip}</span>{" · "}<span className="text-slate-400">{e.country}</span>{" · risk "}<span className={e.risk_score>=90?"text-rose-400 font-bold":"text-amber-400"}>{e.risk_score}/100</span>{e.is_tor&&<span className="ml-2 text-[9px] bg-purple-900/40 text-purple-300 border border-purple-700/40 px-1 py-px rounded">TOR EXIT</span>}</span></div>; }
    case "LOG_EVENT": { const e=event as WsLogEvent; return <div key={index} className="flex gap-2"><span className="text-slate-600 text-[10px] shrink-0 w-16 pt-px">{ts}</span><span className="text-emerald-500 font-bold text-[10px] shrink-0 w-20 pt-px">[{String(e.sequence).padStart(2,"0")}:{String((e.data as Record<string,unknown>).event)}]</span><span className="text-[10px] text-slate-400 font-mono break-all">{JSON.stringify(e.data)}</span></div>; }
    case "DEFENSE_ACTION": { const e=event as WsDefenseAction; return <div key={index} className="flex gap-2 border-t border-cyan-900/30 pt-2 mt-1"><span className="text-slate-600 text-[10px] shrink-0 w-16 pt-px">{ts}</span><span className="text-cyan-400 font-bold text-[10px] shrink-0 w-20 pt-px">[DEFENSE]</span><span className="text-xs text-cyan-200 font-mono break-all">✦ <span className="text-cyan-300 font-semibold">{e.action}</span>{" — "}{e.detail}</span></div>; }
    case "SIMULATION_COMPLETE": return <div key={index} className="flex gap-2 border-t border-slate-700/50 pt-2 mt-1"><span className="text-slate-600 text-[10px] shrink-0 w-16 pt-px">{ts}</span><span className="text-slate-500 font-bold text-[10px] shrink-0 w-20 pt-px">[DONE]</span><span className="text-[10px] text-slate-500 font-mono">Simulation complete — awaiting AI analysis…</span></div>;
    case "ERROR": return <div key={index} className="flex gap-2"><span className="text-slate-600 text-[10px] shrink-0 w-16 pt-px">--:--:--</span><span className="text-rose-500 font-bold text-[10px] shrink-0 w-20 pt-px">[ERROR]</span><span className="text-[10px] text-rose-400 font-mono">{(event as {type:"ERROR";message:string}).message}</span></div>;
    default: return null;
  }
}
interface TelemetryFeedProps { events: WsEvent[]; isRunning: boolean; }
export default function TelemetryFeed({ events, isRunning }:TelemetryFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[events]);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/60 shrink-0"><Terminal className="w-4 h-4 text-emerald-400"/><span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Telemetry Stream</span>{isRunning&&<span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE</span>}</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px]">{events.length===0?<div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600"><Terminal className="w-8 h-8 opacity-30"/><p className="text-xs">No telemetry yet — launch an attack simulation.</p></div>:events.map((ev,i)=>renderEvent(ev,i))}<div ref={bottomRef}/></div>
    </div>
  );
}
