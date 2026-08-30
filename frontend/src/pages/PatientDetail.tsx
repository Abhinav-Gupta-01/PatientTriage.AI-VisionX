import { useParams } from "react-router-dom";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import {
  PriorityBadge,
  RiskBadge,
  ConfidenceBar,
  NewsBadge,
  NewsTrendBadge,
} from "../components/ui/Badges";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import ClinicianDecisionPanel from "../components/patients/ClinicianDecisionPanel";
import DeteriorationTimeline from "../components/patients/DeteriorationTimeline";

/* =========================================================
   TYPES
========================================================= */

type Patient = {
  id?: string;
  patient_code?: string;

  age?: number;
  sex?: string;
  chief_complaint?: string;
  symptoms?: string;

  status?: string;
  waiting_minutes?: number;

  medical_history?: string;
  allergies?: string;
  pain_score?: number;

  latest_triage?: any;
  triage?: any;

  latest_vitals?: any;

  vitals?: any;
  news?: any;
  news_trend?: any;
  news_direction?: string;

  alerts?: any;
  triages?: any;
  decisions?: any;

  [key: string]: any;
};

/* =========================================================
   SAFE ARRAY HELPER

   Backend data can sometimes arrive as:

   []
   { data: [] }
   { items: [] }
   null
   undefined

   This prevents .map() / .filter() crashes.
========================================================= */

function safeArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value.data)) {
    return value.data;
  }

  if (value && Array.isArray(value.items)) {
    return value.items;
  }

  if (value && Array.isArray(value.rows)) {
    return value.rows;
  }

  return [];
}

/* =========================================================
   NORMALIZE PATIENT RESPONSE
========================================================= */

function normalizePatientResponse(responseData: any): Patient | null {
  if (!responseData) {
    return null;
  }

  /*
   * Possible backend responses:
   *
   * { patient: {...}, vitals: {...}, triage: {...} }
   * { data: {...} }
   * {...patient object...}
   */

  let patient = responseData;

  /*
   * The backend returns { patient, vitals, triage } as siblings.
   * Extract the patient and merge sibling vitals/triage into it.
   */
  let siblingVitals: any = null;
  let siblingTriage: any = null;

  if (
    responseData.patient &&
    typeof responseData.patient === "object"
  ) {
    patient = responseData.patient;
    siblingVitals = responseData.vitals ?? null;
    siblingTriage = responseData.triage ?? null;
  } else if (
    responseData.data &&
    typeof responseData.data === "object" &&
    !Array.isArray(responseData.data)
  ) {
    patient = responseData.data;
  }

  if (!patient || typeof patient !== "object") {
    return null;
  }

  /*
   * Merge sibling triage/vitals into the patient if the patient
   * doesn't already have them.
   */
  const mergedLatestTriage =
    patient.latest_triage ?? patient.triage ?? siblingTriage ?? null;

  const mergedLatestVitals =
    patient.latest_vitals ?? siblingVitals ?? null;

  return {
    ...patient,

    /*
     * Always normalize array-like fields.
     */

    vitals: safeArray(patient.vitals),

    alerts: safeArray(patient.alerts),

    triages: safeArray(
      patient.triages ?? patient.triage_history
    ),

    decisions: safeArray(
      patient.decisions ??
        patient.clinician_decisions
    ),

    news_trend: safeArray(
      patient.news_trend ??
        patient.newsTrend
    ),

    /*
     * Sometimes latest_triage may arrive as an array.
     */

    latest_triage: Array.isArray(mergedLatestTriage)
      ? mergedLatestTriage[mergedLatestTriage.length - 1]
      : mergedLatestTriage,

    /*
     * Sometimes latest_vitals may arrive as an array.
     */

    latest_vitals: Array.isArray(mergedLatestVitals)
      ? mergedLatestVitals[mergedLatestVitals.length - 1]
      : mergedLatestVitals,
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function PatientDetail() {
  const { id } = useParams();

  const { user } = useAuth();

  const qc = useQueryClient();

  /* =====================================================
     PATIENT QUERY
  ===================================================== */

  const {
    data: p,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery<Patient | null>({
    queryKey: ["patient", id],

    enabled: Boolean(id),

    queryFn: async () => {
      if (!id) {
        return null;
      }

      const response = await api.get(
        "/patients/" + id
      );

      console.log(
        "PATIENT DETAIL RESPONSE:",
        response.data
      );

      return normalizePatientResponse(
        response.data
      );
    },

    refetchInterval: 5000,

    refetchIntervalInBackground: false,
  });

  /* =====================================================
     STATES
  ===================================================== */

  const [metric, setMetric] =
    useState("heart_rate");

  const [overrideOpen, setOverrideOpen] =
    useState(false);

  const [action, setAction] = useState<
    "ACCEPT" |
    "MODIFY" |
    "OVERRIDE"
  >("ACCEPT");

  const [newPriority, setNewPriority] =
    useState(3);

  const [reason, setReason] =
    useState("");

  const [flowLoading, setFlowLoading] =
    useState(false);

  const [reassessOpen, setReassessOpen] = useState(false);
  const [reassessForm, setReassessForm] = useState({
    heart_rate: "",
    systolic_bp: "",
    diastolic_bp: "",
    spo2: "",
    respiratory_rate: "",
    temperature: "",
    reason: "",
  });

  /* =====================================================
     LOADING
  ===================================================== */

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading patient...
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (isError) {
    console.error(
      "PATIENT DETAIL ERROR:",
      error
    );

    return (
      <div className="p-8">
        <div className="card p-6 border border-red-200 bg-red-50">
          <div className="font-semibold text-red-700">
            Failed to load patient
          </div>

          <div className="text-sm text-red-600 mt-1">
            Please refresh the page and try again.
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     NOT FOUND
  ===================================================== */

  if (!p) {
    return (
      <div className="p-8 text-center text-slate-500">
        Patient not found
      </div>
    );
  }

  /* =====================================================
     SAFE DATA
  ===================================================== */

  const vitals = safeArray(p.vitals);

  const alerts = safeArray(p.alerts);

  const triages = safeArray(p.triages);

  const decisions = safeArray(p.decisions);

  const newsTrend = safeArray(
    p.news_trend
  );

  /* =====================================================
     TRIAGE
  ===================================================== */

  const t =
    p.latest_triage ??
    p.triage ??
    null;

  /* =====================================================
     PERMISSIONS
  ===================================================== */

  const role =
    String(user?.role || "").toLowerCase();

  const canDecide =
    role === "doctor" ||
    role === "admin";

  const canAccept =
    role === "doctor" ||
    role === "nurse";

  /* =====================================================
     PATIENT STATUS
  ===================================================== */

  const patientStatus =
    String(p.status || "Waiting").toLowerCase();

  const isWaiting =
    patientStatus === "waiting" ||
    patientStatus === "queued" ||
    patientStatus === "in_queue";

  const isAccepted =
    patientStatus === "accepted" ||
    patientStatus === "in treatment" ||
    patientStatus === "in_treatment" ||
    patientStatus === "active" ||
    patientStatus === "processing";

  const isCompleted =
    patientStatus === "completed";

  const isDischarged =
    patientStatus === "discharged";

  /* =====================================================
     REASSESSMENT TIMER
  ===================================================== */
  
  const reassessMins = t?.reassessment_minutes;
  const timeRemaining = reassessMins !== undefined && reassessMins !== null
    ? reassessMins - (p.waiting_minutes ?? 0)
    : null;
  const isOverdue = isWaiting && timeRemaining !== null && timeRemaining <= 0;

  /* =====================================================
     REASSESS
  ===================================================== */

  const submitReassess = async () => {
    try {
      setFlowLoading(true);
      await api.post("/patients/" + id + "/reassess", reassessForm);

      await qc.invalidateQueries({ queryKey: ["patient", id] });
      await qc.invalidateQueries({ queryKey: ["patients"] });
      
      setReassessOpen(false);
      setReassessForm({
        heart_rate: "",
        systolic_bp: "",
        diastolic_bp: "",
        spo2: "",
        respiratory_rate: "",
        temperature: "",
        reason: "",
      });
    } catch (err) {
      console.error("REASSESS ERROR:", err);
    } finally {
      setFlowLoading(false);
    }
  };

  /* =====================================================
     ACCEPT PATIENT
     
     IMPORTANT:
     This is what removes the patient from the
     Waiting queue after successful acceptance.
  ===================================================== */

  const acceptPatient = async () => {
    if (!id || flowLoading) {
      return;
    }

    try {
      setFlowLoading(true);

      await api.post(
        "/patients/" +
          id +
          "/accept"
      );

      /*
       * Refresh patient detail.
       */

      await qc.invalidateQueries({
        queryKey: ["patient", id],
      });

      /*
       * VERY IMPORTANT:
       * Refresh queue data.
       *
       * This makes the accepted patient disappear
       * from Queue.tsx if Queue only displays Waiting.
       */

      await qc.invalidateQueries({
        queryKey: ["patients"],
      });
    } catch (err: any) {
      console.error(
        "ACCEPT PATIENT ERROR:",
        err
      );

      console.error(
        "SERVER RESPONSE:",
        err?.response?.data
      );

      alert(
        err?.response?.data?.message ||
          "Failed to accept patient"
      );
    } finally {
      setFlowLoading(false);
    }
  };

  /* =====================================================
     COMPLETE PATIENT
  ===================================================== */

  const completePatient = async () => {
    if (!id || flowLoading) {
      return;
    }

    try {
      setFlowLoading(true);

      await api.post(
        "/patients/" +
          id +
          "/complete"
      );

      await qc.invalidateQueries({
        queryKey: ["patient", id],
      });

      await qc.invalidateQueries({
        queryKey: ["patients"],
      });
    } catch (err: any) {
      console.error(
        "COMPLETE PATIENT ERROR:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to complete patient"
      );
    } finally {
      setFlowLoading(false);
    }
  };

  /* =====================================================
     DISCHARGE PATIENT
  ===================================================== */

  const dischargePatient = async () => {
    if (!id || flowLoading) {
      return;
    }

    try {
      setFlowLoading(true);

      await api.post(
        "/patients/" +
          id +
          "/discharge"
      );

      await qc.invalidateQueries({
        queryKey: ["patient", id],
      });

      await qc.invalidateQueries({
        queryKey: ["patients"],
      });
    } catch (err: any) {
      console.error(
        "DISCHARGE PATIENT ERROR:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to discharge patient"
      );
    } finally {
      setFlowLoading(false);
    }
  };

  /* =====================================================
     EXISTING DECISION
  ===================================================== */

  const decide = async () => {
    if (!id) {
      return;
    }

    try {
      await api.post(
        "/patients/" +
          id +
          "/decision",
        {
          action,

          new_priority:
            action === "ACCEPT"
              ? Number(
                  t?.priority ??
                    newPriority
                )
              : newPriority,

          reason,
        }
      );

      setOverrideOpen(false);

      setReason("");

      await qc.invalidateQueries({
        queryKey: ["patient", id],
      });

      await qc.invalidateQueries({
        queryKey: ["patients"],
      });
    } catch (err: any) {
      console.error(
        "DECISION ERROR:",
        err
      );

      alert(
        err?.response?.data?.message ||
          "Failed to save decision"
      );
    }
  };

  /* =====================================================
     VITALS DATA
  ===================================================== */

  const vitalsData = vitals.map(
    (v: any) => ({
      time: v?.recorded_at
        ? new Date(
            v.recorded_at
          ).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          )
        : "--",

      heart_rate:
        v?.heart_rate ?? null,

      spo2:
        v?.spo2 ?? null,

      respiratory_rate:
        v?.respiratory_rate ??
        null,

      temperature:
        v?.temperature ?? null,

      systolic_bp:
        v?.systolic_bp ?? null,
    })
  );

  /* =====================================================
     NEWS TREND DATA
  ===================================================== */

  const newsTrendData =
    newsTrend.map(
      (n: any) => ({
        time: n?.recorded_at
          ? new Date(
              n.recorded_at
            ).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            )
          : "--",

        score:
          Number(n?.score ?? 0),
      })
    );

  /* =====================================================
     NEWS COMPONENTS
  ===================================================== */

  const newsComponents =
    safeArray(
      p.news?.components
    );

  /* =====================================================
     NEWS POINT COLOR
  ===================================================== */

  const pointColor = (
    points: number
  ) => {
    if (points >= 2) {
      return "text-red-600";
    }

    if (points === 1) {
      return "text-orange-600";
    }

    return "text-slate-700";
  };

  /* =====================================================
     STATUS LABEL
  ===================================================== */

  const statusLabel =
    p.status ||
    "Waiting";

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="space-y-4 pb-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
              {p.patient_code || p.id || "Patient"}
            </h1>
            {isFetching && (
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md animate-pulse">
                Updating...
              </span>
            )}
          </div>

          <div className="text-sm font-medium text-slate-500 mt-1.5 flex flex-wrap items-center gap-2">
            <span>{p.age != null ? `${p.age} yr` : "Age —"}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span>{p.sex || ""}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-slate-700">{p.chief_complaint || "No complaint recorded"}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1"><span className="text-amber-600 font-bold">Waiting</span> {p.waiting_minutes ?? 0} min</span>
            {isWaiting && timeRemaining !== null && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 font-bold animate-pulse' : timeRemaining <= 5 ? 'text-orange-600 font-bold' : 'text-emerald-600'}`}>
                  <span>Reassess in:</span> {isOverdue ? `OVERDUE (${Math.abs(timeRemaining)}m)` : `${timeRemaining} min`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <PriorityBadge
            p={t?.priority}
          />

          <RiskBadge
            r={
              t?.deterioration_risk
            }
          />

          <NewsBadge
            score={
              p.news?.score
            }
            risk={
              p.news?.risk
            }
          />

          <ConfidenceBar
            c={t?.confidence}
          />

          <button
            onClick={() => setReassessOpen(true)}
            className="btn btn-secondary"
          >
            Reassess
          </button>

        </div>

      </div>

      {/* =================================================
          OVERDUE BANNER
      ================================================= */}

      {isOverdue && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm gap-4">
          <div className="flex items-center gap-3 text-red-700">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <div>
              <div className="font-bold">Overdue for Reassessment</div>
              <div className="text-sm opacity-90">This patient has exceeded their safe waiting window. Clinical review is required immediately.</div>
            </div>
          </div>
          <button onClick={() => setReassessOpen(true)} className="btn bg-red-600 text-white hover:bg-red-700 border-none whitespace-nowrap shadow-md">
            Reassess Now
          </button>
        </div>
      )}

      {/* =================================================
          STATUS / FLOW BAR
      ================================================= */}

      <div className="card p-4">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <div className="text-xs uppercase font-semibold text-slate-400">
              Patient Flow Status
            </div>

            <div className="flex items-center gap-2 mt-1">

              <span
                className={
                  "px-3 py-1 rounded-full text-sm font-semibold " +
                  (
                    isWaiting
                      ? "bg-amber-100 text-amber-700"
                      : isAccepted
                      ? "bg-blue-100 text-blue-700"
                      : isCompleted
                      ? "bg-green-100 text-green-700"
                      : isDischarged
                      ? "bg-slate-100 text-slate-600"
                      : "bg-slate-100 text-slate-700"
                  )
                }
              >
                {statusLabel}
              </span>

              {isWaiting && (
                <span className="text-sm text-slate-500">
                  Patient is currently in the queue
                </span>
              )}

              {isAccepted && (
                <span className="text-sm text-blue-600">
                  Patient is under active care
                </span>
              )}

              {isCompleted && (
                <span className="text-sm text-green-600">
                  Clinical encounter completed
                </span>
              )}

              {isDischarged && (
                <span className="text-sm text-slate-500">
                  Patient discharged
                </span>
              )}

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            {isWaiting &&
              canAccept && (
                <button
                  onClick={
                    acceptPatient
                  }
                  disabled={
                    flowLoading
                  }
                  className="btn btn-primary disabled:opacity-50"
                >
                  {flowLoading
                    ? "Accepting..."
                    : "Accept Patient"}
                </button>
              )}

            {isAccepted &&
              canAccept && (
                <button
                  onClick={
                    completePatient
                  }
                  disabled={
                    flowLoading
                  }
                  className="btn btn-primary disabled:opacity-50"
                >
                  {flowLoading
                    ? "Completing..."
                    : "Complete"}
                </button>
              )}

            {isAccepted &&
              canAccept && (
                <button
                  onClick={
                    dischargePatient
                  }
                  disabled={
                    flowLoading
                  }
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Discharge
                </button>
              )}

          </div>

        </div>

      </div>

      {/* =================================================
          LIVE MONITORING
      ================================================= */}

      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">

        <div className="flex items-center gap-2">

          <span className="relative flex h-2.5 w-2.5">

            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />

            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />

          </span>

          <span className="text-xs font-semibold text-green-700">
            LIVE PATIENT MONITORING
          </span>

        </div>

        <span className="text-xs text-slate-400">
          Refreshing every 5 seconds
        </span>

      </div>

      {/* =================================================
          LOW CONFIDENCE
      ================================================= */}

      {t &&
        Number(t.confidence ?? 0) <
          0.6 && (

          <div className="card p-4 border-l-4 border-red-500 bg-red-50">

            <div className="font-semibold text-red-700">
              LOW CONFIDENCE ASSESSMENT
            </div>

            <div className="text-sm text-red-600 mt-1">
              Available information is
              insufficient for confident
              prioritization. Request
              additional information.
            </div>

          </div>
        )}

      {/* =================================================
          NEWS WARNING
      ================================================= */}

      {p.news_direction ===
        "WORSENING" && (

        <div className="card p-4 border-l-4 border-red-500 bg-red-50">

          <div className="font-semibold text-red-700">
            EARLY WARNING SCORE
            TRENDING UP
          </div>

          <div className="text-sm text-red-600 mt-1">
            This patient's NEWS2-style
            score has increased over
            recent readings. Consider
            prioritizing reassessment.
          </div>

        </div>
      )}

      {/* =================================================
          MAIN GRID
      ================================================= */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* =================================================
            AI TRIAGE
        ================================================= */}

        <div className="card p-4 lg:col-span-2">

          <div className="font-semibold text-slate-800 mb-4">
            AI Triage Recommendation
          </div>

          {!t ? (

            <div className="text-sm text-slate-500">
              No triage assessment yet.
            </div>

          ) : (

            <>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">

                <div>

                  <div className="text-xs text-slate-500">
                    Priority
                  </div>

                  <div className="font-bold">
                    P
                    {t.priority ??
                      "—"}

                    {" - "}

                    {t.priority_label ||
                      "Unknown"}
                  </div>

                </div>

                <div>

                  <div className="text-xs text-slate-500">
                    Risk Probability
                  </div>

                  <div className="font-bold">
                    {Math.round(
                      Number(
                        t.risk_probability ??
                          0
                      ) * 100
                    )}
                    %
                  </div>

                </div>

                <div>

                  <div className="text-xs text-slate-500">
                    Confidence
                  </div>

                  <div className="font-bold">
                    {Math.round(
                      Number(
                        t.confidence ??
                          0
                      ) * 100
                    )}
                    %
                  </div>

                </div>

                <div>

                  <div className="text-xs text-slate-500">
                    Care Pathway
                  </div>

                  <div className="font-bold">
                    {t.care_pathway ||
                      "—"}
                  </div>

                </div>

                <div>

                  <div className="text-xs text-slate-500">
                    Reassess In
                  </div>

                  <div className="font-bold">
                    {t.reassessment_minutes ??
                      "—"}
                    {" min"}
                  </div>

                </div>

                <div>

                  <div className="text-xs text-slate-500">
                    Model
                  </div>

                  <div className="font-bold text-xs">
                    {t.model_version ||
                      "—"}
                  </div>

                </div>

              </div>

              {/* KEY FACTORS */}

              <div className="text-xs text-slate-500 uppercase mb-1">
                Key Factors
              </div>

              <div className="flex flex-wrap gap-1 mb-3">

                {safeArray(
                  t.key_factors
                ).length === 0 ? (

                  <span className="text-sm text-slate-400">
                    No key factors available.
                  </span>

                ) : (

                  safeArray<string>(
                    t.key_factors
                  ).map(
                    (
                      k,
                      i
                    ) => (

                      <span
                        key={i}
                        className="badge bg-slate-100 text-slate-700"
                      >
                        {k}
                      </span>

                    )
                  )

                )}

              </div>

              {/* AI EXPLANATION */}

              <div className="text-xs text-slate-500 uppercase mb-1">
                AI Explanation
              </div>

              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                {t.explanation ||
                  "No explanation available."}
              </p>

              {/* RECOMMENDATION */}

              <div className="text-xs text-slate-500 uppercase mt-3 mb-1">
                Recommendation
              </div>

              <p className="text-sm text-slate-700">
                {t.recommendation ||
                  "No recommendation available."}
              </p>

              {/* DECISION BUTTONS */}

              {canDecide && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200">

                  <button
                    onClick={() => {
                      setAction(
                        "ACCEPT"
                      );

                      setNewPriority(
                        Number(
                          t.priority ??
                            3
                        )
                      );

                      setOverrideOpen(
                        true
                      );
                    }}
                    className="btn btn-primary"
                  >
                    Accept
                  </button>

                  <button
                    onClick={() => {
                      setAction(
                        "OVERRIDE"
                      );

                      setNewPriority(
                        Number(
                          t.priority ??
                            3
                        )
                      );

                      setOverrideOpen(
                        true
                      );
                    }}
                    className="btn btn-danger"
                  >
                    Override
                  </button>

                </div>
              )}

            </>
          )}

        </div>

        {/* =================================================
            CURRENT VITALS
        ================================================= */}

        <div className="card p-4">

          <div className="flex items-center justify-between mb-3">

            <div className="font-semibold text-slate-800">
              Current Vitals
            </div>

            <span className="text-[10px] uppercase font-semibold text-green-600">
              Live
            </span>

          </div>

          {p.latest_vitals ? (

            <div className="grid grid-cols-2 gap-3 text-sm">

              <div>
                <div className="text-xs text-slate-500">
                  HR
                </div>

                <div className="font-bold">
                  {p.latest_vitals.heart_rate ??
                    "—"}
                  {" bpm"}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  BP
                </div>

                <div className="font-bold">
                  {p.latest_vitals.systolic_bp ??
                    "—"}
                  /
                  {p.latest_vitals.diastolic_bp ??
                    "—"}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  SpO₂
                </div>

                <div className="font-bold">
                  {p.latest_vitals.spo2 ??
                    "—"}
                  %
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  RR
                </div>

                <div className="font-bold">
                  {p.latest_vitals.respiratory_rate ??
                    "—"}
                  {" /min"}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  Temp
                </div>

                <div className="font-bold">
                  {p.latest_vitals.temperature ??
                    "—"}
                  {" °C"}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  Pain
                </div>

                <div className="font-bold">
                  {p.pain_score ??
                    "—"}
                  /10
                </div>
              </div>

            </div>

          ) : (

            <div className="text-sm text-slate-500">
              No vitals recorded
            </div>

          )}

          <div className="mt-4 text-xs">

            <div className="text-slate-500 uppercase mb-1">
              Medical History
            </div>

            <div>
              {p.medical_history ||
                "None recorded"}
            </div>

            <div className="text-slate-500 uppercase mt-3 mb-1">
              Allergies
            </div>

            <div>
              {p.allergies ||
                "None recorded"}
            </div>

          </div>

        </div>

        {/* =================================================
            NEWS2
        ================================================= */}

        <div className="card p-4 lg:col-span-3">

          <div className="flex items-center justify-between mb-3">

            <div className="font-semibold text-slate-800">
              Early Warning Score
              (NEWS2)
            </div>

            <NewsTrendBadge
              direction={
                p.news_direction
              }
            />

          </div>

          {!p.news ? (

            <div className="text-sm text-slate-500">
              No NEWS2 assessment available.
            </div>

          ) : (

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              <div className="flex items-center gap-3">

                <div className="text-4xl font-bold text-slate-900">
                  {p.news.score ??
                    0}
                </div>

                <NewsBadge
                  score={
                    p.news.score
                  }
                  risk={
                    p.news.risk
                  }
                />

              </div>

              <div className="lg:col-span-1 grid grid-cols-2 gap-2 text-xs">

                {newsComponents.length ===
                0 ? (

                  <div className="text-slate-400">
                    No NEWS components.
                  </div>

                ) : (

                  newsComponents.map(
                    (c: any, index) => (

                      <div
                        key={
                          c?.label ??
                          index
                        }
                        className="flex justify-between px-2 py-1 rounded bg-slate-50"
                      >

                        <span className="text-slate-500">
                          {c?.label ||
                            "Component"}
                        </span>

                        <span
                          className={
                            "font-semibold " +
                            pointColor(
                              Number(
                                c?.points ??
                                  0
                              )
                            )
                          }
                        >
                          {c?.value ??
                            "—"}

                          {" ("}

                          {c?.points ??
                            0}

                          {"pt)"}
                        </span>

                      </div>

                    )
                  )

                )}

              </div>

              <div className="lg:col-span-1">

                {newsTrendData.length >
                1 ? (

                  <ResponsiveContainer
                    width="100%"
                    height={100}
                  >

                    <LineChart
                      data={
                        newsTrendData
                      }
                    >

                      <XAxis
                        dataKey="time"
                        hide
                      />

                      <YAxis
                        hide
                        domain={[
                          0,
                          (
                            dataMax: number
                          ) =>
                            Math.max(
                              dataMax +
                                2,
                              5
                            ),
                        ]}
                      />

                      <Tooltip />

                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={false}
                      />

                    </LineChart>

                  </ResponsiveContainer>

                ) : (

                  <div className="text-xs text-slate-400 flex items-center justify-center h-full">
                    Not enough readings
                    for a trend yet.
                  </div>

                )}

              </div>

            </div>

          )}

        </div>

        {/* =================================================
            VITAL TREND
        ================================================= */}

        <div className="card p-4 lg:col-span-2">

          <div className="flex items-center justify-between mb-2">

            <div className="font-semibold text-slate-800">
              Vital Trend
            </div>

            <select
              value={metric}
              onChange={(e) =>
                setMetric(
                  e.target.value
                )
              }
              className="text-xs px-2 py-1 rounded border"
            >

              <option value="heart_rate">
                Heart Rate
              </option>

              <option value="spo2">
                SpO₂
              </option>

              <option value="respiratory_rate">
                Respiratory Rate
              </option>

              <option value="temperature">
                Temperature
              </option>

              <option value="systolic_bp">
                Systolic BP
              </option>

            </select>

          </div>

          {vitalsData.length > 0 ? (

            <ResponsiveContainer
              width="100%"
              height={220}
            >

              <LineChart
                data={vitalsData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="time"
                />

                <YAxis />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />

              </LineChart>

            </ResponsiveContainer>

          ) : (

            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              No vital trend data available.
            </div>

          )}

        </div>

        {/* =================================================
            ALERTS
        ================================================= */}

        <div className="card p-4">

          <div className="font-semibold text-slate-800 mb-2">
            Alerts
          </div>

          {alerts.length === 0 ? (

            <div className="text-sm text-slate-500">
              No alerts
            </div>

          ) : (

            alerts
              .slice(0, 5)
              .map((a: any, index) => (

                <div
                  key={
                    a?.id ??
                    index
                  }
                  className="text-xs p-2 border-b border-slate-100"
                >

                  <div className="font-semibold text-slate-700">
                    {a?.type ||
                      "Alert"}
                  </div>

                  <div className="text-slate-500">
                    {a?.message ||
                      a?.reason ||
                      "Alert generated."}
                  </div>

                </div>

              ))

          )}

        </div>

        {/* =================================================
            DETERIORATION TIMELINE
        ================================================= */}

        <div className="lg:col-span-3">

          <DeteriorationTimeline
            patient={p}
          />

        </div>

        {/* =================================================
            TRIAGE HISTORY
        ================================================= */}

        <div className="card p-4 lg:col-span-3">

          <div className="font-semibold text-slate-800 mb-2">
            Triage History
          </div>

          {triages.length ===
          0 ? (

            <div className="text-sm text-slate-500">
              No previous triage assessments.
            </div>

          ) : (

            <div className="text-sm space-y-1">

              {triages
                .slice(0, 10)
                .map(
                  (
                    tr: any,
                    index
                  ) => (

                    <div
                      key={
                        tr?.id ??
                        index
                      }
                      className="flex flex-wrap items-center gap-3 p-2 border-b border-slate-100"
                    >

                      <div className="text-xs text-slate-500 w-32">

                        {tr?.created_at
                          ? new Date(
                              tr.created_at
                            ).toLocaleString()
                          : "--"}

                      </div>

                      <PriorityBadge
                        p={
                          tr?.priority
                        }
                      />

                      <RiskBadge
                        r={
                          tr?.deterioration_risk
                        }
                      />

                      <div className="text-slate-600 text-xs">

                        {tr?.model_version ||
                          "Unknown model"}

                      </div>

                    </div>

                  )
                )}

            </div>

          )}

        </div>

        {/* =================================================
            CLINICIAN DECISION PANEL
        ================================================= */}

        {t && (

          <div className="card p-4 lg:col-span-3">

            <div className="mb-4">

              <div className="font-semibold text-slate-800 text-lg">
                Clinician Actions
              </div>

              <div className="text-sm text-slate-500 mt-1">
                Review the AI recommendation
                and record the final clinical
                decision.
              </div>

            </div>

            <ClinicianDecisionPanel
              patientId={
                p.id || id || ""
              }

              triage={{
                id: t.id,

                priority:
                  t.priority,

                deterioration_risk:
                  t.deterioration_risk,

                confidence:
                  t.confidence,

                care_pathway:
                  t.care_pathway,

                reassessment_minutes:
                  t.reassessment_minutes,
              }}
            />

          </div>

        )}

        {/* =================================================
            DECISION HISTORY
        ================================================= */}

        <div className="card p-4 lg:col-span-3">

          <div className="font-semibold text-slate-800 mb-2">
            Existing Clinician Decisions
          </div>

          {decisions.length ===
          0 ? (

            <div className="text-sm text-slate-500">
              No decisions yet.
            </div>

          ) : (

            decisions.map(
              (
                d: any,
                index
              ) => (

                <div
                  key={
                    d?.id ??
                    index
                  }
                  className="text-sm p-2 border-b border-slate-100 flex flex-col md:flex-row md:justify-between gap-2"
                >

                  <div>

                    <span className="badge bg-indigo-100 text-indigo-700 mr-2">
                      {d?.action ||
                        "DECISION"}
                    </span>

                    {d?.previous_priority != null
                      ? `P${d.previous_priority} > `
                      : ""}

                    {d?.new_priority != null
                      ? `P${d.new_priority}`
                      : ""}

                    {d?.reason
                      ? ` - ${d.reason}`
                      : ""}

                  </div>

                  <div className="text-xs text-slate-400">

                    {d?.created_at
                      ? new Date(
                          d.created_at
                        ).toLocaleString()
                      : "--"}

                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>

      {/* =================================================
          DECISION MODAL
      ================================================= */}

      {overrideOpen && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">

            <h3 className="font-bold text-lg mb-3">
              {action}
              {" Recommendation"}
            </h3>

            {/* NEW PRIORITY */}

            {action !== "ACCEPT" && (

              <div className="mb-3">

                <label className="text-xs text-slate-500 uppercase">
                  New Priority
                </label>

                <select
                  value={
                    newPriority
                  }
                  onChange={(e) =>
                    setNewPriority(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="w-full mt-1 px-3 py-2 border rounded"
                >

                  {[1, 2, 3, 4, 5].map(
                    (n) => (

                      <option
                        key={n}
                        value={n}
                      >
                        P{n}
                      </option>

                    )
                  )}

                </select>

              </div>

            )}

            {/* REASON */}

            <div className="mb-3">

              <label className="text-xs text-slate-500 uppercase">
                Reason{" "}
                {action ===
                  "OVERRIDE" &&
                  "(required)"}
              </label>

              <textarea
                value={reason}
                onChange={(e) =>
                  setReason(
                    e.target.value
                  )
                }
                className="w-full mt-1 px-3 py-2 border rounded"
                rows={3}
                placeholder="Enter clinical reasoning..."
              />

            </div>

            {/* BUTTONS */}

            <div className="flex justify-end gap-2">

              <button
                onClick={() =>
                  setOverrideOpen(
                    false
                  )
                }
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                onClick={decide}
                disabled={
                  action ===
                    "OVERRIDE" &&
                  !reason.trim()
                }
                className="btn btn-primary disabled:opacity-50"
              >
                Confirm
              </button>

            </div>

          </div>
        </div>
      )}

      {/* =================================================
          REASSESS MODAL
      ================================================= */}

      {reassessOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl ring-1 ring-slate-200">
            <h3 className="font-display font-bold text-xl text-slate-800 tracking-tight mb-1">
              Reassess Patient
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              Enter new vitals. The AI triage engine will automatically re-evaluate the patient's priority and risk.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Heart Rate</label>
                <input
                  type="number"
                  placeholder="bpm"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                  value={reassessForm.heart_rate}
                  onChange={(e) => setReassessForm({ ...reassessForm, heart_rate: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sys BP</label>
                  <input
                    type="number"
                    placeholder="mmHg"
                    className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                    value={reassessForm.systolic_bp}
                    onChange={(e) => setReassessForm({ ...reassessForm, systolic_bp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dia BP</label>
                  <input
                    type="number"
                    placeholder="mmHg"
                    className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                    value={reassessForm.diastolic_bp}
                    onChange={(e) => setReassessForm({ ...reassessForm, diastolic_bp: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">SpO2</label>
                <input
                  type="number"
                  placeholder="%"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                  value={reassessForm.spo2}
                  onChange={(e) => setReassessForm({ ...reassessForm, spo2: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resp Rate</label>
                <input
                  type="number"
                  placeholder="bpm"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                  value={reassessForm.respiratory_rate}
                  onChange={(e) => setReassessForm({ ...reassessForm, respiratory_rate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="°C"
                  className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                  value={reassessForm.temperature}
                  onChange={(e) => setReassessForm({ ...reassessForm, temperature: e.target.value })}
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clinical Notes</label>
              <textarea
                value={reassessForm.reason}
                onChange={(e) => setReassessForm({ ...reassessForm, reason: e.target.value })}
                className="w-full mt-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition"
                rows={2}
                placeholder="Observation notes, changes in condition..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReassessOpen(false)}
                className="btn btn-secondary px-5"
                disabled={flowLoading}
              >
                Cancel
              </button>
              <button
                onClick={submitReassess}
                className="btn btn-primary px-5 shadow-md flex items-center gap-2"
                disabled={flowLoading}
              >
                {flowLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Assessing...
                  </>
                ) : (
                  "Run Reassessment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}