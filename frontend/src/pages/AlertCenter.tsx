import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  RefreshCw,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react";

import api from "../services/api";

type AlertItem = {
  id: string;
  patient_id?: string;
  patientId?: string;

  patient_code?: string;
  patientCode?: string;

  type?: string;
  alert_type?: string;

  severity?: string;
  priority?: number;

  message?: string;
  reason?: string;
  description?: string;

  status?: string;
  resolved?: boolean;

  created_at?: string;
  resolved_at?: string;

  patient?: {
    id?: string;
    patient_code?: string;
    age?: number;
    sex?: string;
  };
};

type FilterType =
  | "ALL"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "RESOLVED";


// =====================================================
// HELPERS
// =====================================================

function normalizeSeverity(
  alert: AlertItem
): string {
  const value = String(
    alert.severity ??
      alert.type ??
      alert.alert_type ??
      ""
  ).toUpperCase();

  if (
    value.includes("CRITICAL") ||
    value.includes("P1")
  ) {
    return "CRITICAL";
  }

  if (
    value.includes("HIGH") ||
    value.includes("P2")
  ) {
    return "HIGH";
  }

  if (
    value.includes("MEDIUM") ||
    value.includes("MODERATE") ||
    value.includes("P3")
  ) {
    return "MEDIUM";
  }

  return "LOW";
}


function isResolved(
  alert: AlertItem
): boolean {
  if (alert.resolved === true) {
    return true;
  }

  const status = String(
    alert.status ?? ""
  ).toUpperCase();

  return (
    status === "RESOLVED" ||
    status === "CLOSED"
  );
}


function formatTime(
  value?: string
) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  return date.toLocaleString(
    [],
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}


function getPatientId(
  alert: AlertItem
) {
  return (
    alert.patient_id ??
    alert.patientId ??
    alert.patient?.id ??
    (alert as any).patients?.id
  );
}


function getPatientCode(
  alert: AlertItem
) {
  return (
    alert.patient_code ??
    alert.patientCode ??
    alert.patient?.patient_code ??
    (alert as any).patients?.patient_code ??
    "Unknown patient"
  );
}


function getMessage(
  alert: AlertItem
) {
  return (
    alert.message ??
    alert.reason ??
    alert.description ??
    "Clinical alert requires attention."
  );
}


// =====================================================
// SEVERITY BADGE
// =====================================================

function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    CRITICAL:
      "bg-red-100 text-red-700 border-red-200",

    HIGH:
      "bg-orange-100 text-orange-700 border-orange-200",

    MEDIUM:
      "bg-yellow-100 text-yellow-700 border-yellow-200",

    LOW:
      "bg-blue-100 text-blue-700 border-blue-200",
  };

  const icons: Record<
    string,
    any
  > = {
    CRITICAL: Siren,
    HIGH: ShieldAlert,
    MEDIUM: AlertTriangle,
    LOW: Bell,
  };

  const Icon =
    icons[severity] ??
    Bell;

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " +
        (styles[severity] ??
          styles.LOW)
      }
    >
      <Icon size={13} />

      {severity}
    </span>
  );
}


// =====================================================
// ALERT CARD
// =====================================================

function AlertCard({
  alert,
  onResolve,
  resolving,
}: {
  alert: AlertItem;
  onResolve: (
    id: string
  ) => void;
  resolving: string | null;
}) {
  const severity =
    normalizeSeverity(alert);

  const resolved =
    isResolved(alert);

  const patientId =
    getPatientId(alert);

  const patientCode =
    getPatientCode(alert);

  const message =
    getMessage(alert);

  return (
    <div
      className={
        "rounded-xl border bg-white p-4 shadow-sm transition " +
        (resolved
          ? "border-slate-200 opacity-70"
          : severity ===
            "CRITICAL"
          ? "border-red-200"
          : severity === "HIGH"
          ? "border-orange-200"
          : "border-slate-200")
      }
    >

      {/* TOP */}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

        <div className="flex gap-3">

          <div
            className={
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " +
              (severity ===
              "CRITICAL"
                ? "bg-red-100 text-red-600"
                : severity === "HIGH"
                ? "bg-orange-100 text-orange-600"
                : severity === "MEDIUM"
                ? "bg-yellow-100 text-yellow-600"
                : "bg-blue-100 text-blue-600")
            }
          >
            {severity ===
            "CRITICAL" ? (
              <Siren size={20} />
            ) : (
              <Bell size={20} />
            )}
          </div>


          <div>

            <div className="flex flex-wrap items-center gap-2">

              <SeverityBadge
                severity={
                  severity
                }
              />

              {resolved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">

                  <CheckCircle2
                    size={13}
                  />

                  Resolved

                </span>
              )}

            </div>


            <h3 className="mt-2 font-semibold text-slate-900">

              {patientCode}

            </h3>


            <p className="mt-1 text-sm text-slate-600">

              {message}

            </p>

          </div>

        </div>


        <div className="flex items-center gap-1 text-xs text-slate-400">

          <Clock3 size={13} />

          {formatTime(
            alert.created_at
          )}

        </div>

      </div>


      {/* META */}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">

        {alert.type && (

          <span className="text-xs text-slate-500">

            Type:

            {" "}

            <span className="font-medium text-slate-700">

              {alert.type}

            </span>

          </span>

        )}


        {alert.priority !==
          undefined && (

          <span className="text-xs text-slate-500">

            Priority:

            {" "}

            <span className="font-semibold text-slate-700">

              P{alert.priority}

            </span>

          </span>

        )}


        {alert.resolved_at && (

          <span className="text-xs text-slate-500">

            Resolved:

            {" "}

            {formatTime(
              alert.resolved_at
            )}

          </span>

        )}

      </div>


      {/* ACTIONS */}

      <div className="mt-4 flex flex-wrap justify-end gap-2">

        {patientId && (

          <Link
            to={`/patient/${patientId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >

            View Patient

            <ExternalLink
              size={14}
            />

          </Link>

        )}


        {!resolved && (

          <button
            onClick={() =>
              onResolve(
                alert.id
              )
            }
            disabled={
              resolving ===
              alert.id
            }
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {resolving ===
            alert.id ? (
              <>
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />

                Resolving...

              </>
            ) : (
              <>
                <CheckCircle2
                  size={14}
                />

                Resolve

              </>
            )}

          </button>

        )}

      </div>

    </div>
  );
}


// =====================================================
// MAIN ALERT CENTER
// =====================================================

export default function AlertCenter() {

  const qc =
    useQueryClient();

  const [filter, setFilter] =
    useState<FilterType>(
      "ALL"
    );

  const [resolving, setResolving] =
    useState<string | null>(
      null
    );

  const [search, setSearch] =
    useState("");


  // ===================================================
  // LOAD ALERTS
  // ===================================================

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["alerts"],

    queryFn: async () => {

      const response =
        await api.get(
          "/alerts"
        );

      return response.data;

    },

    // Keep Alert Center live.
    refetchInterval: 5000,

    refetchIntervalInBackground:
      false,
  });


  // ===================================================
  // NORMALIZE API RESPONSE
  // ===================================================

  const alerts: AlertItem[] =
    Array.isArray(data)
      ? data
      : Array.isArray(
          data?.alerts
        )
      ? data.alerts
      : Array.isArray(
          data?.data
        )
      ? data.data
      : [];


  // ===================================================
  // COUNTS
  // ===================================================

  const counts = useMemo(() => {

    const active =
      alerts.filter(
        (a) => !isResolved(a)
      );

    return {
      total:
        alerts.length,

      active:
        active.length,

      critical:
        active.filter(
          (a) =>
            normalizeSeverity(
              a
            ) === "CRITICAL"
        ).length,

      high:
        active.filter(
          (a) =>
            normalizeSeverity(
              a
            ) === "HIGH"
        ).length,

      medium:
        active.filter(
          (a) =>
            normalizeSeverity(
              a
            ) === "MEDIUM"
        ).length,

      low:
        active.filter(
          (a) =>
            normalizeSeverity(
              a
            ) === "LOW"
        ).length,

      resolved:
        alerts.filter(
          (a) => isResolved(a)
        ).length,
    };

  }, [alerts]);


  // ===================================================
  // FILTER
  // ===================================================

  const filteredAlerts =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();

      return alerts
        .filter((alert) => {

          const resolved =
            isResolved(alert);

          const severity =
            normalizeSeverity(
              alert
            );

          if (
            filter ===
            "RESOLVED"
          ) {
            return resolved;
          }

          if (
            filter !== "ALL"
          ) {
            if (
              resolved ||
              severity !==
                filter
            ) {
              return false;
            }
          } else if (
            resolved
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable =
            [
              getPatientCode(
                alert
              ),
              alert.type,
              alert.alert_type,
              alert.message,
              alert.reason,
              alert.description,
              severity,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            query
          );
        })
        .sort((a, b) => {

          const severityRank: Record<
            string,
            number
          > = {
            CRITICAL: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
          };

          const aRank =
            severityRank[
              normalizeSeverity(a)
            ] ?? 0;

          const bRank =
            severityRank[
              normalizeSeverity(b)
            ] ?? 0;

          if (
            aRank !== bRank
          ) {
            return (
              bRank - aRank
            );
          }

          return (
            new Date(
              b.created_at ??
                0
            ).getTime() -
            new Date(
              a.created_at ??
                0
            ).getTime()
          );
        });

    }, [
      alerts,
      filter,
      search,
    ]);


  // ===================================================
  // RESOLVE ALERT
  // ===================================================

  const resolveAlert =
    async (
      alertId: string
    ) => {

      try {

        setResolving(
          alertId
        );

        await api.post(
          `/alerts/${alertId}/resolve`
        );

        await qc.invalidateQueries(
          {
            queryKey: [
              "alerts",
            ],
          }
        );

      } catch (error) {

        console.error(
          "RESOLVE ALERT ERROR:",
          error
        );

        alert(
          "Unable to resolve alert."
        );

      } finally {

        setResolving(
          null
        );

      }
    };


  // ===================================================
  // LOADING
  // ===================================================

  if (isLoading) {

    return (
      <div className="space-y-5">

        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

          {Array.from({
            length: 5,
          }).map(
            (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl bg-slate-200"
              />
            )
          )}

        </div>

        <div className="h-32 animate-pulse rounded-xl bg-slate-200" />

        <div className="space-y-3">

          {Array.from({
            length: 4,
          }).map(
            (_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl bg-slate-200"
              />
            )
          )}

        </div>

      </div>
    );
  }


  // ===================================================
  // ERROR
  // ===================================================

  if (isError) {

    return (
      <div className="card p-10 text-center">

        <AlertTriangle
          size={36}
          className="mx-auto text-red-500"
        />

        <h2 className="mt-3 text-lg font-semibold text-slate-800">

          Unable to load alerts

        </h2>

        <p className="mt-1 text-sm text-slate-500">

          The alert service could not
          return the current alerts.

        </p>

        <button
          onClick={() =>
            refetch()
          }
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >

          <RefreshCw
            size={16}
          />

          Try Again

        </button>

      </div>
    );
  }


  // ===================================================
  // PAGE
  // ===================================================

  return (
    <div className="space-y-5">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div>

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

              <Bell size={22} />

            </div>

            <div>

              <h1 className="text-2xl font-bold text-slate-900">

                Intelligent Alert Center

              </h1>

              <p className="text-sm text-slate-500">

                Real-time clinical alerts
                requiring attention

              </p>

            </div>

          </div>

        </div>


        <div className="flex items-center gap-2">

          {isFetching && (

            <span className="text-xs text-slate-400">

              Updating...

            </span>

          )}

          <button
            onClick={() =>
              refetch()
            }
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >

            <RefreshCw
              size={14}
            />

            Refresh

          </button>

        </div>

      </div>


      {/* ================================================= */}
      {/* SUMMARY CARDS */}
      {/* ================================================= */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">

        <SummaryCard
          label="Active Alerts"
          value={
            counts.active
          }
          icon={
            <Bell size={20} />
          }
        />

        <SummaryCard
          label="Critical"
          value={
            counts.critical
          }
          icon={
            <Siren size={20} />
          }
          danger
        />

        <SummaryCard
          label="High"
          value={
            counts.high
          }
          icon={
            <ShieldAlert
              size={20}
            />
          }
        />

        <SummaryCard
          label="Medium"
          value={
            counts.medium
          }
          icon={
            <AlertTriangle
              size={20}
            />
          }
        />

        <SummaryCard
          label="Resolved"
          value={
            counts.resolved
          }
          icon={
            <CheckCircle2
              size={20}
            />
          }
        />

      </div>


      {/* ================================================= */}
      {/* SEARCH + FILTER */}
      {/* ================================================= */}

      <div className="card p-4">

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

          <div className="relative flex-1">

            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search patient, alert type, or message..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />

            {search && (

              <button
                onClick={() =>
                  setSearch("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >

                <X size={16} />

              </button>

            )}

          </div>


          <div className="flex flex-wrap gap-2">

            <FilterButton
              active={
                filter ===
                "ALL"
              }
              onClick={() =>
                setFilter(
                  "ALL"
                )
              }
            >
              All Active
            </FilterButton>


            <FilterButton
              active={
                filter ===
                "CRITICAL"
              }
              onClick={() =>
                setFilter(
                  "CRITICAL"
                )
              }
            >
              Critical
            </FilterButton>


            <FilterButton
              active={
                filter ===
                "HIGH"
              }
              onClick={() =>
                setFilter(
                  "HIGH"
                )
              }
            >
              High
            </FilterButton>


            <FilterButton
              active={
                filter ===
                "MEDIUM"
              }
              onClick={() =>
                setFilter(
                  "MEDIUM"
                )
              }
            >
              Medium
            </FilterButton>


            <FilterButton
              active={
                filter ===
                "LOW"
              }
              onClick={() =>
                setFilter(
                  "LOW"
                )
              }
            >
              Low
            </FilterButton>


            <FilterButton
              active={
                filter ===
                "RESOLVED"
              }
              onClick={() =>
                setFilter(
                  "RESOLVED"
                )
              }
            >
              Resolved
            </FilterButton>

          </div>

        </div>

      </div>


      {/* ================================================= */}
      {/* ALERT LIST */}
      {/* ================================================= */}

      <div className="space-y-3">

        {filteredAlerts.length ===
        0 ? (

          <div className="card p-12 text-center">

            <CheckCircle2
              size={40}
              className="mx-auto text-green-500"
            />

            <h2 className="mt-3 font-semibold text-slate-800">

              No alerts found

            </h2>

            <p className="mt-1 text-sm text-slate-500">

              {filter ===
              "RESOLVED"
                ? "There are no resolved alerts matching your search."
                : "There are currently no active alerts matching your filters."}

            </p>

          </div>

        ) : (

          filteredAlerts.map(
            (alert) => (

              <AlertCard
                key={
                  alert.id
                }
                alert={
                  alert
                }
                onResolve={
                  resolveAlert
                }
                resolving={
                  resolving
                }
              />

            )
          )

        )}

      </div>


      {/* ================================================= */}
      {/* FOOTER */}
      {/* ================================================= */}

      <div className="flex items-center justify-between text-xs text-slate-400">

        <span>

          Showing{" "}
          {
            filteredAlerts.length
          }{" "}
          alert
          {filteredAlerts.length !==
          1
            ? "s"
            : ""}

        </span>

        <span>

          Auto-refresh: 5 seconds

        </span>

      </div>

    </div>
  );
}


// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {

  return (
    <div
      className={
        "rounded-xl border bg-white p-4 shadow-sm " +
        (danger
          ? "border-red-200"
          : "border-slate-200")
      }
    >

      <div className="flex items-center justify-between">

        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">

          {label}

        </span>

        <span
          className={
            danger
              ? "text-red-500"
              : "text-slate-400"
          }
        >
          {icon}
        </span>

      </div>

      <div
        className={
          "mt-2 text-3xl font-bold " +
          (danger
            ? "text-red-600"
            : "text-slate-900")
        }
      >
        {value}
      </div>

    </div>
  );
}


// =====================================================
// FILTER BUTTON
// =====================================================

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {

  return (
    <button
      onClick={onClick}
      className={
        "rounded-lg px-3 py-2 text-xs font-medium transition " +
        (active
          ? "bg-indigo-600 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
      }
    >
      {children}
    </button>
  );
}