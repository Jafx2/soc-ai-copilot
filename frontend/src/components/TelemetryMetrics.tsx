"use client";

/**
 * TelemetryMetrics — SOC AI Copilot
 * Real-time EPS stream + severity breakdown, fed from the WebSocket event bus.
 *
 * Usage in page.tsx:
 *   import TelemetryMetrics from "@/components/TelemetryMetrics";
 *   <TelemetryMetrics events={events} isRunning={isRunning} />
 */

import { useMemo } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
} from "recharts";
import type { WsEvent, WsIncidentOpen } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EpsPoint {
    ts: string;      // "hh:mm:ss"
    eps: number;     // event count in that second bucket
}

interface SevPoint {
    severity: string;
    count: number;
    fill: string;
}

interface Props {
    events: WsEvent[];
    isRunning: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW = 24; // number of EPS buckets to keep visible

const SEV_META: Record<string, { fill: string; border: string }> = {
    LOW: { fill: "#1d6a3a", border: "#3fb950" },
    MEDIUM: { fill: "#1c4a8a", border: "#58a6ff" },
    HIGH: { fill: "#7a5200", border: "#d29922" },
    CRITICAL: { fill: "#7a1a1a", border: "#da3633" },
};

// ─── Tooltip styles ───────────────────────────────────────────────────────────

const tooltipStyle = {
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "4px",
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#c9d1d9",
    padding: "6px 10px",
};

const tooltipLabelStyle = {
    color: "#8b949e",
    marginBottom: "2px",
};

// ─── Custom EPS Tooltip ───────────────────────────────────────────────────────

function EpsTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div style={tooltipStyle}>
            <p style={tooltipLabelStyle}>{label}</p>
            <p style={{ color: "#3fb950" }}>{payload[0].value} events</p>
        </div>
    );
}

// ─── Custom Severity Tooltip ──────────────────────────────────────────────────

function SevTooltip({ active, payload }: {
    active?: boolean;
    payload?: { payload: SevPoint }[];
}) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div style={tooltipStyle}>
            <p style={{ color: SEV_META[d.severity]?.border ?? "#c9d1d9" }}>
                {d.severity}
            </p>
            <p style={{ color: "#e6edf3" }}>{d.count} incident{d.count !== 1 ? "s" : ""}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TelemetryMetrics({ events, isRunning }: Props) {

    // ── Derived metrics ────────────────────────────────────────────────────────

    const totalEvents = events.length;

    const incidents = useMemo(
        () => events.filter(e => e.type === "INCIDENT_OPEN") as WsIncidentOpen[],
        [events]
    );

    const activeAttacks = incidents.length;

    const avgRisk = useMemo(() => {
        if (!incidents.length) return 0;
        const sum = incidents.reduce((a, e) => a + (e.risk_score ?? 0), 0);
        return Math.round(sum / incidents.length);
    }, [incidents]);

    // ── EPS stream (sliding window, last WINDOW seconds with data) ─────────────

    const epsData = useMemo<EpsPoint[]>(() => {
        if (!events.length) return [];

        // bucket events by second using their timestamp when available
        const buckets: Record<string, number> = {};

        events.forEach((ev) => {
            const raw = (ev as Record<string, unknown>).timestamp as string | undefined;
            let key: string;
            if (raw) {
                const d = new Date(raw);
                key = d.toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                });
            } else {
                key = "--:--:--";
            }
            buckets[key] = (buckets[key] ?? 0) + 1;
        });

        const sorted = Object.entries(buckets)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([ts, eps]) => ({ ts, eps }));

        // keep last WINDOW buckets
        return sorted.slice(-WINDOW);
    }, [events]);

    // ── Severity breakdown ─────────────────────────────────────────────────────

    const sevData = useMemo<SevPoint[]>(() => {
        const counts: Record<string, number> = {
            LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
        };
        incidents.forEach(e => {
            const s = e.severity ?? "LOW";
            if (s in counts) counts[s]++;
        });
        return (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map(s => ({
            severity: s,
            count: counts[s],
            fill: SEV_META[s].border,
        }));
    }, [incidents]);

    // ── Risk color ─────────────────────────────────────────────────────────────

    const riskColor =
        avgRisk >= 80 ? "#da3633" : avgRisk >= 60 ? "#d29922" : "#3fb950";

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div
            className="border-b border-[#30363d] bg-[#0d1117] shrink-0"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
            {/* Header row */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-[#30363d] bg-[#161b22]">

                {/* WS live badge */}
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        {isRunning && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-75" />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? "bg-[#3fb950]" : "bg-[#30363d]"}`} />
                    </span>
                    <span className="text-[10px] font-mono text-[#8b949e]">
                        {isRunning ? "LIVE WS STREAM" : "STREAM IDLE"}
                    </span>
                </div>

                <span className="text-[#30363d] text-xs">|</span>

                {/* Quick metrics */}
                <MetricBadge label="Total Events" value={String(totalEvents)} color="#8b949e" />
                <MetricBadge label="Active Attacks" value={String(activeAttacks)} color={activeAttacks > 0 ? "#da3633" : "#8b949e"} />
                <MetricBadge
                    label="Avg Risk"
                    value={avgRisk > 0 ? `${avgRisk}/100` : "--"}
                    color={avgRisk > 0 ? riskColor : "#8b949e"}
                />

                <div className="flex-1" />
                <span className="text-[9px] text-[#484f58] font-mono uppercase tracking-wider">
                    Telemetry Analytics — last {WINDOW}s window
                </span>
            </div>

            {/* Chart row */}
            <div className="grid gap-0" style={{ gridTemplateColumns: "1fr 240px" }}>

                {/* EPS Area Chart */}
                <div className="px-4 pt-3 pb-2 border-r border-[#30363d]">
                    <p className="text-[9px] text-[#484f58] uppercase tracking-widest mb-2">
                        Events Per Second — EPS Stream
                    </p>
                    {epsData.length === 0 ? (
                        <EmptyChart label="Waiting for events" height={72} />
                    ) : (
                        <ResponsiveContainer width="100%" height={72}>
                            <AreaChart data={epsData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="epsGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#238636" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#238636" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="ts"
                                    tick={{ fontSize: 8, fill: "#484f58", fontFamily: "monospace" }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 8, fill: "#484f58", fontFamily: "monospace" }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                    width={28}
                                />
                                <Tooltip content={<EpsTooltip />} cursor={{ stroke: "#30363d", strokeWidth: 1 }} />
                                <Area
                                    type="monotone"
                                    dataKey="eps"
                                    stroke="#3fb950"
                                    strokeWidth={1.5}
                                    fill="url(#epsGrad)"
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Severity BarChart */}
                <div className="px-4 pt-3 pb-2">
                    <p className="text-[9px] text-[#484f58] uppercase tracking-widest mb-2">
                        Threat Severity Breakdown
                    </p>
                    {activeAttacks === 0 ? (
                        <EmptyChart label="No incidents" height={72} />
                    ) : (
                        <ResponsiveContainer width="100%" height={72}>
                            <BarChart
                                data={sevData}
                                layout="vertical"
                                margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                                barSize={8}
                            >
                                <XAxis
                                    type="number"
                                    tick={{ fontSize: 8, fill: "#484f58", fontFamily: "monospace" }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="severity"
                                    tick={{ fontSize: 8, fill: "#8b949e", fontFamily: "monospace" }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={52}
                                />
                                <Tooltip content={<SevTooltip />} cursor={{ fill: "#161b22" }} />
                                <Bar dataKey="count" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                                    {sevData.map((entry) => (
                                        <Cell
                                            key={entry.severity}
                                            fill={SEV_META[entry.severity]?.border ?? "#8b949e"}
                                            fillOpacity={entry.count > 0 ? 1 : 0.2}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricBadge({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-mono font-bold" style={{ color }}>
                {value}
            </span>
            <span className="text-[9px] text-[#484f58]">{label}</span>
        </div>
    );
}

function EmptyChart({ label, height }: { label: string; height: number }) {
    return (
        <div
            className="flex items-center justify-center border border-dashed border-[#21262d] rounded"
            style={{ height }}
        >
            <span className="text-[9px] text-[#484f58] font-mono">{label}</span>
        </div>
    );
}