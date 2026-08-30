import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ children }: any) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50/50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:px-8 max-w-[1600px] mx-auto">
            <div className="mb-4 text-sm font-medium text-amber-800 bg-amber-50/80 backdrop-blur border border-amber-200/50 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <div>
                PatientTriage.ai is a clinical decision-support prototype using simulated data. It does not diagnose, prescribe treatment, or replace qualified clinical judgment.
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
