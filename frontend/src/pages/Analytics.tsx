import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  AlertTriangle,
  Activity,
  RefreshCw,
  BarChart3,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| Configuration & Colors
|--------------------------------------------------------------------------
*/

const PRIORITY_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];
const RISK_COLORS: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f97316",
  LOW: "#22c55e",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

/*
|--------------------------------------------------------------------------
| Custom Components
|--------------------------------------------------------------------------
*/

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl ring-1 ring-slate-200/50 border-none min-w-[150px]">
        <p className="text-sm font-bold text-slate-800 mb-2">{label || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-slate-500 capitalize">{entry.name || 'Count'}</span>
            <span className="text-sm font-bold" style={{ color: entry.color || entry.payload.fill }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function KpiCard({ title, value, icon: Icon, color }: any) {
  return (
    <motion.div variants={itemVariants} className="card p-5 relative overflow-hidden group">
      {/* Background Glow */}
      <div
        className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity duration-500 group-hover:opacity-20"
        style={{ backgroundColor: color }}
      />
      
      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            {title}
          </div>
          <div
            className="p-2 rounded-lg bg-opacity-10 backdrop-blur-sm"
            style={{ backgroundColor: `${color}1A`, color: color }}
          >
            <Icon size={18} strokeWidth={2.5} />
          </div>
        </div>
        
        <div className="text-4xl font-display font-bold text-slate-800 tracking-tight">
          {value}
        </div>
      </div>
    </motion.div>
<<<<<<< Updated upstream
=======
  );
}

/*
|--------------------------------------------------------------------------
| Main Analytics Component
|--------------------------------------------------------------------------
*/

export default function Analytics() {
  const { data: a, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => (await api.get("/analytics")).data,
    refetchInterval: 15000,
  });

  if (isLoading || !a) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
          <div className="text-sm font-semibold text-slate-500 animate-pulse">Compiling analytics...</div>
        </div>
      </div>
    );
  }

  // Ensure robust data mappings
  const priorityData = a.priority_distribution?.map((d: any) => ({
    name: `Priority ${d.priority}`,
    count: d.count,
    fill: PRIORITY_COLORS[d.priority - 1] || "#94a3b8"
  })) || [];

  const riskData = a.risk_distribution?.map((d: any) => ({
    name: d.risk.charAt(0) + d.risk.slice(1).toLowerCase() + " Risk",
    count: d.count,
    fill: RISK_COLORS[d.risk] || "#94a3b8"
  })) || [];

  const waitData = a.waiting_by_priority?.map((d: any) => ({
    priority: `P${d.priority}`,
    avg: Math.round(d.avg),
  })) || [];

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="space-y-6 pb-12"
    >
      {/* HEADER */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-inner">
          <BarChart3 className="text-indigo-600" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
            Performance Analytics
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time metrics and historical patient flows
          </p>
        </div>
      </motion.div>

      {/* KPI GRID */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">
        <KpiCard
          title="Total Patients"
          value={a.kpi.total_patients || 0}
          icon={Users}
          color="#3b82f6"
        />
        <KpiCard
          title="Avg Wait Time"
          value={`${a.kpi.avg_wait || 0}m`}
          icon={Clock}
          color="#8b5cf6"
        />
        <KpiCard
          title="Longest Wait"
          value={`${a.kpi.longest_wait || 0}m`}
          icon={AlertTriangle}
          color="#f43f5e"
        />
        <KpiCard
          title="Critical (P1+P2)"
          value={a.kpi.p1_p2_count || 0}
          icon={Activity}
          color="#ef4444"
        />
        <KpiCard
          title="Reassessments"
          value={a.kpi.reassessments || 0}
          icon={RefreshCw}
          color="#f59e0b"
        />
      </motion.div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
        
        {/* PRIORITY DONUT CHART */}
        <motion.div variants={itemVariants} className="card p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-display font-bold text-slate-800">Priority Distribution</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Patient volume segmented by clinical acuity</p>
          </div>
          <div className="flex-1 min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {priorityData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* RISK DONUT CHART */}
        <motion.div variants={itemVariants} className="card p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-display font-bold text-slate-800">Deterioration Risk</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">AI-assessed risk of clinical deterioration while waiting</p>
          </div>
          <div className="flex-1 min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {riskData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* WAITING TIME BAR CHART */}
        <motion.div variants={itemVariants} className="card p-6 xl:col-span-2">
          <div className="mb-6">
            <h3 className="text-lg font-display font-bold text-slate-800">Average Waiting Time by Priority</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Time elapsed in minutes before clinical review</p>
          </div>
          <div className="min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waitData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="priority" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 600 }} 
                  dy={16} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} 
                  dx={-10} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  content={<CustomTooltip />} 
                />
                <Bar 
                  dataKey="avg" 
                  name="Avg Wait (min)"
                  fill="url(#barGradient)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={60}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>
    </motion.div>
>>>>>>> Stashed changes
  );
}

/*
|--------------------------------------------------------------------------
| Main Analytics Component
|--------------------------------------------------------------------------
*/

export default function Analytics() {
  const { data: a, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => (await api.get("/analytics")).data,
    refetchInterval: 15000,
  });

  if (isLoading || !a) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
          <div className="text-sm font-semibold text-slate-500 animate-pulse">Compiling analytics...</div>
        </div>
      </div>
    );
  }

  // Ensure robust data mappings
  const priorityData = a.priority_distribution?.map((d: any) => ({
    name: `Priority ${d.priority}`,
    count: d.count,
    fill: PRIORITY_COLORS[d.priority - 1] || "#94a3b8"
  })) || [];

  const riskData = a.risk_distribution?.map((d: any) => ({
    name: d.risk.charAt(0) + d.risk.slice(1).toLowerCase() + " Risk",
    count: d.count,
    fill: RISK_COLORS[d.risk] || "#94a3b8"
  })) || [];

  const waitData = a.waiting_by_priority?.map((d: any) => ({
    priority: `P${d.priority}`,
    avg: Math.round(d.avg),
  })) || [];

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={containerVariants}
      className="space-y-6 pb-12"
    >
      {/* HEADER */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-inner">
          <BarChart3 className="text-indigo-600" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
            Performance Analytics
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time metrics and historical patient flows
          </p>
        </div>
      </motion.div>

      {/* KPI GRID */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">
        <KpiCard
          title="Total Patients"
          value={a.kpi.total_patients || 0}
          icon={Users}
          color="#3b82f6"
        />
        <KpiCard
          title="Avg Wait Time"
          value={`${a.kpi.avg_wait || 0}m`}
          icon={Clock}
          color="#8b5cf6"
        />
        <KpiCard
          title="Longest Wait"
          value={`${a.kpi.longest_wait || 0}m`}
          icon={AlertTriangle}
          color="#f43f5e"
        />
        <KpiCard
          title="Critical (P1+P2)"
          value={a.kpi.p1_p2_count || 0}
          icon={Activity}
          color="#ef4444"
        />
        <KpiCard
          title="Reassessments"
          value={a.kpi.reassessments || 0}
          icon={RefreshCw}
          color="#f59e0b"
        />
      </motion.div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
        
        {/* PRIORITY DONUT CHART */}
        <motion.div variants={itemVariants} className="card p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-display font-bold text-slate-800">Priority Distribution</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Patient volume segmented by clinical acuity</p>
          </div>
          <div className="flex-1 min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {priorityData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* RISK DONUT CHART */}
        <motion.div variants={itemVariants} className="card p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-display font-bold text-slate-800">Deterioration Risk</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">AI-assessed risk of clinical deterioration while waiting</p>
          </div>
          <div className="flex-1 min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {riskData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* WAITING TIME BAR CHART */}
        <motion.div variants={itemVariants} className="card p-6 xl:col-span-2">
          <div className="mb-6">
            <h3 className="text-lg font-display font-bold text-slate-800">Average Waiting Time by Priority</h3>
            <p className="text-xs font-medium text-slate-400 mt-1">Time elapsed in minutes before clinical review</p>
          </div>
          <div className="min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waitData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="priority" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 600 }} 
                  dy={16} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} 
                  dx={-10} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  content={<CustomTooltip />} 
                />
                <Bar 
                  dataKey="avg" 
                  name="Avg Wait (min)"
                  fill="url(#barGradient)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={60}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}