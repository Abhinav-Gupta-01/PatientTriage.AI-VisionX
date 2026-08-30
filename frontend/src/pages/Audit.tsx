import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { useState } from "react";

function AuditDetails({ action, details }: { action: string; details: any }) {
  if (!details) return <span className="text-slate-400 italic">No details</span>;

  if (typeof details !== "object") {
    return <span>{String(details)}</span>;
  }

  // Format known structures
  if (action.startsWith("clinician_")) {
    return (
      <div className="space-y-1">
        {details.patient_code && <div><strong>Patient:</strong> {details.patient_code}</div>}
        {details.reason && <div><strong>Reason:</strong> {details.reason}</div>}
        {details.clinician_decision && (
          <div>
            <strong>Decision:</strong> Priority {details.clinician_decision.final_priority} 
            {details.clinician_decision.final_pathway ? ` (${details.clinician_decision.final_pathway})` : ""}
          </div>
        )}
        {details.ai_recommendation && (
          <div className="text-slate-400">
            <em>AI Rec: Priority {details.ai_recommendation.priority}</em>
          </div>
        )}
        {details.new_doctor_name ? (
          <div><strong>Assigned Doctor:</strong> {details.new_doctor_name}</div>
        ) : details.new_doctor_id ? (
          <div><strong>Assigned Doctor:</strong> {details.new_doctor_id}</div>
        ) : null}
        {details.new_nurse_name ? (
          <div><strong>Assigned Nurse:</strong> {details.new_nurse_name}</div>
        ) : details.new_nurse_id ? (
          <div><strong>Assigned Nurse:</strong> {details.new_nurse_id}</div>
        ) : null}
      </div>
    );
  }

  // Generic object formatting
  return (
    <ul className="list-none space-y-0.5 m-0 p-0">
      {Object.entries(details).map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          return (
            <li key={key}>
              <span className="font-medium text-slate-700 capitalize">{key.replace(/_/g, " ")}:</span>{" "}
              <span className="text-slate-500">{JSON.stringify(value)}</span>
            </li>
          );
        }
        return (
          <li key={key}>
            <span className="font-medium text-slate-700 capitalize">{key.replace(/_/g, " ")}:</span>{" "}
            <span className="text-slate-600">{String(value)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function Audit() {
  const { data } = useQuery({ queryKey:["audit"], queryFn: async()=>(await api.get("/audit-logs")).data });
  const [filter, setFilter] = useState("");
  const rows = (data || []).filter((r: any) => !filter || r.action.includes(filter) || (r.user_email||"").includes(filter));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <input placeholder="Filter by action or user..." value={filter} onChange={e=>setFilter(e.target.value)} className="px-3 py-2 border rounded w-64" />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b"><tr className="text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-3">Time</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Action</th><th className="px-4 py-3">Details</th>
          </tr></thead>
          <tbody>
            {rows.length===0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">No records</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">{r.user_email}</td>
                <td className="px-4 py-3"><span className="badge bg-indigo-100 text-indigo-700">{r.user_role}</span></td>
                <td className="px-4 py-3 font-semibold">{r.action}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <AuditDetails action={r.action} details={r.details} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}