import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { PriorityBadge, RiskBadge } from "../components/ui/Badges";
import { Link } from "react-router-dom";
import { Users, AlertTriangle, Clock, Activity, ShieldAlert, HeartPulse, CheckCircle2, Bell } from "lucide-react";

const COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6"];
const RISK_COLORS: any = { HIGH:"#ef4444", MEDIUM:"#f97316", LOW:"#22c55e" };

function Kpi({ label, value, hint, icon, colorClass }: any) {
  return (
    <div className="card p-5 relative overflow-hidden group">
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity duration-500 group-hover:opacity-30 ${colorClass || 'bg-indigo-500'}`} />
      
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</div>
          <div className="text-3xl font-display font-bold text-slate-800 tracking-tight">{value}</div>
          {hint && <div className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1">{hint}</div>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl bg-white shadow-sm ring-1 ring-inset ring-slate-100/50 ${colorClass ? colorClass.replace('bg-', 'text-') : 'text-slate-400'}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const { data: a, isLoading } = useQuery({ queryKey:["analytics"], queryFn: async()=>(await api.get("/analytics")).data });
  const { data: patientsData } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const response = await api.get("/patients");
      if (Array.isArray(response.data)) return response.data;
      if (Array.isArray(response.data?.patients)) return response.data.patients;
      return [];
    },
  });

  const patients = Array.isArray(patientsData) ? patientsData : [];
  if (isLoading) return <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>;

  const critical = (patients || []).filter((p: any) => p.triage?.priority === 1).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Command Center</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Real-time emergency department overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <Kpi label="Total Patients" value={a?.kpi.total_patients} icon={<Users size={20} />} colorClass="bg-blue-500" />
        <Kpi label="Critical (P1)" value={a?.kpi.critical} hint={<><AlertTriangle size={12}/> Immediate attention</>} icon={<Activity size={20} />} colorClass="bg-red-500" />
        <Kpi label="Waiting" value={a?.kpi.waiting} icon={<Clock size={20} />} colorClass="bg-amber-500" />
        <Kpi label="High Risk" value={a?.kpi.high_risk} icon={<HeartPulse size={20} />} colorClass="bg-orange-500" />
        
        <Kpi label="Avg Wait" value={a?.kpi.avg_wait + " min"} icon={<Clock size={20} />} colorClass="bg-indigo-500" />
        <Kpi label="Capacity" value={a?.kpi.capacity + "%"} icon={<ShieldAlert size={20} />} colorClass={a?.kpi.capacity > 90 ? "bg-red-500" : "bg-emerald-500"} />
        <Kpi label="AI Confidence" value={Math.round((a?.kpi.avg_confidence||0)*100) + "%"} icon={<CheckCircle2 size={20} />} colorClass="bg-teal-500" />
        <Kpi label="Active Alerts" value={a?.kpi.active_alerts} icon={<Bell size={20} />} colorClass="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <div className="card p-5">
          <div className="font-display font-bold text-slate-800 mb-4">Priority Distribution</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={a?.priority_distribution} dataKey="count" nameKey="priority" outerRadius={90} label>
                {(a?.priority_distribution || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="font-display font-bold text-slate-800 mb-4">Deterioration Risk</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={a?.risk_distribution} dataKey="count" nameKey="risk" outerRadius={90} label>
                {(a?.risk_distribution || []).map((r: any, i: number) => <Cell key={i} fill={RISK_COLORS[r.risk]} />)}
              </Pie>
              <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="font-display font-bold text-slate-800 mb-4">Critical Patients</div>
          {critical.length === 0 ? (
            <div className="text-sm font-medium text-slate-400 text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">No P1 patients</div>
          ) : (
            <div className="space-y-2">
              {critical.map((p: any) => (
                <Link to={"/patient/"+p.id} key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group">
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{p.patient_code}</div>
                    <div className="text-xs font-medium text-slate-500 mt-0.5">{p.chief_complaint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge p={p.triage?.priority} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}