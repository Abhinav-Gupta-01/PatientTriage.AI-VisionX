import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Edit3,
  ShieldAlert,
  X,
  Save,
} from "lucide-react";

import api from "../../services/api";

type DecisionType =
  | "accept"
  | "modify"
  | "override";

interface Props {
  patientId: string;

  triage: {
    id?: string;
    priority?: number;
    deterioration_risk?: string;
    confidence?: number;
    care_pathway?: string;
    reassessment_minutes?: number;
  };
}

const pathways = [
  "General",
  "Respiratory",
  "Cardiac",
  "Trauma",
  "Neurological",
  "Pediatric",
];

export default function ClinicianDecisionPanel({
  patientId,
  triage,
}: Props) {
  const queryClient = useQueryClient();

  const [modal, setModal] =
    useState<DecisionType | null>(null);

  const [priority, setPriority] =
    useState(
      Number(triage.priority ?? 5)
    );

  const [pathway, setPathway] =
    useState(
      triage.care_pathway ?? "General"
    );

  const [reassessmentMinutes, setReassessmentMinutes] =
    useState(
      Number(
        triage.reassessment_minutes ?? 30
      )
    );

  const [reason, setReason] =
    useState("");

  /*
   * Existing decision history.
   */
  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: [
      "clinician-decisions",
      patientId,
    ],

    queryFn: async () => {
      const response = await api.get(
        `/patients/${patientId}/decisions`
      );

      return response.data;
    },

    enabled: Boolean(patientId),
  });

  const decisions =
    data?.decisions ?? [];

  /*
   * Save decision.
   */
  const mutation = useMutation({
    mutationFn: async (
      decisionType: DecisionType
    ) => {
      const response = await api.post(
        `/patients/${patientId}/decisions`,
        {
          decision_type: decisionType,

          triage_id:
            triage.id ?? null,

          ai_recommended_priority:
            triage.priority ?? null,

          ai_recommended_risk:
            triage.deterioration_risk ??
            null,

          ai_confidence:
            triage.confidence ?? null,

          final_priority:
            decisionType === "accept"
              ? triage.priority
              : priority,

          final_risk:
            triage.deterioration_risk ??
            null,

          final_care_pathway:
            decisionType === "accept"
              ? triage.care_pathway
              : pathway,

          final_reassessment_minutes:
            decisionType === "accept"
              ? triage.reassessment_minutes
              : reassessmentMinutes,

          reason:
            reason.trim() || null,
        }
      );

      return response.data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "clinician-decisions",
          patientId,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: ["patient", patientId],
      });

      queryClient.invalidateQueries({
        queryKey: ["patients"],
      });

      setModal(null);
      setReason("");
    },
  });

  const openModal = (
    type: DecisionType
  ) => {
    setPriority(
      Number(triage.priority ?? 5)
    );

    setPathway(
      triage.care_pathway ??
        "General"
    );

    setReassessmentMinutes(
      Number(
        triage.reassessment_minutes ??
          30
      )
    );

    setReason("");

    setModal(type);
  };

  const submit = () => {
    if (!modal) return;

    if (
      (modal === "modify" ||
        modal === "override") &&
      !reason.trim()
    ) {
      return;
    }

    mutation.mutate(modal);
  };

  return (
    <div className="space-y-5">

      {/* ================================================= */}
      {/* CURRENT AI RECOMMENDATION */}
      {/* ================================================= */}

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">

        <div className="flex items-start justify-between gap-4">

          <div>

            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              AI Recommendation
            </div>

            <div className="mt-2 text-xl font-bold text-slate-900">
              P{triage.priority ?? "—"}
            </div>

            <div className="mt-1 text-sm text-slate-600">
              {triage.deterioration_risk ??
                "Unknown"}{" "}
              deterioration risk
            </div>

          </div>

          <div className="text-right">

            <div className="text-xs text-slate-500">
              Confidence
            </div>

            <div className="mt-1 text-lg font-bold text-slate-900">
              {Math.round(
                Number(
                  triage.confidence ?? 0
                ) <= 1
                  ? Number(
                      triage.confidence ?? 0
                    ) * 100
                  : Number(
                      triage.confidence ?? 0
                    )
              )}
              %
            </div>

          </div>

        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">

          <div className="rounded-lg bg-white p-3">
            <div className="text-[11px] text-slate-500">
              Care Pathway
            </div>

            <div className="mt-1 text-sm font-semibold">
              {triage.care_pathway ??
                "Not specified"}
            </div>
          </div>

          <div className="rounded-lg bg-white p-3">
            <div className="text-[11px] text-slate-500">
              Reassessment
            </div>

            <div className="mt-1 text-sm font-semibold">
              {triage.reassessment_minutes ??
                "—"}{" "}
              min
            </div>
          </div>

          <div className="rounded-lg bg-white p-3">
            <div className="text-[11px] text-slate-500">
              Model
            </div>

            <div className="mt-1 text-sm font-semibold">
              Prototype AI
            </div>
          </div>

        </div>

      </div>

      {/* ================================================= */}
      {/* ACTION BUTTONS */}
      {/* ================================================= */}

      <div className="grid gap-3 sm:grid-cols-3">

        <button
          onClick={() =>
            openModal("accept")
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <CheckCircle2 size={17} />

          Accept
        </button>

        <button
          onClick={() =>
            openModal("modify")
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
        >
          <Edit3 size={17} />

          Modify
        </button>

        <button
          onClick={() =>
            openModal("override")
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          <ShieldAlert size={17} />

          Override AI
        </button>

      </div>

      {/* ================================================= */}
      {/* HISTORY */}
      {/* ================================================= */}

      <div>

        <div className="mb-3 text-sm font-semibold text-slate-800">
          Clinician Decision History
        </div>

        {isLoading ? (
          <div className="text-sm text-slate-500">
            Loading decision history...
          </div>
        ) : decisions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            No clinician decisions recorded yet.
          </div>
        ) : (
          <div className="space-y-3">

            {decisions.map(
              (decision: any) => (
                <div
                  key={decision.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-center gap-2">

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                          decision.decision_type ===
                          "accept"
                            ? "bg-green-100 text-green-700"
                            : decision.decision_type ===
                              "modify"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {decision.decision_type}
                      </span>

                      <span className="text-sm font-semibold">
                        P
                        {
                          decision.final_priority
                        }
                      </span>

                    </div>

                    <span className="text-xs text-slate-500">
                      {decision.created_at
                        ? new Date(
                            decision.created_at
                          ).toLocaleString()
                        : "—"}
                    </span>

                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">

                    <div>
                      <div className="text-[11px] text-slate-500">
                        AI Priority
                      </div>

                      <div className="text-sm font-semibold">
                        P
                        {
                          decision.ai_recommended_priority
                        }
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-500">
                        Final Priority
                      </div>

                      <div className="text-sm font-semibold">
                        P
                        {
                          decision.final_priority
                        }
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-500">
                        Clinician Role
                      </div>

                      <div className="text-sm font-semibold capitalize">
                        {decision.clinician_role ??
                          "Clinician"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-500">
                        Pathway
                      </div>

                      <div className="text-sm font-semibold">
                        {decision.final_care_pathway ??
                          "—"}
                      </div>
                    </div>

                  </div>

                  {decision.reason && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3">

                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Reason
                      </div>

                      <p className="mt-1 text-sm text-slate-700">
                        {decision.reason}
                      </p>

                    </div>
                  )}

                </div>
              )
            )}

          </div>
        )}

      </div>

      {/* ================================================= */}
      {/* MODAL */}
      {/* ================================================= */}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-100 p-5">

              <div>

                <h3 className="text-lg font-bold text-slate-900">
                  {modal === "accept"
                    ? "Accept AI Recommendation"
                    : modal === "modify"
                    ? "Modify Recommendation"
                    : "Override AI Recommendation"}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  This action will be permanently recorded.
                </p>

              </div>

              <button
                onClick={() =>
                  setModal(null)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>

            </div>

            <div className="space-y-4 p-5">

              {/* Modify / Override controls */}
              {modal !== "accept" && (
                <>
                  <div>

                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Final Priority
                    </label>

                    <select
                      value={priority}
                      onChange={(e) =>
                        setPriority(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value={1}>
                        P1 — Immediate
                      </option>

                      <option value={2}>
                        P2 — Emergent
                      </option>

                      <option value={3}>
                        P3 — Urgent
                      </option>

                      <option value={4}>
                        P4 — Less Urgent
                      </option>

                      <option value={5}>
                        P5 — Non-Urgent
                      </option>
                    </select>

                  </div>

                  <div>

                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Care Pathway
                    </label>

                    <select
                      value={pathway}
                      onChange={(e) =>
                        setPathway(
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      {pathways.map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        )
                      )}
                    </select>

                  </div>

                  <div>

                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Reassessment Interval
                    </label>

                    <select
                      value={
                        reassessmentMinutes
                      }
                      onChange={(e) =>
                        setReassessmentMinutes(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value={5}>
                        5 minutes
                      </option>

                      <option value={15}>
                        15 minutes
                      </option>

                      <option value={30}>
                        30 minutes
                      </option>

                      <option value={60}>
                        60 minutes
                      </option>

                      <option value={120}>
                        120 minutes
                      </option>
                    </select>

                  </div>
                </>
              )}

              {/* Reason */}
              <div>

                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Reason{" "}
                  {modal !== "accept" && (
                    <span className="text-red-500">
                      *
                    </span>
                  )}
                </label>

                <textarea
                  value={reason}
                  onChange={(e) =>
                    setReason(
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder={
                    modal === "accept"
                      ? "Optional clinical note..."
                      : "Enter the clinical reason for this decision..."
                  }
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />

                {modal !== "accept" &&
                  !reason.trim() && (
                    <p className="mt-1 text-xs text-red-500">
                      A reason is required.
                    </p>
                  )}

              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-5">

              <button
                onClick={() =>
                  setModal(null)
                }
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                onClick={submit}
                disabled={
                  mutation.isPending ||
                  (modal !== "accept" &&
                    !reason.trim())
                }
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >

                <Save size={16} />

                {mutation.isPending
                  ? "Saving..."
                  : "Record Decision"}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}