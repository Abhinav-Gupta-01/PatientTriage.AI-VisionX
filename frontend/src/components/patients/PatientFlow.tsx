import { useState } from "react";
import {
  Play,
  Building2,
  LogOut,
  XCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface PatientFlowProps {
  patientId: string;
  status?: string;
  onStatusChange?: (status: string) => void;
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

export default function PatientFlow({
  patientId,
  status = "Waiting",
  onStatusChange,
}: PatientFlowProps) {
  const [currentStatus, setCurrentStatus] =
    useState(status);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const token =
    localStorage.getItem("token");

  async function changeStatus(
    endpoint: string,
    newStatus: string
  ) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/patients/${patientId}/${endpoint}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to update patient status"
        );
      }

      setCurrentStatus(
        data.patient?.status ||
          newStatus
      );

      onStatusChange?.(
        data.patient?.status ||
          newStatus
      );
    } catch (err: any) {
      console.error(
        "PATIENT FLOW ERROR:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  function renderStatusBadge() {
    if (
      currentStatus === "Waiting"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Waiting
        </span>
      );
    }

    if (
      currentStatus ===
      "In Treatment"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          In Treatment
        </span>
      );
    }

    if (
      currentStatus === "Admitted"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-sm font-semibold text-purple-700">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          Admitted
        </span>
      );
    }

    if (
      currentStatus ===
      "Discharged"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
          <CheckCircle2
            size={15}
          />
          Discharged
        </span>
      );
    }

    if (
      currentStatus ===
      "Cancelled"
    ) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
          <XCircle
            size={15}
          />
          Cancelled
        </span>
      );
    }

    return (
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
        {currentStatus}
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Patient Flow
          </p>

          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            Current Status
          </h3>
        </div>

        {renderStatusBadge()}
      </div>

      {/* Progress */}

      <div className="mt-8">

        <div className="flex items-center">

          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              currentStatus !== "Waiting"
                ? "bg-indigo-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            1
          </div>

          <div
            className={`h-1 flex-1 ${
              currentStatus ===
                "In Treatment" ||
              currentStatus ===
                "Admitted" ||
              currentStatus ===
                "Discharged"
                ? "bg-indigo-600"
                : "bg-slate-200"
            }`}
          />

          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              currentStatus ===
                "In Treatment" ||
              currentStatus ===
                "Admitted" ||
              currentStatus ===
                "Discharged"
                ? "bg-indigo-600 text-white"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            2
          </div>

          <div
            className={`h-1 flex-1 ${
              currentStatus ===
                "Admitted" ||
              currentStatus ===
                "Discharged"
                ? "bg-indigo-600"
                : "bg-slate-200"
            }`}
          />

          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              currentStatus ===
                "Admitted" ||
              currentStatus ===
                "Discharged"
                ? "bg-indigo-600 text-white"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            3
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs font-medium text-slate-500">
          <span>Waiting</span>
          <span>In Treatment</span>
          <span>Disposition</span>
        </div>

      </div>

      {/* Error */}

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}

      <div className="mt-7 flex flex-wrap gap-3">

        {/* Waiting */}

        {currentStatus ===
          "Waiting" && (
          <button
            disabled={loading}
            onClick={() =>
              changeStatus(
                "start-treatment",
                "In Treatment"
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2
                size={18}
                className="animate-spin"
              />
            ) : (
              <Play size={18} />
            )}

            Start Treatment
          </button>
        )}

        {/* In Treatment */}

        {currentStatus ===
          "In Treatment" && (
          <>
            <button
              disabled={loading}
              onClick={() =>
                changeStatus(
                  "admit",
                  "Admitted"
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <Building2
                  size={18}
                />
              )}

              Admit Patient
            </button>

            <button
              disabled={loading}
              onClick={() =>
                changeStatus(
                  "discharge",
                  "Discharged"
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <LogOut
                  size={18}
                />
              )}

              Discharge Patient
            </button>
          </>
        )}

        {/* Terminal state */}

        {(currentStatus ===
          "Admitted" ||
          currentStatus ===
            "Discharged" ||
          currentStatus ===
            "Cancelled") && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            <CheckCircle2
              size={17}
            />
            No further ED actions
            required
          </div>
        )}

      </div>

      {/* Explanation */}

      <div className="mt-6 rounded-xl bg-slate-50 p-4">

        <p className="text-sm leading-6 text-slate-600">
          <strong className="text-slate-800">
            Note:
          </strong>{" "}
          Accepting an AI recommendation does
          not remove the patient from the queue.
          The patient leaves the waiting queue when
          treatment is started.
        </p>

      </div>
    </div>
  );
}