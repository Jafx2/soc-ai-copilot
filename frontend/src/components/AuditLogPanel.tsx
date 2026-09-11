"use client";

import { useEffect, useMemo, useState } from "react";

interface TelemetryLog {
  id: string;
  incident_id: string;
  sequence: number;
  source_ip: string;
  event_type: string;
  event_data: Record<string, unknown>;
  timestamp: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/telemetry/logs?limit=100`);
        if (!response.ok) throw new Error("Unable to load telemetry logs");
        const data: TelemetryLog[] = await response.json();
        if (mounted) setLogs(data);
      } catch {
        if (mounted) setLogs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const eventTypes = useMemo(() => Array.from(new Set(logs.map(log => log.event_type))), [logs]);
  const filteredLogs = eventType ? logs.filter(log => log.event_type === eventType) : logs;

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setEventType(null)} className={`text-[10px] font-mono px-2 py-1 rounded border ${!eventType ? "border-[#58a6ff] text-[#58a6ff]" : "border-[#30363d] text-[#484f58]"}`}>
            All
          </button>
          {eventTypes.map(type => (
            <button key={type} onClick={() => setEventType(type)} className={`text-[10px] font-mono px-2 py-1 rounded border ${eventType === type ? "border-[#58a6ff] text-[#58a6ff]" : "border-[#30363d] text-[#484f58]"}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-0 h-7 border-b border-[#30363d] bg-[#161b22] px-4 shrink-0">
        {["TIMESTAMP", "TYPE", "SOURCE IP", "EVENT", "DETAIL"].map((label, index) => (
          <div key={label} className={`${index === 4 ? "flex-1" : index === 0 ? "w-24" : index === 1 ? "w-32" : index === 2 ? "w-32" : "w-36"} text-[9px] font-semibold text-[#484f58] uppercase tracking-wider pr-4`}>
            {label}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-0 px-4 py-1 border-b border-[#21262d]">
                <div className="w-24 shrink-0 pr-4">
                  <div className="h-2 rounded bg-[#21262d] animate-pulse w-14" />
                </div>
                <div className="w-32 shrink-0 pr-4">
                  <div className="h-4 rounded bg-[#21262d] animate-pulse w-20" />
                </div>
                <div className="w-32 shrink-0 pr-4">
                  <div className="h-2 rounded bg-[#21262d] animate-pulse w-24" />
                </div>
                <div className="w-36 shrink-0 pr-4">
                  <div className="h-2 rounded bg-[#21262d] animate-pulse w-16" />
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded bg-[#21262d] animate-pulse" style={{ width: `${55 + (i % 4) * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-[#484f58] font-mono text-center px-4">No telemetry logs recorded. Run a simulation to populate the audit log.</div>
        ) : (
          filteredLogs.map(log => {
            const eventName = String(log.event_data.event ?? log.event_type);
            const detail = JSON.stringify(log.event_data);
            return (
              <div key={log.id} className="flex items-center gap-0 px-4 py-1 font-mono text-[11px] hover:bg-[#161b22] transition-colors border-b border-[#21262d]">
                <span className="w-24 text-[#484f58] shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                <span className="w-32 shrink-0"><span className="text-[9px] font-mono px-1 py-0.5 rounded border border-[#30363d] text-[#8b949e]">{eventName}</span></span>
                <span className="w-32 font-mono text-[#58a6ff] shrink-0 truncate">{log.source_ip}</span>
                <span className="w-36 text-[#c9d1d9] shrink-0 truncate">{log.event_type}</span>
                <span className="flex-1 text-[#484f58] truncate">{detail}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
