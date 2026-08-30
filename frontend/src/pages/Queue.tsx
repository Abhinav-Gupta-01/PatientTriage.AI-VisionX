import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import {
  AlertTriangle,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";

import api from "../services/api";

import {
  PriorityBadge,
  RiskBadge,
  ConfidenceBar,
  NewsBadge,
} from "../components/ui/Badges";

type SortOption =
  | "priority"
  | "risk"
  | "waiting"
  | "news"
  | "confidence";

type QueueTab = "waiting" | "in_treatment";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

interface Patient {
  id: string;
  patient_code?: string;
  age?: number;
  sex?: string;
  chief_complaint?: string;
  symptoms?: string;
  status?: string;

  arrival_time?: string;

  waiting_minutes?: number;

  triage?: {
    priority?: number;
    priority_label?: string;
    deterioration_risk?: string;
    risk_probability?: number;
    confidence?: number;
    care_pathway?: string;
    reassessment_minutes?: number;
  };

  news?: {
    score?: number;
    risk?: string;
  };

  vitals?: any;

  [key: string]: any;
}

/*
|--------------------------------------------------------------------------
| API response normalizer
|--------------------------------------------------------------------------
|
| The backend currently returns:
|
|   [...]
|
| But this protects the frontend if the API returns:
|
|   { patients: [...] }
|   { data: [...] }
|   { results: [...] }
|
| It also prevents:
|
|   .filter is not a function
|
|--------------------------------------------------------------------------
*/

function normalizePatientsResponse(data: any): Patient[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.patients)) {
    return data.patients;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| Queue score
|--------------------------------------------------------------------------
*/

function getQueueScore(patient: Patient) {
  const priority = Number(
    patient.triage?.priority ?? 5
  );

  const risk = Number(
    patient.triage?.risk_probability ?? 0
  );

  const waiting = Number(
    patient.waiting_minutes ?? 0
  );

  const news = Number(
    patient.news?.score ?? 0
  );

  /*
   * Higher score = needs attention sooner.
   *
   * Priority carries the largest weight.
   * Risk, NEWS and waiting time provide additional weight.
   */

  const priorityScore =
    (6 - priority) * 100;

  const riskScore =
    risk * 50;

  const newsScore =
    news * 5;

  const waitingScore =
    Math.min(waiting / 10, 30);

  return Math.round(
    priorityScore +
      riskScore +
      newsScore +
      waitingScore
  );
}

/*
|--------------------------------------------------------------------------
| Priority label
|--------------------------------------------------------------------------
*/

function getPriorityLabel(
  priority?: number
) {
  switch (Number(priority)) {
    case 1:
      return "Immediate";

    case 2:
      return "Emergent";

    case 3:
      return "Urgent";

    case 4:
      return "Less Urgent";

    case 5:
      return "Non-Urgent";

    default:
      return "Untriaged";
  }
}

/*
|--------------------------------------------------------------------------
| Queue status
|--------------------------------------------------------------------------
*/

function getQueueStatus(
  patient: Patient
) {
  const priority = Number(
    patient.triage?.priority ?? 5
  );

  const risk =
    patient.triage?.deterioration_risk;

  const waiting = Number(
    patient.waiting_minutes ?? 0
  );

  if (priority === 1) {
    return {
      label: "Immediate Attention",
      className:
        "bg-red-50 text-red-700 border-red-200",
      icon: <AlertTriangle size={14} />,
    };
  }

  if (risk === "HIGH") {
    return {
      label: "High Risk",
      className:
        "bg-orange-50 text-orange-700 border-orange-200",
      icon: <ShieldAlert size={14} />,
    };
  }

  if (waiting > 120) {
    return {
      label: "Long Wait",
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-200",
      icon: <Clock3 size={14} />,
    };
  }

  return {
    label: "In Queue",
    className:
      "bg-slate-50 text-slate-600 border-slate-200",
    icon: <Clock3 size={14} />,
  };
}

/*
|--------------------------------------------------------------------------
| Queue score component
|--------------------------------------------------------------------------
*/

function QueueScore({
  score,
}: {
  score: number;
}) {
  const label =
    score >= 150
      ? "Critical"
      : score >= 110
      ? "High"
      : score >= 75
      ? "Moderate"
      : "Low";

  const className =
    score >= 150
      ? "bg-red-100 text-red-700"
      : score >= 110
      ? "bg-orange-100 text-orange-700"
      : score >= 75
      ? "bg-yellow-100 text-yellow-800"
      : "bg-green-100 text-green-700";

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${className.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'ring-').replace('text-', 'text-')}`}>
        {score}
      </span>
      <span className="text-xs font-medium text-slate-500">
        {label}
      </span>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Queue Page
|--------------------------------------------------------------------------
*/

export default function Queue() {
  const [params, setParams] =
    useSearchParams();

  const initialSearch =
    params.get("q") || "";

  const tab =
    (params.get("tab") as QueueTab) || "waiting";

  const [search, setSearch] =
    useState(initialSearch);

  const [priority, setPriority] =
    useState("");

  const [risk, setRisk] =
    useState("");

  const [status, setStatus] =
    useState("");

  const [sort, setSort] =
    useState<SortOption>("priority");

  const [showFilters, setShowFilters] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Fetch patients
  |--------------------------------------------------------------------------
  */

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["patients"],

    queryFn: async () => {
      const response =
        await api.get("/patients");

      return response.data;
    },

    /*
     * Refresh the queue every 15 seconds.
     *
     * This is important because when a clinician accepts
     * a patient, the backend changes:
     *
     * Waiting -> In Treatment
     *
     * The queue then removes that patient.
     */

    refetchInterval: 15000,

    refetchIntervalInBackground: false,
  });

  /*
  |--------------------------------------------------------------------------
  | Normalize API response
  |--------------------------------------------------------------------------
  */

  const allPatients =
    useMemo(
      () =>
        normalizePatientsResponse(data),
      [data]
    );

  /*
  |--------------------------------------------------------------------------
  | FILTER BY TAB
  |--------------------------------------------------------------------------
  |
  | waiting       -> Waiting patients (the queue)
  | in_treatment  -> Accepted / In Treatment patients
  |
  |--------------------------------------------------------------------------
  */

  const patients =
    useMemo(() => {
      if (tab === "in_treatment") {
        return allPatients.filter(
          (patient) => {
            const s = String(
              patient.status ?? ""
            ).toLowerCase();
            return (
              s === "in treatment" ||
              s === "in_treatment" ||
              s === "accepted" ||
              s === "active" ||
              s === "processing"
            );
          }
        );
      }
      return allPatients.filter(
        (patient) =>
          String(
            patient.status ?? ""
          ).toLowerCase() ===
          "waiting"
      );
    }, [allPatients, tab]);

  const waitingCount = useMemo(() =>
    allPatients.filter(
      (p) => String(p.status ?? "").toLowerCase() === "waiting"
    ).length,
    [allPatients]
  );

  const inTreatmentCount = useMemo(() =>
    allPatients.filter(
      (p) => {
        const s = String(p.status ?? "").toLowerCase();
        return s === "in treatment" || s === "in_treatment" || s === "accepted" || s === "active" || s === "processing";
      }
    ).length,
    [allPatients]
  );

  /*
  |--------------------------------------------------------------------------
  | Process queue
  |--------------------------------------------------------------------------
  */

  const processedPatients =
    useMemo(() => {
      let rows =
        patients.map(
          (patient) => ({
            ...patient,
            queue_score:
              getQueueScore(
                patient
              ),
          })
        );

      /*
      |--------------------------------------------------------------------------
      | Search
      |--------------------------------------------------------------------------
      */

      if (search.trim()) {
        const query =
          search
            .trim()
            .toLowerCase();

        rows =
          rows.filter(
            (patient) => {
              const searchable = [
                patient.patient_code,

                patient.chief_complaint,

                patient.symptoms,

                patient.status,

                patient.age,

                patient.sex,

                patient.triage
                  ?.priority,

                patient.triage
                  ?.deterioration_risk,

                patient.triage
                  ?.care_pathway,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLowerCase();

              return searchable.includes(
                query
              );
            }
          );
      }

      /*
      |--------------------------------------------------------------------------
      | Priority filter
      |--------------------------------------------------------------------------
      */

      if (priority) {
        rows =
          rows.filter(
            (patient) =>
              String(
                patient.triage
                  ?.priority
              ) === priority
          );
      }

      /*
      |--------------------------------------------------------------------------
      | Risk filter
      |--------------------------------------------------------------------------
      */

      if (risk) {
        rows =
          rows.filter(
            (patient) =>
              String(
                patient.triage
                  ?.deterioration_risk ??
                  ""
              ).toUpperCase() ===
              risk.toUpperCase()
          );
      }

      /*
      |--------------------------------------------------------------------------
      | Status filter
      |--------------------------------------------------------------------------
      |
      | The queue itself only contains Waiting patients.
      |
      | We keep this filter for UI compatibility.
      |
      |--------------------------------------------------------------------------
      */

      if (status) {
        rows =
          rows.filter(
            (patient) =>
              String(
                patient.status ??
                  ""
              ).toLowerCase() ===
              status.toLowerCase()
          );
      }

      /*
      |--------------------------------------------------------------------------
      | Sorting
      |--------------------------------------------------------------------------
      */

      rows.sort(
        (a, b) => {
          switch (sort) {
            /*
            |--------------------------------------------------------------------------
            | Highest risk first
            |--------------------------------------------------------------------------
            */

            case "risk":
              return (
                Number(
                  b.triage
                    ?.risk_probability ??
                    0
                ) -
                Number(
                  a.triage
                    ?.risk_probability ??
                    0
                )
              );

            /*
            |--------------------------------------------------------------------------
            | Longest waiting first
            |--------------------------------------------------------------------------
            */

            case "waiting":
              return (
                Number(
                  b.waiting_minutes ??
                    0
                ) -
                Number(
                  a.waiting_minutes ??
                    0
                )
              );

            /*
            |--------------------------------------------------------------------------
            | Highest NEWS first
            |--------------------------------------------------------------------------
            */

            case "news":
              return (
                Number(
                  b.news?.score ??
                    0
                ) -
                Number(
                  a.news?.score ??
                    0
                )
              );

            /*
            |--------------------------------------------------------------------------
            | Lowest confidence first
            |--------------------------------------------------------------------------
            */

            case "confidence":
              return (
                Number(
                  a.triage
                    ?.confidence ??
                    0
                ) -
                Number(
                  b.triage
                    ?.confidence ??
                    0
                )
              );

            /*
            |--------------------------------------------------------------------------
            | Smart priority
            |--------------------------------------------------------------------------
            |
            | P1 -> P2 -> P3 -> P4 -> P5
            |
            | Then:
            | risk
            | waiting time
            |--------------------------------------------------------------------------
            */

            case "priority":
            default:
              return (
                Number(
                  a.triage
                    ?.priority ??
                    5
                ) -
                  Number(
                    b.triage
                      ?.priority ??
                      5
                  ) ||

                Number(
                  b.triage
                    ?.risk_probability ??
                    0
                ) -
                  Number(
                    a.triage
                      ?.risk_probability ??
                      0
                  ) ||

                Number(
                  b.waiting_minutes ??
                    0
                ) -
                  Number(
                    a.waiting_minutes ??
                      0
                  )
              );
          }
        }
      );

      return rows;
    }, [
      patients,
      search,
      priority,
      risk,
      status,
      sort,
    ]);

  /*
  |--------------------------------------------------------------------------
  | Summary counts
  |--------------------------------------------------------------------------
  */

  const criticalCount =
    patients.filter(
      (patient) =>
        Number(
          patient.triage
            ?.priority
        ) === 1
    ).length;

  const highRiskCount =
    patients.filter(
      (patient) =>
        String(
          patient.triage
            ?.deterioration_risk ??
            ""
        ).toUpperCase() ===
        "HIGH"
    ).length;

  const longWaitCount =
    patients.filter(
      (patient) =>
        Number(
          patient.waiting_minutes ??
            0
        ) > 120
    ).length;

  /*
  |--------------------------------------------------------------------------
  | Clear filters
  |--------------------------------------------------------------------------
  */

  const clearFilters = () => {
    setSearch("");
    setPriority("");
    setRisk("");
    setStatus("");
  };

  const switchTab = (newTab: QueueTab) => {
    setParams({ tab: newTab });
    clearFilters();
  };

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading triage queue...
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | API error
  |--------------------------------------------------------------------------
  */

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle
          size={32}
          className="mx-auto text-red-500"
        />

        <h2 className="mt-3 font-semibold text-slate-800">
          Unable to load queue
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Failed to retrieve patients
          from the backend.
        </p>

        {error instanceof Error && (
          <p className="mt-2 text-xs text-red-500">
            {error.message}
          </p>
        )}

        <button
          onClick={() =>
            refetch()
          }
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <RefreshCw size={15} />
          Retry
        </button>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-5">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
              {tab === "waiting" ? "Smart Triage Queue" : "In Treatment"}
            </h1>

            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] uppercase font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              LIVE
            </span>
          </div>

          <p className="mt-1 text-sm font-medium text-slate-500">
            {tab === "waiting"
              ? "Patients prioritized using triage severity, deterioration risk and waiting time."
              : "Patients currently being treated by clinicians."}
          </p>
        </div>

        <button
          onClick={() =>
            refetch()
          }
          disabled={isFetching}
          className="btn btn-secondary inline-flex items-center gap-2"
        >
          <RefreshCw
            size={16}
            className={
              isFetching
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {/* =====================================================
          TABS
      ===================================================== */}

      <div className="flex gap-2 rounded-xl bg-slate-200/50 p-1.5 w-full sm:w-auto overflow-x-auto">
        <button
          onClick={() => switchTab("waiting")}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200 whitespace-nowrap ${
            tab === "waiting"
              ? "bg-white text-indigo-700 shadow-md ring-1 ring-slate-200/50"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          }`}
        >
          <Users size={18} />
          Waiting Queue
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
            tab === "waiting"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-300/50 text-slate-600"
          }`}>
            {waitingCount}
          </span>
        </button>

        <button
          onClick={() => switchTab("in_treatment")}
          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200 whitespace-nowrap ${
            tab === "in_treatment"
              ? "bg-white text-emerald-700 shadow-md ring-1 ring-slate-200/50"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          }`}
        >
          <Stethoscope size={18} />
          In Treatment
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
            tab === "in_treatment"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-300/50 text-slate-600"
          }`}>
            {inTreatmentCount}
          </span>
        </button>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total */}

        {/* Total */}
        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-10 bg-indigo-500 transition-opacity duration-300 group-hover:opacity-20" />
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {tab === "waiting" ? "Total Queue" : "In Treatment"}
            </div>
            <div className="mt-1 text-3xl font-display font-bold text-slate-800">
              {patients.length}
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500">
              {tab === "waiting" ? "Waiting patients" : "Active patients"}
            </div>
          </div>
        </div>

        {/* Critical */}
        <div className="card p-5 relative overflow-hidden group border-red-100">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-10 bg-red-500 transition-opacity duration-300 group-hover:opacity-20" />
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-500">
              Critical P1
            </div>
            <div className="mt-1 text-3xl font-display font-bold text-red-700">
              {criticalCount}
            </div>
            <div className="mt-2 text-xs font-medium text-red-500 flex items-center gap-1">
              <AlertTriangle size={12}/> Immediate attention
            </div>
          </div>
        </div>

        {/* High risk */}
        <div className="card p-5 relative overflow-hidden group border-orange-100">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-10 bg-orange-500 transition-opacity duration-300 group-hover:opacity-20" />
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
              High Risk
            </div>
            <div className="mt-1 text-3xl font-display font-bold text-orange-700">
              {highRiskCount}
            </div>
            <div className="mt-2 text-xs font-medium text-orange-600 flex items-center gap-1">
              <ShieldAlert size={12}/> Deterioration risk
            </div>
          </div>
        </div>

        {/* Long wait / Treatment time */}
        <div className="card p-5 relative overflow-hidden group border-yellow-100">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-10 bg-yellow-500 transition-opacity duration-300 group-hover:opacity-20" />
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">
              {tab === "waiting" ? "Long Wait" : "Treatment Time"}
            </div>
            <div className="mt-1 text-3xl font-display font-bold text-yellow-700">
              {longWaitCount}
            </div>
            <div className="mt-2 text-xs font-medium text-yellow-700 flex items-center gap-1">
              <Clock3 size={12}/> {tab === "waiting" ? "Waiting > 120 min" : "> 120 min in treatment"}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          SEARCH + FILTERS
      ===================================================== */}

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          {/* Search */}

          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search patient, complaint, symptoms..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Sort */}

          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target
                  .value as SortOption
              )
            }
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="priority">
              Smart Priority
            </option>

            <option value="risk">
              Highest Risk
            </option>

            <option value="waiting">
              Longest Waiting
            </option>

            <option value="news">
              Highest NEWS
            </option>

            <option value="confidence">
              Lowest Confidence
            </option>
          </select>

          {/* Filters */}

          <button
            onClick={() =>
              setShowFilters(
                (value) =>
                  !value
              )
            }
            className="btn btn-secondary inline-flex items-center justify-center gap-2"
          >
            <SlidersHorizontal
              size={16}
            />

            Filters
          </button>
        </div>

        {/* =================================================
            FILTER PANEL
        ================================================= */}

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
            {/* Priority */}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Priority
              </label>

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target
                      .value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">
                  All Priorities
                </option>

                <option value="1">
                  P1 — Resuscitation
                </option>

                <option value="2">
                  P2 — Emergent
                </option>

                <option value="3">
                  P3 — Urgent
                </option>

                <option value="4">
                  P4 — Less Urgent
                </option>

                <option value="5">
                  P5 — Non-Urgent
                </option>
              </select>
            </div>

            {/* Risk */}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Deterioration Risk
              </label>

              <select
                value={risk}
                onChange={(event) =>
                  setRisk(
                    event.target
                      .value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">
                  All Risks
                </option>

                <option value="HIGH">
                  High Risk
                </option>

                <option value="MEDIUM">
                  Medium Risk
                </option>

                <option value="LOW">
                  Low Risk
                </option>
              </select>
            </div>

            {/* Status */}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Status
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">
                  All Statuses
                </option>

                <option value="Waiting">
                  Waiting
                </option>

                <option value="In Treatment">
                  In Treatment
                </option>

                <option value="Completed">
                  Completed
                </option>

                <option value="Discharged">
                  Discharged
                </option>

                <option value="Cancelled">
                  Cancelled
                </option>
              </select>
            </div>
          </div>
        )}

        {/* =================================================
            ACTIVE FILTER INDICATOR
        ================================================= */}

        {(search ||
          priority ||
          risk ||
          status) && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Filter size={14} />

              Showing{" "}

              <strong className="text-slate-800">
                {
                  processedPatients.length
                }
              </strong>

              {" "}of{" "}

              <strong className="text-slate-800">
                {patients.length}
              </strong>

              {" "}patients
            </div>

            <button
              onClick={
                clearFilters
              }
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* =====================================================
          QUEUE TABLE
      ===================================================== */}

      <div className="card overflow-hidden">
        {/* Table header */}

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">
                {tab === "waiting" ? "Priority Queue" : "Active Patients"}
              </div>

              <div className="text-xs text-slate-500">
                {tab === "waiting"
                  ? "Automatically ranked by clinical priority"
                  : "Patients currently receiving treatment"}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              {
                processedPatients.length
              }{" "}
              patients
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            {/* =================================================
                TABLE HEADER
            ================================================= */}

            <thead className="border-b border-slate-200 bg-white">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Patient</th>
                <th className="px-2 py-3">Priority</th>
                <th className="px-2 py-3">Risk</th>
                <th className="px-2 py-3">NEWS</th>
                <th className="px-2 py-3">Wait</th>
                <th className="px-2 py-3">Reassess In</th>
                <th className="px-2 py-3">Queue Score</th>
                <th className="px-2 py-3">Confidence</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>

            {/* =================================================
                TABLE BODY
            ================================================= */}

            <tbody>
              {/* No patients */}

              {processedPatients.length ===
                0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center"
                  >
                    <div className="text-slate-400">
                      <Search
                        size={28}
                        className="mx-auto mb-2"
                      />

                      <div className="font-medium">
                        {patients.length ===
                        0
                          ? "Queue is empty"
                          : "No patients found"}
                      </div>

                      <div className="mt-1 text-xs">
                        {patients.length ===
                        0
                          ? "No patients are currently waiting."
                          : "Try changing your filters."}
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* Patients */}

              {processedPatients.map(
                (
                  patient,
                  index
                ) => {
                  const queueStatus =
                    getQueueStatus(
                      patient
                    );

                  const priority =
                    Number(
                      patient.triage
                        ?.priority ??
                        5
                    );

                  const riskProbability =
                    Math.round(
                      Number(
                        patient
                          .triage
                          ?.risk_probability ??
                          0
                      ) * 100
                    );

                  return (
                    <tr
                      key={
                        patient.id
                      }
                      className={`border-b border-slate-100 transition hover:bg-slate-50 ${
                        priority ===
                        1
                          ? "bg-red-50/30"
                          : ""
                      }`}
                    >
                      {/* =====================================
                          PATIENT
                      ===================================== */}

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 shrink-0">
                            #{index + 1}
                          </div>

                          <div>
                            <div className="font-semibold text-slate-800 whitespace-nowrap">
                              {patient.patient_code || "Unknown"}
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                              <span>{patient.age ?? "—"} yr</span>
                              <span>•</span>
                              <span>{patient.sex || "—"}</span>
                            </div>

                            <div className="mt-1 max-w-[200px] truncate text-xs text-slate-600">
                              {patient.chief_complaint || "No complaint recorded"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* =====================================
                          PRIORITY
                      ===================================== */}

                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <PriorityBadge
                            p={
                              patient
                                .triage
                                ?.priority
                            }
                          />

                          <div className="text-xs text-slate-500">
                            {getPriorityLabel(
                              patient
                                .triage
                                ?.priority
                            )}
                          </div>
                        </div>
                      </td>

                      {/* =====================================
                          RISK
                      ===================================== */}

                      <td className="px-2 py-3">
                        <div className="space-y-1">
                          <RiskBadge
                            r={
                              patient
                                .triage
                                ?.deterioration_risk
                            }
                          />

                          <div className="text-xs font-medium text-slate-600">
                            {
                              riskProbability
                            }
                            %
                          </div>
                        </div>
                      </td>

                      {/* =====================================
                          NEWS
                      ===================================== */}

                      <td className="px-2 py-3">
                        <NewsBadge
                          score={
                            patient
                              .news
                              ?.score
                          }
                          risk={
                            patient
                              .news
                              ?.risk
                          }
                        />
                      </td>

                      {/* =====================================
                          WAITING
                      ===================================== */}

                      <td className="px-2 py-3">
                        <div
                          className={`flex items-center gap-1 font-medium ${
                            Number(
                              patient.waiting_minutes ??
                                0
                            ) > 120
                              ? "text-red-600"
                              : Number(
                                  patient.waiting_minutes ??
                                    0
                                ) > 45
                              ? "text-orange-600"
                              : "text-slate-700"
                          }`}
                        >
                          <Clock3
                            size={14}
                          />

                          {
                            patient.waiting_minutes ??
                            0
                          }{" "}
                          min
                        </div>
                      </td>

                      {/* =====================================
                          REASSESS IN
                      ===================================== */}

                      <td className="px-2 py-3">
                        {(() => {
                          const reassessMins = patient.triage?.reassessment_minutes;
                          if (reassessMins === undefined || reassessMins === null) return <span className="text-slate-400">—</span>;
                          const wait = Number(patient.waiting_minutes ?? 0);
                          const remaining = reassessMins - wait;
                          let colorClass = "text-emerald-700 bg-emerald-50 ring-emerald-200";
                          let dotClass = "bg-emerald-500";
                          if (remaining <= 0) {
                            colorClass = "text-red-700 bg-red-100 ring-red-300 animate-pulse font-bold shadow-sm";
                            dotClass = "bg-red-600 animate-ping";
                          } else if (remaining <= 5) {
                            colorClass = "text-orange-700 bg-orange-100 ring-orange-300 font-bold shadow-sm";
                            dotClass = "bg-orange-500";
                          }
                          return (
                            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${colorClass}`}>
                              <span className="relative flex h-2 w-2">
                                {remaining <= 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`}></span>
                              </span>
                              {remaining <= 0 ? (remaining < 0 ? `Overdue ${Math.abs(remaining)}m` : "Overdue") : `${remaining} min`}
                            </div>
                          );
                        })()}
                      </td>

                      {/* =====================================
                          QUEUE SCORE
                      ===================================== */}

                      <td className="px-2 py-3">
                        <QueueScore
                          score={
                            getQueueScore(
                              patient
                            )
                          }
                        />
                      </td>

                      {/* =====================================
                          CONFIDENCE
                      ===================================== */}

                      <td className="px-2 py-3">
                        <ConfidenceBar
                          c={
                            patient
                              .triage
                              ?.confidence
                          }
                        />
                      </td>

                      {/* =====================================
                          STATUS
                      ===================================== */}

                      <td className="px-2 py-3">
                        <div className="space-y-1">
                          <span className="badge bg-slate-100 text-slate-700">
                            {patient.status ||
                              "Waiting"}
                          </span>

                          <div
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${queueStatus.className}`}
                          >
                            {
                              queueStatus.icon
                            }

                            {
                              queueStatus.label
                            }
                          </div>
                        </div>
                      </td>

                      {/* =====================================
                          ACTION
                      ===================================== */}

                      <td className="px-3 py-3 text-right">
                        <Link
                          to={`/patient/${patient.id}`}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 whitespace-nowrap"
                        >
                          <UserRound size={14} />
                          View Patient
                        </Link>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          EXPLANATION
      ===================================================== */}

      <div className="card border-indigo-100 bg-indigo-50/40 p-4">
        <div className="flex gap-3">
          <div className="mt-0.5 text-indigo-600">
            <ShieldAlert
              size={18}
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-800">
              How Smart Queue prioritization works
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Patients are ordered
              primarily by triage
              priority. Deterioration
              risk, NEWS-style early
              warning score and
              waiting time are used
              to further prioritize
              patients with similar
              severity.
            </p>

            <p className="mt-2 text-[11px] text-slate-500">
              Decision-support only.
              Final clinical
              prioritization must be
              determined by qualified
              healthcare
              professionals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}