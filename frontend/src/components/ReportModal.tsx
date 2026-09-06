"use client";

import { X } from "lucide-react";

interface ReportModalProps {
  markdown: string;
  filename: string;
  onClose: () => void;
}

export default function ReportModal({ markdown, filename, onClose }: ReportModalProps) {
  const downloadReport = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="flex max-h-full w-full max-w-4xl flex-col rounded border border-[#30363d] bg-[#161b22] shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 border-b border-[#30363d] px-4 py-3">
          <p className="flex-1 truncate font-mono text-xs text-[#c9d1d9]">{filename}</p>
          <button onClick={onClose} aria-label="Close report preview" className="rounded p-1 text-[#8b949e] transition-colors hover:bg-[#30363d] hover:text-[#e6edf3]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-[#0d1117] p-4 font-mono text-[11px] leading-relaxed text-[#c9d1d9]">{markdown}</pre>

        <div className="flex items-center justify-end gap-2 border-t border-[#30363d] px-4 py-3">
          <button onClick={onClose} className="rounded border border-[#30363d] px-3 py-1.5 text-[11px] text-[#8b949e] transition-colors hover:border-[#8b949e] hover:text-[#e6edf3]">Close</button>
          <button onClick={downloadReport} className="rounded border border-[#238636] bg-[#238636] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#2ea043]">Download .md</button>
        </div>
      </div>
    </div>
  );
}
