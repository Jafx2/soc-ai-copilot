import type { AIAnalysis, AIKeyConfig, AIProvider, AttackVector, BlockedIP, Incident, WsEvent } from "@/types";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = BASE_URL.replace(/^http/, "ws");
const LS_KEY = "soc_ai_key_config";
export function saveAIKeyConfig(config: AIKeyConfig): void { localStorage.setItem(LS_KEY, JSON.stringify(config)); }
export function loadAIKeyConfig(): AIKeyConfig | null { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) as AIKeyConfig : null; } catch { return null; } }
export function clearAIKeyConfig(): void { localStorage.removeItem(LS_KEY); }
export const AI_PROVIDERS: Record<AIProvider, { label: string; placeholder: string; docsUrl: string }> = { groq: { label: "Groq (Llama 3 — Free)", placeholder: "gsk_...", docsUrl: "https://console.groq.com/keys" }, openai: { label: "OpenAI (GPT-4o-mini)", placeholder: "sk-...", docsUrl: "https://platform.openai.com/api-keys" }, deepseek: { label: "DeepSeek (Chat)", placeholder: "sk-...", docsUrl: "https://platform.deepseek.com" }, gemini: { label: "Google Gemini", placeholder: "AIza...", docsUrl: "https://aistudio.google.com/app/apikey" } };
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> { const res = await fetch(`${BASE_URL}${path}`, { headers: { "Content-Type": "application/json", ...init?.headers }, ...init }); if (!res.ok) { const text = await res.text(); throw new Error(`API ${res.status}: ${text}`); } return res.json() as Promise<T>; }
export const api = {
  async simulate(attack_type: AttackVector, source_ip?: string): Promise<{ incident_id: string; source_ip: string }> { return apiFetch("/api/simulate", { method: "POST", body: JSON.stringify({ attack_type, source_ip }) }); },
  async analyze(incident_id: string, attack_type: AttackVector, raw_log: Record<string, unknown>, aiConfig: AIKeyConfig): Promise<AIAnalysis> { return apiFetch("/api/analyze", { method: "POST", headers: { "X-AI-Key": aiConfig.key, "X-AI-Provider": aiConfig.provider }, body: JSON.stringify({ incident_id, attack_type, raw_log }) }); },
  async incidents(limit = 20): Promise<Incident[]> { return apiFetch(`/api/incidents?limit=${limit}`); },
  async blockedIPs(): Promise<BlockedIP[]> { return apiFetch("/api/blocked-ips"); }
};
export interface SimulationSocket { send: (attack_type: AttackVector, incident_id: string, source_ip: string) => void; close: () => void; }
export function createSimulationSocket(onEvent: (event: WsEvent) => void, onClose?: () => void): SimulationSocket {
  const ws = new WebSocket(`${WS_URL}/ws/telemetry`);
  ws.onmessage = (msg) => { try { const event = JSON.parse(msg.data as string) as WsEvent; onEvent(event); } catch { } };
  ws.onclose = () => onClose?.();
  return { send(attack_type, incident_id, source_ip) { if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ attack_type, incident_id, source_ip })); } }, close() { ws.close(); } };
}
