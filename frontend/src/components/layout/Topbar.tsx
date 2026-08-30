import { useState } from "react";
import { Search, Bell, Activity, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const { data: sim } = useQuery({ queryKey:["simstatus"], queryFn: async()=>(await api.get("/simulation/status")).data });
  const { data: alerts } = useQuery({ queryKey:["alertsCount"], queryFn: async()=>(await api.get("/alerts")).data });
  const active = (alerts||[]).filter((a:any)=>a.status==="active").length;

  return (
    <div className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-4 md:px-6 gap-3 md:gap-4 sticky top-0 z-20">
      {onMenuClick && (
        <button onClick={onMenuClick} className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden">
          <Menu size={20} />
        </button>
      )}

      <form onSubmit={e=>{e.preventDefault(); if(q.trim()) nav("/queue?q="+encodeURIComponent(q));}} className="flex-1 max-w-xl relative hidden sm:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search patients, alerts, clinicians..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors" />
      </form>
      
      <div className="flex-1 sm:hidden"></div>

      <div className="hidden lg:block text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-medium text-slate-600">
        Dept: <b className="text-slate-900">ED-Main</b> <span className="text-slate-300 mx-1">|</span> Shift: <b className="text-slate-900">Day</b>
      </div>

      {sim?.running && (
        <div className={"text-xs px-3 py-1.5 rounded-lg font-bold " + (sim.mode==="extreme"?"bg-red-100 text-red-700":sim.mode==="surge"?"bg-orange-100 text-orange-700":"bg-blue-100 text-blue-700")}>
          <Activity size={14} className="inline mr-1" /> {sim.mode.toUpperCase()} MODE
        </div>
      )}

      <button onClick={()=>nav("/alerts")} className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
        <Bell size={20} />
        {active > 0 && <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 border-2 border-white text-white text-[9px] font-bold flex items-center justify-center animate-pulse">{active}</span>}
      </button>
    </div>
  );
}
