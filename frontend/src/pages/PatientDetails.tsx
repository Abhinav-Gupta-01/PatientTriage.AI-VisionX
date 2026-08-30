import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CalendarClock,
  Clock3,
  FileText,
  HeartPulse,
  ShieldAlert,
  UserRound,
  Wind,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import api from "../services/api";
import {
  PriorityBadge,
  RiskBadge,
  ConfidenceBar,
  NewsBadge,
} from "../components/ui/Badges";

function formatDate(value: any) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function percent(value: any) {
  const number = Number(value ?? 0);

  if (number <= 1) {
    return Math.round(number * 100);
  }

  return Math.round(number);
}

function safe(value: any, fallback = "Not recorded") {
  return value === null ||
    value === undefined ||
    value === ""
    ? fallback
    : value;
}

function riskColor(risk: string) {
  switch (risk) {
    case "HIGH":
      return "text-red-600";

    case "MEDIUM":
      return "text-orange-600";

    case "LOW":
      return "text-green-600";

    default:
      return "text-slate-600";
  }
}

function VitalCard({
  label,
  value,
  unit,
  icon,
  warning,
}: {
  label: string;
  value: any;
  unit?: string;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warning
          ? "border-red-200 bg-red-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>

        <span
          className={
            warning
              ? "text-red-500"
              : "text-slate-400"
          }
        >
          {icon}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900">
          {safe(value, "—")}
        </span>

        {unit && (
          <span className="text-xs text-slate-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        {icon && (
          <span className="text-indigo-600">
            {icon}
          </span>
        )}

        <h2 className="font-semibold text-slate-800">
          {title}
        </h2>
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

export default function PatientDetails() {
  const { id } = useParams();

  /*
   * Patient 360 uses the dedicated backend patient endpoint.
   */
  const {
    data: patient,
    isLoading: patientLoading,
    isError: patientError,
  } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

  /*
   * Latest triage assessment.
   */
  const { data: triageData } = useQuery({
    queryKey: ["patient-triage", id],
    queryFn: async () => {
      const response = await api.get(
        `/patients/${id}/triage`
      );

      return response.data;
    },
    enabled: Boolean(id),
  });

  /*
   * Historical reassessments.
   */
  const { data: reassessmentsData } = useQuery({
    queryKey: ["patient-reassessments", id],
    queryFn: async () => {
      const response = await api.get(
        `/patients/${id}/reassessments`
      );

      return response.data;
    },
    enabled: Boolean(id),
  });

  /*
   * Loading state.
   */
  if (patientLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>

        <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  /*
   * Error state.
   */
  if (patientError || !patient) {
    return (
      <div className="card p-10 text-center">
        <AlertTriangle
          size={32}
          className="mx-auto text-red-500"
        />

        <h2 className="mt-3 font-semibold text-slate-800">
          Unable to load patient
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          The patient record could not be retrieved.
        </p>

        <Link
          to="/queue"
          className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          Back to Queue
        </Link>
      </div>
    );
  }

  /*
   * Some APIs return the object directly while others
   * may return { patient: {...} }.
   */
  const patientRecord =
    patient.patient ?? patient;

  const triage =
    triageData?.triage ??
    triageData ??
    patientRecord.triage ??
    {};

  const reassessments =
    reassessmentsData?.reassessments ??
    reassessmentsData ??
    [];

  const latestVitals =
    patientRecord.vitals ??
    patientRecord.latest_vitals ??
    {};

  const risk =
    String(
      triage.deterioration_risk ??
        triage.deteriorationRisk ??
        "UNKNOWN"
    ).toUpperCase();

  const riskProbability = percent(
    triage.risk_probability ??
      triage.riskProbability
  );

  const confidence = percent(
    triage.confidence
  );

  const priority =
    triage.priority ??
    patientRecord.priority ??
    5;

  /*
   * Create chart data from reassessments.
   */
  const vitalTrendData = useMemo(() => {
    return reassessments
      .slice()
      .reverse()
      .map((item: any, index: number) => {
        const vitals =
          item.vitals ??
          item.patient_vitals ??
          item;

        return {
          time:
            item.created_at ||
            item.recorded_at ||
            `R${index + 1}`,

          heartRate:
            vitals.heart_rate ??
            vitals.heartRate ??
            null,

          spo2:
            vitals.spo2 ??
            null,

          respiratoryRate:
            vitals.respiratory_rate ??
            vitals.respiratoryRate ??
            null,

          temperature:
            vitals.temperature ??
            null,
        };
      });
  }, [reassessments]);

  /*
   * Latest key factors.
   */
  const keyFactors =
    triage.key_factors ??
    triage.keyFactors ??
    [];

  const factorList = Array.isArray(keyFactors)
    ? keyFactors
    : [keyFactors];

  /*
   * Symptoms.
   */
  const symptoms =
    patientRecord.symptoms ??
    patientRecord.patient_symptoms ??
    [];

  const symptomList = Array.isArray(symptoms)
    ? symptoms
    : [symptoms];

  /*
   * Determine whether current vitals have
   * obvious prototype warning flags.
   */
  const spo2Warning =
    Number(latestVitals.spo2) > 0 &&
    Number(latestVitals.spo2) < 94;

  const hrWarning =
    Number(latestVitals.heart_rate) > 100 ||
    Number(latestVitals.heart_rate) < 50;

  const rrWarning =
    Number(latestVitals.respiratory_rate) > 20 ||
    Number(latestVitals.respiratory_rate) < 10;

  return (
    <div className="space-y-5">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="flex flex-col gap-4">

        <Link
          to="/queue"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft size={16} />

          Back to Smart Queue
        </Link>

        <div className="card overflow-hidden">

          <div className="border-b border-slate-100 p-5">

            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <UserRound size={28} />
                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <h1 className="text-2xl font-bold text-slate-900">
                      {safe(
                        patientRecord.patient_code,
                        "Patient"
                      )}
                    </h1>

                    <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                      SIMULATED DATA
                    </span>

                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Patient 360° clinical decision-support workspace
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap gap-2">

                <PriorityBadge p={priority} />

                <RiskBadge r={risk} />

                <span className="badge bg-slate-100 text-slate-700">
                  {safe(
                    patientRecord.status,
                    "Waiting"
                  )}
                </span>

              </div>

            </div>

          </div>

          {/* Top metrics */}
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 lg:grid-cols-5 lg:divide-y-0">

            <div className="p-4">
              <div className="text-xs text-slate-500">
                Age
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {safe(patientRecord.age)}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-slate-500">
                Sex
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {safe(patientRecord.sex)}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-slate-500">
                Deterioration Risk
              </div>

              <div
                className={`mt-1 text-lg font-bold ${riskColor(
                  risk
                )}`}
              >
                {riskProbability}%
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-slate-500">
                AI Confidence
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {confidence}%
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-slate-500">
                Waiting Time
              </div>

              <div className="mt-1 flex items-center gap-1 text-lg font-bold text-slate-900">
                <Clock3 size={16} />

                {safe(
                  patientRecord.waiting_minutes,
                  
                )}{" "}
                min
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ================================================= */}
      {/* CLINICAL SUMMARY */}
      {/* ================================================= */}

      <div className="grid gap-5 lg:grid-cols-3">

        {/* Patient information */}
        <Section
          title="Patient Overview"
          icon={<UserRound size={18} />}
        >
          <div className="space-y-4">

            <div>
              <div className="text-xs text-slate-500">
                Chief Complaint
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {safe(
                  patientRecord.chief_complaint
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">
                Arrival
              </div>

              <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                <CalendarClock size={15} />

                {formatDate(
                  patientRecord.arrival_time
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">
                Care Pathway
              </div>

              <div className="mt-1 font-medium text-slate-800">
                {safe(
                  triage.care_pathway ??
                    triage.carePathway
                )}
              </div>
            </div>

          </div>
        </Section>

        {/* Symptoms */}
        <Section
          title="Symptoms"
          icon={<Activity size={18} />}
        >
          <div className="space-y-3">

            <div>
              <div className="text-xs text-slate-500">
                Symptoms
              </div>

              <div className="mt-2 flex flex-wrap gap-2">

                {symptomList.length > 0 &&
                symptomList.some(Boolean) ? (
                  symptomList.map(
                    (symptom: any, index: number) => (
                      <span
                        key={index}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700"
                      >
                        {typeof symptom === "string"
                          ? symptom
                          : symptom?.symptom ??
                            symptom?.name ??
                            JSON.stringify(
                              symptom
                            )}
                      </span>
                    )
                  )
                ) : (
                  <span className="text-sm text-slate-500">
                    No symptoms recorded
                  </span>
                )}

              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <div className="text-xs text-slate-500">
                  Pain Score
                </div>

                <div className="mt-1 font-semibold">
                  {safe(
                    patientRecord.pain_score
                  )}
                  /10
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">
                  Duration
                </div>

                <div className="mt-1 font-semibold">
                  {safe(
                    patientRecord.duration
                  )}
                </div>
              </div>

            </div>

          </div>
        </Section>

        {/* History */}
        <Section
          title="Clinical Context"
          icon={<FileText size={18} />}
        >
          <div className="space-y-4">

            <div>
              <div className="text-xs text-slate-500">
                Medical History
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-700">
                {safe(
                  patientRecord.medical_history
                )}
              </p>
            </div>

            <div>
              <div className="text-xs text-slate-500">
                Medications
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-700">
                {safe(
                  patientRecord.medications
                )}
              </p>
            </div>

            <div>
              <div className="text-xs text-slate-500">
                Allergies
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-700">
                {safe(
                  patientRecord.allergies
                )}
              </p>
            </div>

          </div>
        </Section>

      </div>

      {/* ================================================= */}
      {/* VITALS */}
      {/* ================================================= */}

      <Section
        title="Current Vitals"
        icon={<HeartPulse size={18} />}
      >

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">

          <VitalCard
            label="Heart Rate"
            value={latestVitals.heart_rate}
            unit="bpm"
            warning={hrWarning}
            icon={<HeartPulse size={17} />}
          />

          <VitalCard
            label="SpO₂"
            value={latestVitals.spo2}
            unit="%"
            warning={spo2Warning}
            icon={<Wind size={17} />}
          />

          <VitalCard
            label="Respiratory Rate"
            value={latestVitals.respiratory_rate}
            unit="/min"
            warning={rrWarning}
            icon={<Activity size={17} />}
          />

          <VitalCard
            label="Temperature"
            value={latestVitals.temperature}
            unit="°C"
            icon={<Activity size={17} />}
          />

          <VitalCard
            label="Blood Pressure"
            value={
              latestVitals.systolic_bp != null
                ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}`
                : null
            }
            unit="mmHg"
            icon={<HeartPulse size={17} />}
          />

        </div>

      </Section>

      {/* ================================================= */}
      {/* RISK ASSESSMENT */}
      {/* ================================================= */}

      <div className="grid gap-5 lg:grid-cols-2">

        <Section
          title="Risk Assessment"
          icon={<ShieldAlert size={18} />}
        >

          <div className="space-y-5">

            <div className="flex items-center justify-between">

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Priority
                </div>

                <div className="mt-2">
                  <PriorityBadge p={priority} />
                </div>
              </div>

              <div className="text-right">

                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Deterioration Risk
                </div>

                <div
                  className={`mt-1 text-2xl font-bold ${riskColor(
                    risk
                  )}`}
                >
                  {riskProbability}%
                </div>

              </div>

            </div>

            <div>
              <div className="mb-2 flex justify-between text-xs">

                <span className="text-slate-500">
                  AI Confidence
                </span>

                <strong>
                  {confidence}%
                </strong>

              </div>

              <ConfidenceBar
                c={triage.confidence}
              />
            </div>

            <div>
              <div className="text-xs text-slate-500">
                Reassessment Interval
              </div>

              <div className="mt-1 font-semibold text-slate-800">
                {safe(
                  triage.reassessment_minutes ??
                    triage.reassessmentMinutes
                )}{" "}
                minutes
              </div>
            </div>

          </div>

        </Section>

        {/* AI Explanation */}
        <Section
          title="AI Explanation"
          icon={<ShieldAlert size={18} />}
        >

          <div className="space-y-4">

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">

              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Prototype Model Output
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                {safe(
                  triage.explanation,
                  "No explanation has been generated for this assessment."
                )}
              </p>

            </div>

            <div>

              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Key Factors
              </div>

              <div className="space-y-2">

                {factorList.length > 0 &&
                factorList.some(Boolean) ? (
                  factorList.map(
                    (factor: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />

                        <span>
                          {typeof factor === "string"
                            ? factor
                            : factor?.factor ??
                              factor?.name ??
                              JSON.stringify(
                                factor
                              )}
                        </span>
                      </div>
                    )
                  )
                ) : (
                  <div className="text-sm text-slate-500">
                    No key factors recorded.
                  </div>
                )}

              </div>

            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Model:{" "}
              {safe(
                triage.model_version ??
                  triage.modelVersion,
                "Prototype Risk Model"
              )}
              <br />
              This output is decision-support only
              and is not clinically validated.
            </div>

          </div>

        </Section>

      </div>

      {/* ================================================= */}
      {/* VITAL TRENDS */}
      {/* ================================================= */}

      <Section
        title="Vital Trends"
        icon={<Activity size={18} />}
      >

        {vitalTrendData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">

            <Activity
              size={28}
              className="mx-auto text-slate-300"
            />

            <p className="mt-2 text-sm text-slate-500">
              No historical vital measurements are
              available yet.
            </p>

          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">

            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700">
                Heart Rate
              </div>

              <div className="h-64">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart data={vitalTrendData}>

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="time"
                      tickFormatter={(value) =>
                        new Date(
                          value
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                    />

                    <YAxis />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="heartRate"
                      stroke="currentColor"
                      className="text-indigo-600"
                      strokeWidth={2}
                      dot={false}
                    />

                  </LineChart>
                </ResponsiveContainer>

              </div>

            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-slate-700">
                SpO₂
              </div>

              <div className="h-64">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart data={vitalTrendData}>

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="time"
                      tickFormatter={(value) =>
                        new Date(
                          value
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                    />

                    <YAxis />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="spo2"
                      stroke="currentColor"
                      className="text-red-500"
                      strokeWidth={2}
                      dot={false}
                    />

                  </LineChart>
                </ResponsiveContainer>

              </div>

            </div>

          </div>
        )}

      </Section>

      {/* ================================================= */}
      {/* REASSESSMENT TIMELINE */}
      {/* ================================================= */}

      <Section
        title="Reassessment Timeline"
        icon={<Clock3 size={18} />}
      >

        {reassessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No reassessments recorded yet.
          </div>
        ) : (
          <div className="relative ml-3 border-l border-slate-200 pl-6">

            {reassessments.map(
              (item: any, index: number) => {

                const assessment =
                  item.triage ??
                  item.assessment ??
                  item;

                return (
                  <div
                    key={item.id ?? index}
                    className="relative pb-7 last:pb-0"
                  >

                    <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow" />

                    <div className="rounded-xl border border-slate-200 p-4">

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div className="text-sm font-semibold text-slate-800">
                          Reassessment #{index + 1}
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatDate(
                            item.created_at ??
                              item.recorded_at
                          )}
                        </div>

                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">

                        {assessment.priority && (
                          <PriorityBadge
                            p={assessment.priority}
                          />
                        )}

                        {assessment.deterioration_risk && (
                          <RiskBadge
                            r={
                              assessment.deterioration_risk
                            }
                          />
                        )}

                        {assessment.confidence != null && (
                          <span className="badge bg-slate-100 text-slate-700">
                            Confidence{" "}
                            {percent(
                              assessment.confidence
                            )}
                            %
                          </span>
                        )}

                      </div>

                      {assessment.reason && (
                        <p className="mt-3 text-sm text-slate-600">
                          {assessment.reason}
                        </p>
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </Section>

      {/* ================================================= */}
      {/* SAFETY */}
      {/* ================================================= */}

      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">

        <div className="flex gap-3">

          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0 text-yellow-600"
          />

          <div>

            <div className="text-sm font-semibold text-yellow-900">
              Clinical decision-support prototype
            </div>

            <p className="mt-1 text-xs leading-5 text-yellow-800">
              PatientTriage.ai uses simulated data and
              prototype model outputs. It does not
              diagnose, prescribe treatment, or replace
              qualified clinical judgment.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}