import { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { assessPatient } from "../services/triageService";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getUserId(req: Request) {
  return (
    (req as any).user?.id ||
    (req as any).user?.user_id ||
    (req as any).userId ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| NEWS2-style score from vitals
|--------------------------------------------------------------------------
*/

function computeNewsScore(vitals: any): { score: number; risk: string } {
  if (!vitals) return { score: 0, risk: "LOW" };

  let score = 0;

  // Respiratory rate
  const rr = Number(vitals.respiratory_rate || 0);
  if (rr <= 8) score += 3;
  else if (rr <= 11) score += 1;
  else if (rr >= 25) score += 3;
  else if (rr >= 21) score += 2;

  // SpO2
  const spo2 = Number(vitals.spo2 || 100);
  if (spo2 <= 91) score += 3;
  else if (spo2 <= 93) score += 2;
  else if (spo2 <= 95) score += 1;

  // Systolic BP
  const sbp = Number(vitals.systolic_bp || 120);
  if (sbp <= 90) score += 3;
  else if (sbp <= 100) score += 2;
  else if (sbp <= 110) score += 1;
  else if (sbp >= 220) score += 3;

  // Heart rate
  const hr = Number(vitals.heart_rate || 75);
  if (hr <= 40) score += 3;
  else if (hr <= 50) score += 1;
  else if (hr >= 131) score += 3;
  else if (hr >= 111) score += 2;
  else if (hr >= 91) score += 1;

  // Temperature
  const temp = Number(vitals.temperature || 37);
  if (temp <= 35) score += 3;
  else if (temp <= 36) score += 1;
  else if (temp >= 39.1) score += 2;
  else if (temp >= 38.1) score += 1;

  const risk = score >= 7 ? "HIGH" : score >= 5 ? "MEDIUM" : "LOW";
  return { score, risk };
}

/*
|--------------------------------------------------------------------------
| GET /api/patients
|
| Returns patients enriched with latest triage, vitals, waiting_minutes,
| and NEWS score so the frontend can display all data correctly.
|--------------------------------------------------------------------------
*/

export async function listPatients(
  req: Request,
  res: Response
) {
  try {
    const status = req.query.status as string | undefined;

    let query = supabase
      .from("patients")
      .select("*")
      .order("arrival_time", {
        ascending: true,
      });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "LIST PATIENTS ERROR:",
        error
      );

      return res.status(500).json({
        message: "Failed to fetch patients",
        error: error.message,
      });
    }

    const patients = data || [];

    if (patients.length === 0) {
      return res.json({ patients: [] });
    }

    /*
     * Fetch latest triage for all patients in one query
     */
    const patientIds = patients.map((p: any) => p.id);

    const { data: allTriages } = await supabase
      .from("triage_assessments")
      .select("*")
      .in("patient_id", patientIds)
      .order("created_at", { ascending: false });

    /*
     * Fetch latest vitals for all patients in one query
     */
    const { data: allVitals } = await supabase
      .from("patient_vitals")
      .select("*")
      .in("patient_id", patientIds)
      .order("recorded_at", { ascending: false });

    /*
     * Build lookup maps: only keep the latest record per patient
     */
    const latestTriage: Record<string, any> = {};
    for (const t of (allTriages || [])) {
      if (!latestTriage[t.patient_id]) {
        latestTriage[t.patient_id] = t;
      }
    }

    const latestVitals: Record<string, any> = {};
    for (const v of (allVitals || [])) {
      if (!latestVitals[v.patient_id]) {
        latestVitals[v.patient_id] = v;
      }
    }

    /*
     * Enrich each patient with triage, vitals, waiting_minutes, and NEWS
     */
    const now = Date.now();

    const enriched = patients.map((p: any) => {
      const triage = latestTriage[p.id] || null;
      const vitals = latestVitals[p.id] || null;
      const waiting_minutes = p.arrival_time
        ? Math.floor((now - new Date(p.arrival_time).getTime()) / 60000)
        : 0;
      const news = computeNewsScore(vitals);

      return {
        ...p,
        triage: triage
          ? {
              priority: triage.priority,
              priority_label: triage.priority_label,
              deterioration_risk: triage.deterioration_risk,
              risk_probability: triage.risk_probability,
              confidence: triage.confidence,
              care_pathway: triage.care_pathway,
              reassessment_minutes: triage.reassessment_minutes,
              key_factors: triage.key_factors,
              explanation: triage.explanation,
              recommendation: triage.recommendation,
            }
          : null,
        vitals: vitals
          ? {
              heart_rate: vitals.heart_rate,
              systolic_bp: vitals.systolic_bp,
              diastolic_bp: vitals.diastolic_bp,
              spo2: vitals.spo2,
              respiratory_rate: vitals.respiratory_rate,
              temperature: vitals.temperature,
              recorded_at: vitals.recorded_at,
            }
          : null,
        waiting_minutes,
        news,
      };
    });

    return res.json({
      patients: enriched,
    });
  } catch (error: any) {
    console.error(
      "LIST PATIENTS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/patients/:id
|
| Returns complete patient information including:
| - latest vitals
| - latest triage assessment
|--------------------------------------------------------------------------
*/

export async function getPatient(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    /*
     * Latest vitals
     */
    const {
      data: vitals,
      error: vitalsError,
    } = await supabase
      .from("patient_vitals")
      .select("*")
      .eq("patient_id", id)
      .order("recorded_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (vitalsError) {
      console.error(
        "GET PATIENT VITALS ERROR:",
        vitalsError
      );
    }

    /*
     * Latest triage assessment
     */
    const {
      data: triage,
      error: triageError,
    } = await supabase
      .from("triage_assessments")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (triageError) {
      console.error(
        "GET PATIENT TRIAGE ERROR:",
        triageError
      );
    }

    return res.json({
      patient: {
        ...patient,
        latest_triage: triage || null,
        triage: triage || null,
        latest_vitals: vitals || null,
        waiting_minutes: patient.arrival_time
          ? Math.floor((Date.now() - new Date(patient.arrival_time).getTime()) / 60000)
          : 0,
        news: computeNewsScore(vitals),
      },
      vitals: vitals || null,
      triage: triage || null,
    });
  } catch (error: any) {
    console.error(
      "GET PATIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/patients
|
| Creates a new patient.
|--------------------------------------------------------------------------
*/

export async function createPatient(
  req: Request,
  res: Response
) {
  try {
    let {
      patient_code,
      age,
      sex,
      medical_history,
      medications,
      allergies,
      chief_complaint,
      symptoms,
      pain_score,
      duration,
      consciousness,
      distress,
      mobility,
      is_simulated,
      heart_rate,
      systolic_bp,
      diastolic_bp,
      spo2,
      respiratory_rate,
      temperature,
    } = req.body;

    if (!patient_code || !String(patient_code).trim()) {
      patient_code = "PT-" + Math.floor(Math.random() * 900000 + 100000);
    }

    if (
      age === undefined ||
      age === null ||
      !Number.isInteger(Number(age)) ||
      Number(age) < 0
    ) {
      return res.status(400).json({
        message: "Valid age is required",
      });
    }

    if (
      chief_complaint === undefined ||
      chief_complaint === null ||
      !String(chief_complaint).trim()
    ) {
      return res.status(400).json({
        message: "chief_complaint is required",
      });
    }

    const {
      data: existingPatient,
      error: existingError,
    } = await supabase
      .from("patients")
      .select("id")
      .eq(
        "patient_code",
        String(patient_code).trim()
      )
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        message: "Failed to validate patient code",
      });
    }

    if (existingPatient) {
      return res.status(409).json({
        message: "Patient code already exists",
      });
    }

    const { data: patient, error } =
      await supabase
        .from("patients")
        .insert({
          patient_code: String(patient_code).trim(),
          age: Number(age),
          sex: sex || null,
          medical_history: medical_history || null,
          medications: medications || null,
          allergies: allergies || null,
          chief_complaint: String(chief_complaint).trim(),
          symptoms: symptoms || null,
          pain_score: pain_score !== undefined && pain_score !== null ? Number(pain_score) : null,
          duration: duration || null,
          consciousness: consciousness || "Alert",
          distress: distress || "None",
          mobility: mobility || "Ambulatory",
          status: "Waiting",
          is_simulated: is_simulated !== undefined ? Boolean(is_simulated) : false,
        })
        .select("*")
        .single();

    if (error || !patient) {
      return res.status(500).json({
        message: "Failed to create patient",
        error: error?.message,
      });
    }

    if (heart_rate || systolic_bp || spo2 || respiratory_rate || temperature) {
      await supabase.from("patient_vitals").insert({
        patient_id: patient.id,
        heart_rate: heart_rate ? Number(heart_rate) : null,
        systolic_bp: systolic_bp ? Number(systolic_bp) : null,
        diastolic_bp: diastolic_bp ? Number(diastolic_bp) : null,
        spo2: spo2 ? Number(spo2) : null,
        respiratory_rate: respiratory_rate ? Number(respiratory_rate) : null,
        temperature: temperature ? Number(temperature) : null,
      });
    }

    try {
      await assessPatient(patient.id);
    } catch (triageError) {
      console.error("CREATE PATIENT TRIAGE ERROR:", triageError);
    }

    const userId = getUserId(req);

    if (userId) {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        patient_id: patient.id,
        action: "patient_created",
        details: {
          patient_code: patient.patient_code,
          status: "Waiting",
        },
      });
    }

    return res.status(201).json({
      message: "Patient created successfully",
      patient,
    });
  } catch (error: any) {
    console.error(
      "CREATE PATIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/patients/:id/reassess
|
| Records a reassessment.
|--------------------------------------------------------------------------
*/

export async function reassess(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;

    const {
      new_priority,
      new_risk,
      reason,
      heart_rate,
      systolic_bp,
      diastolic_bp,
      spo2,
      respiratory_rate,
      temperature,
    } = req.body;

    /*
     * Fetch current patient
     */
    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("id")
      .eq("id", id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    /*
     * Fetch previous triage
     */
    const {
      data: previousTriage,
    } = await supabase
      .from("triage_assessments")
      .select("priority, risk_probability")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousPriority = previousTriage?.priority ?? null;
    const previousRisk = previousTriage?.risk_probability ?? null;

    /*
     * Insert new vitals if provided
     */
    if (heart_rate || systolic_bp || diastolic_bp || spo2 || respiratory_rate || temperature) {
      const { error: vitalsError } = await supabase.from("patient_vitals").insert({
        patient_id: id,
        heart_rate: heart_rate ? Number(heart_rate) : null,
        systolic_bp: systolic_bp ? Number(systolic_bp) : null,
        diastolic_bp: diastolic_bp ? Number(diastolic_bp) : null,
        spo2: spo2 ? Number(spo2) : null,
        respiratory_rate: respiratory_rate ? Number(respiratory_rate) : null,
        temperature: temperature ? Number(temperature) : null,
      });
      if (vitalsError) {
        console.error("REASSESS VITALS INSERT ERROR:", vitalsError);
      }
    }

    /*
     * Re-run AI Triage
     */
    try {
      await assessPatient(id);
    } catch (triageError) {
      console.error("REASSESS TRIAGE ENGINE ERROR:", triageError);
    }

    /*
     * Fetch the newly generated triage
     */
    const {
      data: newTriage,
    } = await supabase
      .from("triage_assessments")
      .select("priority, risk_probability")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const finalPriority =
      new_priority !== undefined && new_priority !== null
        ? Number(new_priority)
        : newTriage?.priority ?? previousPriority;

    const finalRisk =
      new_risk !== undefined && new_risk !== null
        ? Number(new_risk)
        : newTriage?.risk_probability ?? previousRisk;

    /*
     * Save reassessment log
     */
    const { data, error } = await supabase
      .from("reassessments")
      .insert({
        patient_id: id,
        previous_priority: previousPriority,
        new_priority: finalPriority,
        previous_risk: previousRisk,
        new_risk: finalRisk,
        reason: reason ? String(reason).trim() : null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("CREATE REASSESSMENT ERROR:", error);
    }

    return res.status(201).json({
      message: "Patient reassessed successfully",
      reassessment: data || null,
    });
  } catch (error: any) {
    console.error(
      "REASSESS PATIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/patients/:id/decision
|
| Legacy/general clinical decision endpoint.
|
| Detailed Accept / Modify / Override decisions
| are handled by clinicianDecisionController.
|--------------------------------------------------------------------------
*/

export async function decision(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;

    const userId = getUserId(req);

    const {
      action,
      new_priority,
      new_pathway,
      reason,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!action) {
      return res.status(400).json({
        message: "action is required",
      });
    }

    /*
     * Verify patient
     */
    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("id, status")
      .eq("id", id)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    /*
     * Latest triage
     */
    const {
      data: triage,
    } = await supabase
      .from("triage_assessments")
      .select(
        "priority, care_pathway"
      )
      .eq("patient_id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const previousPriority =
      triage?.priority ?? null;

    const previousPathway =
      triage?.care_pathway ?? null;

    const finalPriority =
      new_priority !== undefined &&
      new_priority !== null
        ? Number(new_priority)
        : previousPriority;

    const finalPathway =
      new_pathway ??
      previousPathway;

    /*
     * Save using the original clinician_decisions
     * schema fields.
     */
    const {
      data: savedDecision,
      error,
    } = await supabase
      .from("clinician_decisions")
      .insert({
        patient_id: id,
        user_id: userId,

        action: String(action),

        previous_priority:
          previousPriority,

        new_priority:
          finalPriority,

        previous_pathway:
          previousPathway,

        new_pathway:
          finalPathway,

        reason:
          reason
            ? String(reason).trim()
            : null,
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "CLINICAL DECISION ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to save clinical decision",
        error: error.message,
      });
    }

    return res.status(201).json({
      message:
        "Clinical decision recorded successfully",
      decision: savedDecision,
    });
  } catch (error: any) {
    console.error(
      "DECISION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}