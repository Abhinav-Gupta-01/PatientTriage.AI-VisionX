import { Vitals } from "./ruleEngine";

export type NewsRisk = "LOW" | "MEDIUM" | "HIGH";

export interface NewsComponent {
  label: string;
  value: number | string;
  points: number;
}

export interface NewsScoreResult {
  score: number;
  risk: NewsRisk;
  components: NewsComponent[];
}

export type NewsVitalsInput = Pick<
  Vitals,
  "heart_rate" | "systolic_bp" | "spo2" | "respiratory_rate" | "temperature"
>;

function scoreRespiratoryRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSpo2(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

function scoreSystolicBp(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scoreHeartRate(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreConsciousness(consciousness?: string): number {
  if (!consciousness) return 0;
  return consciousness.trim().toLowerCase() === "alert" ? 0 : 3;
}

function classifyRisk(score: number, componentPoints: number[]): NewsRisk {
  const hasSingleThree = componentPoints.some((p) => p === 3);
  if (score >= 7) return "HIGH";
  if (score >= 5 || hasSingleThree) return "MEDIUM";
  return "LOW";
}

/**
 * Computes a NEWS2-style (National Early Warning Score) from a single
 * vitals reading. This is a deterministic, rule-based clinical scoring
 * system independent of the ML risk model - used for quick bedside
 * triage sanity-checks and trend tracking.
 */
export function computeNewsScore(
  vitals: NewsVitalsInput,
  consciousness?: string
): NewsScoreResult {
  const rrPts = scoreRespiratoryRate(Number(vitals.respiratory_rate));
  const spo2Pts = scoreSpo2(Number(vitals.spo2));
  const tempPts = scoreTemperature(Number(vitals.temperature));
  const sbpPts = scoreSystolicBp(Number(vitals.systolic_bp));
  const hrPts = scoreHeartRate(Number(vitals.heart_rate));
  const cnsPts = scoreConsciousness(consciousness);

  const components: NewsComponent[] = [
    { label: "Respiratory Rate", value: vitals.respiratory_rate, points: rrPts },
    { label: "SpO2", value: vitals.spo2, points: spo2Pts },
    { label: "Temperature", value: vitals.temperature, points: tempPts },
    { label: "Systolic BP", value: vitals.systolic_bp, points: sbpPts },
    { label: "Heart Rate", value: vitals.heart_rate, points: hrPts },
    { label: "Consciousness", value: consciousness || "Alert", points: cnsPts },
  ];

  const score = components.reduce((sum, c) => sum + c.points, 0);
  const risk = classifyRisk(
    score,
    components.map((c) => c.points)
  );

  return { score, risk, components };
}

export interface NewsTrendPoint {
  recorded_at: string;
  score: number;
  risk: NewsRisk;
}

export type NewsTrendDirection =
  | "IMPROVING"
  | "STABLE"
  | "WORSENING"
  | "UNKNOWN";

export interface NewsTrendResult {
  points: NewsTrendPoint[];
  direction: NewsTrendDirection;
  latest?: NewsScoreResult;
}

export type NewsVitalsHistoryInput = NewsVitalsInput & { recorded_at: string };

/**
 * Computes a NEWS2-style score for every vitals reading in the given
 * history and derives a simple trend direction by comparing the most
 * recent readings against earlier ones.
 */
export function computeNewsTrend(
  vitalsHistory: NewsVitalsHistoryInput[],
  consciousness?: string
): NewsTrendResult {
  if (!vitalsHistory || vitalsHistory.length === 0) {
    return { points: [], direction: "UNKNOWN" };
  }

  const sorted = [...vitalsHistory].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const points: NewsTrendPoint[] = sorted.map((v) => {
    const result = computeNewsScore(v, consciousness);
    return {
      recorded_at: v.recorded_at,
      score: result.score,
      risk: result.risk,
    };
  });

  let direction: NewsTrendDirection = "UNKNOWN";
  if (points.length >= 2) {
    const windowSize = Math.min(3, points.length);
    const recent = points.slice(-windowSize);
    const delta = recent[recent.length - 1].score - recent[0].score;

    if (delta >= 2) direction = "WORSENING";
    else if (delta <= -2) direction = "IMPROVING";
    else direction = "STABLE";
  }

  const latestVitals = sorted[sorted.length - 1];
  const latest = computeNewsScore(latestVitals, consciousness);

  return { points, direction, latest };
}