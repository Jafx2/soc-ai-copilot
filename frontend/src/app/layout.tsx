import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOC AI Copilot",
  description: "Real-time threat simulation and AI-powered incident triage dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="antialiased bg-[#070b12] text-slate-100 h-full overflow-hidden">
        {children}
      </body>
    </html>
  );
}