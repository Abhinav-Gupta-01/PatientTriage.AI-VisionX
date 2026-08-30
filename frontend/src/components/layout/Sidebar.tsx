import { NavLink, useLocation } from "react-router-dom";
import { Activity, Users, Stethoscope, UserPlus, Bell, BarChart3, FileText, Zap, Settings, HeartPulse, LogOut, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const items = [
  { to: "/", label: "Command Center", icon: Activity },
  { to: "/queue", label: "Patient Queue", icon: Users },
  { to: "/queue?tab=in_treatment", label: "In Treatment", icon: Stethoscope },
  { to: "/add", label: "Add Patient", icon: UserPlus },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/audit", label: "Audit Logs", icon: FileText },
  { to: "/simulation", label: "Simulation", icon: Zap },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/health", label: "System Health", icon: HeartPulse }
];

export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (v: boolean) => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200 flex flex-col h-screen
      transition-transform duration-300 ease-in-out md:static md:translate-x-0
      ${isOpen ? "translate-x-0" : "-translate-x-full"}
    `}>
      <div className="p-5 border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-display font-bold shadow-md shadow-indigo-200">
            P
          </div>
          <div>
            <div className="font-display font-bold text-slate-900 tracking-tight text-lg leading-tight">PatientTriage<span className="text-indigo-600">.ai</span></div>
            <div className="text-xs text-slate-500 font-medium">Command Center</div>
          </div>
        </div>
        
        {setIsOpen && (
          <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 md:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const isExactActive = to.includes('?') 
            ? location.pathname + location.search === to
            : location.pathname === to && (location.search === '' || !to.startsWith('/queue'));
            
          return (
            <NavLink key={to} to={to} onClick={() => setIsOpen?.(false)} className={() =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ` + 
              (isExactActive 
                ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-100/50" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
            }>
              <Icon size={18} className="transition-transform duration-200 group-hover:scale-110" /> 
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200/60 space-y-3 bg-slate-50/50">
        <div className="px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Signed in as</div>
          <div className="text-sm font-bold text-slate-800 truncate">{user?.full_name}</div>
          <div className="text-xs font-semibold text-indigo-600 uppercase mt-0.5">{user?.role}</div>
        </div>
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
}
