import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Brain,
  CheckCircle2,
  Clock3,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from "lucide-react";

interface DeteriorationTimelineProps {
  patient: any;
}

type TimelineEvent = {
  id: string;
  timestamp: string | Date;
  title: string;
  description: string;
  type:
    | "arrival"
    | "triage"
    | "vital"
    | "deterioration"
    | "alert"
    | "decision"
    | "reassessment"
    | "info";
  priority?: number;
  risk?: string;
  live?: boolean;
};

function safeDate(value: any) {
  if (!value) return new Date();

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return new Date();
  }

  return d;
}

function formatTime(value: any) {
  return safeDate(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: any) {
  return safeDate(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priorityLabel(priority: any) {
  if (priority === undefined || priority === null) {
    return "Unknown";
  }

  return `P${priority}`;
}

function getRiskClass(risk: string | undefined) {
  const value = String(risk || "").toUpperCase();

  if (value === "HIGH") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (value === "MEDIUM") {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  if (value === "LOW") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function getEventIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "arrival":
      return <UserRound size={17} />;

    case "triage":
      return <Brain size={17} />;

    case "vital":
      return <HeartPulse size={17} />;

    case "deterioration":
      return <ShieldAlert size={17} />;

    case "alert":
      return <AlertTriangle size={17} />;

    case "decision":
      return <Stethoscope size={17} />;

    case "reassessment":
      return <RefreshCw size={17} />;

    default:
      return <Activity size={17} />;
  }
}

function getEventIconClass(type: TimelineEvent["type"]) {
  switch (type) {
    case "deterioration":
      return "bg-red-100 text-red-600";

    case "alert":
      return "bg-orange-100 text-orange-600";

    case "decision":
      return "bg-indigo-100 text-indigo-600";

    case "reassessment":
      return "bg-blue-100 text-blue-600";

    case "vital":
      return "bg-purple-100 text-purple-600";

    case "triage":
      return "bg-cyan-100 text-cyan-600";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function DeteriorationTimeline({
  patient,
}: DeteriorationTimelineProps) {
  const [now, setNow] = useState(new Date());

  const previousSnapshot = useRef<{
    priority?: number;
    risk?: string;
    spo2?: number;
    heartRate?: number;
    respiratoryRate?: number;
    newsScore?: number;
  } | null>(null);

  const [liveEvent, setLiveEvent] =
    useState<TimelineEvent | null>(null);

  // Update "last updated" clock every second.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const latestTriage =
    patient?.latest_triage;

  const latestVitals =
    patient?.latest_vitals;

  const latestNews =
    patient?.news;

  /*
   * Detect deterioration between two patient refreshes.
   *
   * This does NOT diagnose a patient.
   * It only surfaces changes already present
   * in the application's simulated/recorded data.
   */
  useEffect(() => {
    if (!patient) return;

    const current = {
      priority:
        latestTriage?.priority != null
          ? Number(latestTriage.priority)
          : undefined,

      risk:
        latestTriage?.deterioration_risk
          ? String(
              latestTriage.deterioration_risk
            ).toUpperCase()
          : undefined,

      spo2:
        latestVitals?.spo2 != null
          ? Number(latestVitals.spo2)
          : undefined,

      heartRate:
        latestVitals?.heart_rate != null
          ? Number(latestVitals.heart_rate)
          : undefined,

      respiratoryRate:
        latestVitals?.respiratory_rate != null
          ? Number(
              latestVitals.respiratory_rate
            )
          : undefined,

      newsScore:
        latestNews?.score != null
          ? Number(latestNews.score)
          : undefined,
    };

    const previous =
      previousSnapshot.current;

    if (previous) {
      let detectedEvent:
        | TimelineEvent
        | null = null;

      // Priority increased in urgency:
      // P4 -> P3 -> P2 -> P1
      if (
        current.priority !== undefined &&
        previous.priority !== undefined &&
        current.priority < previous.priority
      ) {
        detectedEvent = {
          id: `live-priority-${Date.now()}`,
          timestamp: new Date(),
          title: "Priority Escalated",
          description:
            `Priority changed from ${priorityLabel(
              previous.priority
            )} to ${priorityLabel(
              current.priority
            )}.`,
          type: "deterioration",
          priority: current.priority,
          risk: current.risk,
          live: true,
        };
      }

      // Risk changed to HIGH.
      if (
        !detectedEvent &&
        current.risk === "HIGH" &&
        previous.risk !== "HIGH"
      ) {
        detectedEvent = {
          id: `live-risk-${Date.now()}`,
          timestamp: new Date(),
          title: "Deterioration Risk Increased",
          description:
            "The latest assessment now reports HIGH deterioration risk.",
          type: "deterioration",
          priority: current.priority,
          risk: current.risk,
          live: true,
        };
      }

      // SpO2 decrease >= 3 percentage points.
      if (
        !detectedEvent &&
        current.spo2 !== undefined &&
        previous.spo2 !== undefined &&
        previous.spo2 - current.spo2 >= 3
      ) {
        detectedEvent = {
          id: `live-spo2-${Date.now()}`,
          timestamp: new Date(),
          title: "SpO₂ Declining",
          description:
            `SpO₂ changed from ${previous.spo2}% to ${current.spo2}%.`,
          type: "deterioration",
          priority: current.priority,
          risk: current.risk,
          live: true,
        };
      }

      // Respiratory rate increased >= 4.
      if (
        !detectedEvent &&
        current.respiratoryRate !== undefined &&
        previous.respiratoryRate !== undefined &&
        current.respiratoryRate -
          previous.respiratoryRate >=
          4
      ) {
        detectedEvent = {
          id: `live-rr-${Date.now()}`,
          timestamp: new Date(),
          title: "Respiratory Rate Increased",
          description:
            `Respiratory rate changed from ${previous.respiratoryRate} to ${current.respiratoryRate}.`,
          type: "deterioration",
          priority: current.priority,
          risk: current.risk,
          live: true,
        };
      }

      // Heart rate increased >= 15.
      if (
        !detectedEvent &&
        current.heartRate !== undefined &&
        previous.heartRate !== undefined &&
        current.heartRate -
          previous.heartRate >=
          15
      ) {
        detectedEvent = {
          id: `live-hr-${Date.now()}`,
          timestamp: new Date(),
          title: "Heart Rate Increased",
          description:
            `Heart rate changed from ${previous.heartRate} to ${current.heartRate} bpm.`,
          type: "deterioration",
          priority: current.priority,
          risk: current.risk,
          live: true,
        };
      }

      // NEWS increased >= 2.
      if (
        !detectedEvent &&
        current.newsScore !== undefined &&
        previous.newsScore !== undefined &&
        current.newsScore -
          previous.newsScore >=
          2
      ) {
        detectedEvent = {
          id: `live-news-${Date.now()}`,
          timestamp: new Date(),
          title: "Early Warning Score Increased",
          description:
            `NEWS score changed from ${previous.newsScore} to ${current.newsScore}.`,
          type: "deterioration",
          priority: current.priority,
          risk: current.risk,
          live: true,
        };
      }

      if (detectedEvent) {
        setLiveEvent(detectedEvent);

        const timeout =
          window.setTimeout(() => {
            setLiveEvent(null);
          }, 8000);

        return () =>
          window.clearTimeout(timeout);
      }
    }

    previousSnapshot.current = current;
  }, [
    patient,
    latestTriage,
    latestVitals,
    latestNews,
  ]);

  const timeline =
    useMemo<TimelineEvent[]>(() => {
      if (!patient) return [];

      const events: TimelineEvent[] = [];

      // ---------------------------------------------
      // PATIENT ARRIVAL
      // ---------------------------------------------

      const arrivalTime =
        patient.arrival_time ||
        patient.created_at ||
        patient.registered_at;

      if (arrivalTime) {
        events.push({
          id: "arrival",
          timestamp: arrivalTime,
          title: "Patient Arrived",
          description:
            "Patient was registered in the emergency department.",
          type: "arrival",
        });
      }

      // ---------------------------------------------
      // TRIAGE ASSESSMENTS
      // ---------------------------------------------

      const triages =
        Array.isArray(patient.triages)
          ? patient.triages
          : [];

      triages.forEach(
        (triage: any, index: number) => {
          const priority =
            triage.priority != null
              ? Number(triage.priority)
              : undefined;

          events.push({
            id:
              `triage-${triage.id || index}`,
            timestamp:
              triage.created_at ||
              triage.recorded_at ||
              triage.updated_at,
            title:
              index === triages.length - 1
                ? "Latest AI Assessment"
                : "AI Triage Assessment",
            description:
              `AI assessment assigned ${priorityLabel(
                priority
              )}${
                triage.deterioration_risk
                  ? ` with ${String(
                      triage.deterioration_risk
                    ).toUpperCase()} deterioration risk`
                  : ""
              }.`,
            type: "triage",
            priority,
            risk:
              triage.deterioration_risk,
          });
        }
      );

      // If triages isn't available but latest triage exists.
      if (
        triages.length === 0 &&
        latestTriage
      ) {
        events.push({
          id: "latest-triage",
          timestamp:
            latestTriage.created_at ||
            latestTriage.updated_at ||
            new Date(),
          title: "AI Assessment",
          description:
            `Current recommendation is ${priorityLabel(
              latestTriage.priority
            )}.`,
          type: "triage",
          priority:
            Number(latestTriage.priority),
          risk:
            latestTriage.deterioration_risk,
        });
      }

      // ---------------------------------------------
      // VITAL RECORDS
      // ---------------------------------------------

      const vitals =
        Array.isArray(patient.vitals)
          ? patient.vitals
          : [];

      vitals.forEach(
        (vital: any, index: number) => {
          const changes: string[] = [];

          if (vital.spo2 != null) {
            changes.push(
              `SpO₂ ${vital.spo2}%`
            );
          }

          if (
            vital.heart_rate != null
          ) {
            changes.push(
              `HR ${vital.heart_rate}`
            );
          }

          if (
            vital.respiratory_rate !=
            null
          ) {
            changes.push(
              `RR ${vital.respiratory_rate}`
            );
          }

          if (
            vital.temperature != null
          ) {
            changes.push(
              `Temp ${vital.temperature}°`
            );
          }

          events.push({
            id:
              `vital-${vital.id || index}`,
            timestamp:
              vital.recorded_at ||
              vital.created_at,
            title: "Vitals Recorded",
            description:
              changes.length > 0
                ? changes.join(" • ")
                : "New vital signs recorded.",
            type: "vital",
          });
        }
      );

      // ---------------------------------------------
      // ALERTS
      // ---------------------------------------------

      const alerts =
        Array.isArray(patient.alerts)
          ? patient.alerts
          : [];

      alerts.forEach(
        (alert: any, index: number) => {
          events.push({
            id:
              `alert-${alert.id || index}`,
            timestamp:
              alert.created_at ||
              alert.timestamp ||
              alert.triggered_at,
            title:
              alert.type ||
              "Clinical Alert",
            description:
              alert.message ||
              alert.reason ||
              "Alert generated for this patient.",
            type:
              String(
                alert.type || ""
              ).toLowerCase()
                .includes("deterior")
                ? "deterioration"
                : "alert",
            priority:
              alert.priority != null
                ? Number(alert.priority)
                : undefined,
            risk:
              alert.risk ||
              alert.deterioration_risk,
          });
        }
      );

      // ---------------------------------------------
      // REASSESSMENTS
      // ---------------------------------------------

      const reassessments =
        Array.isArray(
          patient.reassessments
        )
          ? patient.reassessments
          : [];

      reassessments.forEach(
        (
          reassessment: any,
          index: number
        ) => {
          events.push({
            id:
              `reassessment-${
                reassessment.id || index
              }`,
            timestamp:
              reassessment.created_at ||
              reassessment.recorded_at,
            title: "Patient Reassessed",
            description:
              reassessment.reason ||
              reassessment.summary ||
              "Patient reassessment completed.",
            type: "reassessment",
            priority:
              reassessment.priority !=
              null
                ? Number(
                    reassessment.priority
                  )
                : undefined,
            risk:
              reassessment.deterioration_risk,
          });
        }
      );

      // ---------------------------------------------
      // CLINICIAN DECISIONS
      // ---------------------------------------------

      const decisions =
        Array.isArray(patient.decisions)
          ? patient.decisions
          : [];

      decisions.forEach(
        (decision: any, index: number) => {
          events.push({
            id:
              `decision-${decision.id || index}`,
            timestamp:
              decision.created_at ||
              decision.timestamp,
            title:
              `Clinician ${
                decision.action ||
                "Decision"
              }`,
            description:
              decision.reason ||
              `Clinical decision recorded. ${
                decision.new_priority
                  ? `Priority: P${decision.new_priority}.`
                  : ""
              }`,
            type: "decision",
            priority:
              decision.new_priority !=
              null
                ? Number(
                    decision.new_priority
                  )
                : undefined,
          });
        }
      );

      // Remove events without usable dates.
      return events
        .filter((event) => {
          const d = safeDate(
            event.timestamp
          );

          return !Number.isNaN(
            d.getTime()
          );
        })
        .sort(
          (a, b) =>
            safeDate(b.timestamp).getTime() -
            safeDate(a.timestamp).getTime()
        );
    }, [patient, latestTriage]);

  const visibleTimeline =
    timeline.slice(0, 15);

  return (
    <div className="card p-4 lg:p-5">

      {/* HEADER */}

      <div className="flex items-start justify-between gap-4 mb-5">

        <div>

          <div className="flex items-center gap-2">

            <Activity
              size={19}
              className="text-indigo-600"
            />

            <h2 className="font-semibold text-slate-800 text-lg">
              Real-Time Deterioration Timeline
            </h2>

          </div>

          <p className="text-sm text-slate-500 mt-1">
            Continuous view of vital changes,
            risk assessments, alerts and clinical
            events.
          </p>

        </div>

        <div className="flex items-center gap-2 shrink-0">

          <span className="relative flex h-2.5 w-2.5">

            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />

            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />

          </span>

          <span className="text-xs font-medium text-green-700">
            LIVE
          </span>

        </div>

      </div>


      {/* LIVE DETERIORATION EVENT */}

      {liveEvent && (

        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 animate-pulse">

          <div className="flex items-start gap-3">

            <div className="rounded-lg bg-red-100 p-2 text-red-600">

              <ShieldAlert size={20} />

            </div>

            <div className="flex-1">

              <div className="flex items-center justify-between gap-2">

                <div className="font-semibold text-red-800">

                  {liveEvent.title}

                </div>

                <span className="text-xs text-red-600 font-medium">

                  JUST NOW

                </span>

              </div>

              <div className="text-sm text-red-700 mt-1">

                {liveEvent.description}

              </div>

              {liveEvent.priority && (

                <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700">

                  Current Priority:

                  {" "}

                  P{liveEvent.priority}

                </div>

              )}

            </div>

          </div>

        </div>

      )}


      {/* CURRENT STATUS */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">

          <div className="text-xs text-slate-500">
            Current Priority
          </div>

          <div className="text-xl font-bold text-slate-900 mt-1">

            {latestTriage?.priority
              ? `P${latestTriage.priority}`
              : "—"}

          </div>

        </div>


        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">

          <div className="text-xs text-slate-500">
            Risk
          </div>

          <div
            className={
              "inline-flex mt-1 px-2 py-1 rounded-md border text-xs font-semibold " +
              getRiskClass(
                latestTriage?.deterioration_risk
              )
            }
          >

            {latestTriage?.deterioration_risk
              ? String(
                  latestTriage.deterioration_risk
                ).toUpperCase()
              : "UNKNOWN"}

          </div>

        </div>


        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">

          <div className="text-xs text-slate-500">
            NEWS
          </div>

          <div className="text-xl font-bold text-slate-900 mt-1">

            {latestNews?.score ??
              "—"}

          </div>

        </div>


        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">

          <div className="text-xs text-slate-500">
            Last Update
          </div>

          <div className="text-sm font-semibold text-slate-900 mt-1">

            {formatTime(now)}

          </div>

        </div>

      </div>


      {/* VITAL SNAPSHOT */}

      {latestVitals && (

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">

          <div className="flex items-center gap-2 mb-3">

            <HeartPulse
              size={17}
              className="text-purple-600"
            />

            <span className="text-sm font-semibold text-slate-700">

              Latest Vital Snapshot

            </span>

          </div>


          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

            <div>

              <div className="text-xs text-slate-500">
                SpO₂
              </div>

              <div className="font-bold text-slate-900">

                {latestVitals.spo2 ?? "—"}%

              </div>

            </div>


            <div>

              <div className="text-xs text-slate-500">
                Heart Rate
              </div>

              <div className="font-bold text-slate-900">

                {latestVitals.heart_rate ??
                  "—"}

                {" bpm"}

              </div>

            </div>


            <div>

              <div className="text-xs text-slate-500">
                Respiratory Rate
              </div>

              <div className="font-bold text-slate-900">

                {latestVitals.respiratory_rate ??
                  "—"}

                {" /min"}

              </div>

            </div>


            <div>

              <div className="text-xs text-slate-500">
                Temperature
              </div>

              <div className="font-bold text-slate-900">

                {latestVitals.temperature ??
                  "—"}

                {"°"}

              </div>

            </div>


            <div>

              <div className="text-xs text-slate-500">
                Blood Pressure
              </div>

              <div className="font-bold text-slate-900">

                {latestVitals.systolic_bp ??
                  "—"}

                /
                {latestVitals.diastolic_bp ??
                  "—"}

              </div>

            </div>

          </div>

        </div>

      )}


      {/* TIMELINE */}

      {visibleTimeline.length === 0 ? (

        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">

          <Clock3
            size={28}
            className="mx-auto text-slate-400 mb-2"
          />

          <div className="font-medium text-slate-700">

            No timeline events yet

          </div>

          <div className="text-sm text-slate-500 mt-1">

            Events will appear as patient
            data is recorded.

          </div>

        </div>

      ) : (

        <div className="relative">

          {/* Vertical line */}

          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />


          <div className="space-y-5">

            {visibleTimeline.map(
              (event, index) => (

                <div
                  key={event.id}
                  className="relative flex gap-4"
                >

                  {/* ICON */}

                  <div
                    className={
                      "relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 " +
                      getEventIconClass(
                        event.type
                      )
                    }
                  >

                    {getEventIcon(
                      event.type
                    )}

                  </div>


                  {/* CONTENT */}

                  <div className="flex-1 min-w-0 pb-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <span className="font-semibold text-slate-800">

                        {event.title}

                      </span>


                      {event.live && (

                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">

                          Live

                        </span>

                      )}


                      {event.priority && (

                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">

                          P{event.priority}

                        </span>

                      )}


                      {event.risk && (

                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border">

                          {String(
                            event.risk
                          ).toUpperCase()}

                        </span>

                      )}

                    </div>


                    <div className="text-xs text-slate-400 mt-0.5">

                      {formatDateTime(
                        event.timestamp
                      )}

                    </div>


                    <p className="text-sm text-slate-600 mt-1">

                      {event.description}

                    </p>


                    {/* Priority change visualization */}

                    {event.type ===
                      "deterioration" &&
                      event.description.includes(
                        "changed from"
                      ) && (

                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">

                          <ArrowUp size={13} />

                          Deterioration signal

                        </div>

                      )}

                  </div>

                </div>

              )
            )}

          </div>

        </div>

      )}


      {/* FOOTER */}

      {timeline.length > 15 && (

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">

          <span className="text-xs text-slate-500">

            Showing latest 15 events

          </span>

        </div>

      )}

    </div>
  );
}