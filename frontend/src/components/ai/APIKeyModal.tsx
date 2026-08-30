"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Bot, Check, ChevronDown, ExternalLink, Eye, EyeOff, Key, Trash2, X } from "lucide-react";
import type { AIKeyConfig, AIProvider } from "@/types";
import { AI_PROVIDERS, clearAIKeyConfig, loadAIKeyConfig, saveAIKeyConfig } from "@/lib/api";
interface APIKeyModalProps{isOpen:boolean;onClose:()=>void;onSave:(config:AIKeyConfig)=>void;}
export default function APIKeyModal({isOpen,onClose,onSave}:APIKeyModalProps){
  const [provider,setProvider]=useState<AIProvider>("groq");
  const [apiKey,setApiKey]=useState("");
  const [showKey,setShowKey]=useState(false);
  const [saved,setSaved]=useState(false);
  const [hasExisting,setHasExisting]=useState(false);
  useEffect(()=>{if(!isOpen)return;const s=loadAIKeyConfig();if(s){setProvider(s.provider);setApiKey(s.key);setHasExisting(true);}else{setHasExisting(false);}setSaved(false);setShowKey(false);},[isOpen]);
  if(!isOpen)return null;
  const currentProvider=AI_PROVIDERS[provider];
  const isValid=apiKey.trim().length>10;
  function handleSave(){if(!isValid)return;const config:AIKeyConfig={provider,key:apiKey.trim()};saveAIKeyConfig(config);onSave(config);setSaved(true);setHasExisting(true);setTimeout(onClose,900);}
  function handleClear(){clearAIKeyConfig();setApiKey("");setHasExisting(false);setSaved(false);}
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={(e)=>e.target===e.currentTarget&&onClose()}>
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-700/60"><div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20"><Bot className="w-5 h-5 text-cyan-400"/></div><div className="flex-1 min-w-0"><h2 className="text-sm font-semibold text-slate-100">AI Copilot — API Key</h2><p className="text-xs text-slate-400">BYOK · Key stored locally, never on our servers</p></div><button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800"><X className="w-4 h-4"/></button></div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex gap-3 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20"><AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"/><p className="text-xs text-amber-200/80 leading-relaxed">Your API key is saved only in <code className="text-amber-300 bg-amber-900/30 px-1 rounded">localStorage</code>. It is forwarded directly to <span className="text-amber-300 font-medium">{currentProvider.label}</span> for analysis.</p></div>
          <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">AI Provider</label><div className="relative"><select value={provider} onChange={(e)=>setProvider(e.target.value as AIProvider)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-pointer">{(Object.keys(AI_PROVIDERS) as AIProvider[]).map((p)=><option key={p} value={p}>{AI_PROVIDERS[p].label}</option>)}</select><ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"/></div><a href={currentProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"><ExternalLink className="w-3 h-3"/>Get a free key</a></div>
          <div className="space-y-1.5"><label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">API Key</label><div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"/><input type={showKey?"text":"password"} value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder={currentProvider.placeholder} autoComplete="off" className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"/><button type="button" onClick={()=>setShowKey(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showKey?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div></div>
        </div>
        <div className="flex items-center gap-3 px-6 pb-6">{hasExisting&&<button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"><Trash2 className="w-3.5 h-3.5"/>Remove key</button>}<div className="flex-1"/><button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800">Cancel</button><button onClick={handleSave} disabled={!isValid||saved} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${saved?"bg-emerald-600/20 text-emerald-400 border border-emerald-500/30":isValid?"bg-cyan-600 hover:bg-cyan-500 text-white":"bg-slate-700 text-slate-500 cursor-not-allowed"}`}>{saved?<><Check className="w-4 h-4"/>Saved</>:<><Key className="w-4 h-4"/>Save key</>}</button></div>
      </div>
    </div>
  );
}
