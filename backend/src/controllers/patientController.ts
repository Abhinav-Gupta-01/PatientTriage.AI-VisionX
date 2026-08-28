import { Response } from "express";
import { supabase } from "../config/supabase";
import { AuthReq } from "../middleware/auth";
import { assessPatient } from "../services/triageService";

export async function listPatients(
  req: AuthReq,
  res: Response
) {
  try {
    const {
      data: patients,
      error: patientsError,
    } = await supabase
      .from("patients")
      .select("*")
      .order("arrival_time", {
        ascending: true,
      });

    if (patientsError) {
      console.error(
        "List patients error:",
        patientsError
      );

      return res.status(500).json({
        error: "Failed to fetch patients",
      });
    }

    if (!patients || patients.length === 0) {
      return res.json([]);
    }

    const ids = patients.map(
      (p) => p.id
    );

    const {
      data: triages,
      error: triagesError,
    } = await supabase
      .from("triage_assessments")
      .select("*")
      .in("patient_id", ids)
      .order("created_at", {
        ascending: false,
      });

    if (triagesError) {
      console.error(
        "List patient triages error:",
        triagesError
      );

      return res.status(500).json({
        error: "Failed to fetch triage assessments",
      });
    }

    const {
      data: vitals,
      error: vitalsError,
    } = await supabase
      .from("patient_vitals")
      .select("*")
      .in("patient_id", ids)
      .order("recorded_at", {
        ascending: false,
      });

    if (vitalsError) {
      console.error(
        "List patient vitals error:",
        vitalsError
      );

      return res.status(500).json({
        error: "Failed to fetch patient vitals",
      });
    }

    const enriched = patients.map((p) => {
      const t = triages?.find(
        (x) => x.patient_id === p.id
      );

      const v = vitals?.find(
        (x) => x.patient_id === p.id
      );

      const arrivalTime = new Date(
        p.arrival_time
      ).getTime();

      const waiting = Number.isFinite(arrivalTime)
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - arrivalTime) / 60000
            )
          )
        : 0;

      return {
        ...p,
        triage: t,
        vitals: v,
        waiting_minutes: waiting,
      };
    });

    enriched.sort((a, b) => {
      const pa =
        a.triage?.priority ?? 5;

      const pb =
        b.triage?.priority ?? 5;

      if (pa !== pb) {
        return pa - pb;
      }

      const ra =
        Number(a.triage?.risk_probability ?? 0);

      const rb =
        Number(b.triage?.risk_probability ?? 0);

      if (rb !== ra) {
        return rb - ra;
      }

      return (
        b.waiting_minutes -
        a.waiting_minutes
      );
    });

    return res.json(enriched);
  } catch (error) {
    console.error(
      "listPatients error:",
      error
    );

    return res.status(500).json({
      error: "Failed to fetch patients",
    });
  }
}

export async function getPatient(
  req: AuthReq,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Patient ID is required",
      });
    }

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (patientError) {
      console.error(
        "Get patient error:",
        patientError
      );

      return res.status(404).json({
        error: "Patient not found",
      });
    }

    if (!patient) {
      return res.status(404).json({
        error: "Patient not found",
      });
    }

    const [
      vitalsResult,
      triagesResult,
      alertsResult,
      decisionsResult,
      reassessmentsResult,
    ] = await Promise.all([
      supabase
        .from("patient_vitals")
        .select("*")
        .eq("patient_id", id)
        .order("recorded_at", {
          ascending: true,
        }),

      supabase
        .from("triage_assessments")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("alerts")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("clinician_decisions")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("reassessments")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (vitalsResult.error) {
      console.error(
        "Get patient vitals error:",
        vitalsResult.error
      );

      return res.status(500).json({
        error: "Failed to fetch patient vitals",
      });
    }

    if (triagesResult.error) {
      console.error(
        "Get patient triages error:",
        triagesResult.error
      );

      return res.status(500).json({
        error: "Failed to fetch patient triage assessments",
      });
    }

    if (alertsResult.error) {
      console.error(
        "Get patient alerts error:",
        alertsResult.error
      );

      return res.status(500).json({
        error: "Failed to fetch patient alerts",
      });
    }

    if (decisionsResult.error) {
      console.error(
        "Get patient decisions error:",
        decisionsResult.error
      );

      return res.status(500).json({
        error: "Failed to fetch clinician decisions",
      });
    }

    if (reassessmentsResult.error) {
      console.error(
        "Get patient reassessments error:",
        reassessmentsResult.error
      );

      return res.status(500).json({
        error: "Failed to fetch reassessments",
      });
    }

    const vitals =
      vitalsResult.data || [];

    const triages =
      triagesResult.data || [];

    const alerts =
      alertsResult.data || [];

    const decisions =
      decisionsResult.data || [];

    const reassessments =
      reassessmentsResult.data || [];

    const arrivalTime = new Date(
      patient.arrival_time
    ).getTime();

    const waiting = Number.isFinite(arrivalTime)
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - arrivalTime) / 60000
          )
        )
      : 0;

    return res.json({
      ...patient,
      vitals,
      triages,
      alerts,
      decisions,
      reassessments,
      waiting_minutes: waiting,
      latest_triage: triages[0],
      latest_vitals:
        vitals[vitals.length - 1],
    });
  } catch (error) {
    console.error(
      "getPatient error:",
      error
    );

    return res.status(500).json({
      error: "Failed to fetch patient",
    });
  }
}

export async function createPatient(
  req: AuthReq,
  res: Response
) {
  try {
    const b = req.body;

    if (
      typeof b.age !== "number" ||
      b.age < 0 ||
      b.age > 120
    ) {
      return res.status(400).json({
        error: "Invalid age",
      });
    }

    const requiredVitals = [
      "heart_rate",
      "systolic_bp",
      "diastolic_bp",
      "spo2",
      "respiratory_rate",
      "temperature",
    ];

    for (const field of requiredVitals) {
      if (
        b[field] === undefined ||
        b[field] === null ||
        !Number.isFinite(
          Number(b[field])
        )
      ) {
        return res.status(400).json({
          error: `Missing or invalid ${field}`,
        });
      }
    }

    const code =
      b.patient_code ||
      `P${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .insert({
        patient_code: code,
        age: b.age,
        sex: b.sex,
        medical_history:
          b.medical_history,
        medications:
          b.medications,
        allergies:
          b.allergies,
        chief_complaint:
          b.chief_complaint,
        symptoms:
          b.symptoms,
        pain_score:
          b.pain_score,
        duration:
          b.duration,
        consciousness:
          b.consciousness ||
          "Alert",
        distress:
          b.distress ||
          "None",
        mobility:
          b.mobility ||
          "Ambulatory",
        is_simulated: true,
        status: "Waiting",
      })
      .select()
      .single();

    if (
      patientError ||
      !patient
    ) {
      console.error(
        "Patient insert failed:",
        patientError
      );

      return res.status(400).json({
        error:
          patientError?.message ||
          "Failed to create patient",
      });
    }

    const {
      error: vitalsError,
    } = await supabase
      .from("patient_vitals")
      .insert({
        patient_id: patient.id,
        heart_rate: b.heart_rate,
        systolic_bp:
          b.systolic_bp,
        diastolic_bp:
          b.diastolic_bp,
        spo2: b.spo2,
        respiratory_rate:
          b.respiratory_rate,
        temperature:
          b.temperature,
      });

    if (vitalsError) {
      console.error(
        "Vitals insert failed:",
        vitalsError
      );

      await supabase
        .from("patients")
        .delete()
        .eq("id", patient.id);

      return res.status(400).json({
        error:
          "Failed to save patient vitals",
      });
    }

    let triage;

    try {
      triage =
        await assessPatient(
          patient.id
        );
    } catch (error) {
      console.error(
        "Initial triage failed:",
        error
      );

      return res.status(500).json({
        error:
          "Patient created, but initial triage failed",
        patient_id:
          patient.id,
      });
    }

    const {
      error: auditError,
    } = await supabase
      .from("audit_logs")
      .insert({
        user_id:
          req.user!.id,
        user_email:
          req.user!.email,
        user_role:
          req.user!.role,
        patient_id:
          patient.id,
        action:
          "PATIENT_CREATED",
        details: {
          patient_code:
            code,
          triage_id:
            triage?.id,
        },
      });

    if (auditError) {
      console.error(
        "Audit log failed:",
        auditError
      );
    }

    return res.status(201).json({
      patient,
      triage,
    });
  } catch (error) {
    console.error(
      "createPatient error:",
      error
    );

    return res.status(500).json({
      error:
        "Internal server error",
    });
  }
}

export async function reassess(
  req: AuthReq,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Patient ID is required",
      });
    }

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("id")
      .eq("id", id)
      .single();

    if (patientError) {
      console.error(
        "Reassess patient lookup error:",
        patientError
      );

      return res.status(404).json({
        error: "Patient not found",
      });
    }

    if (!patient) {
      return res.status(404).json({
        error: "Patient not found",
      });
    }

    let triage;

    try {
      triage =
        await assessPatient(id);
    } catch (error) {
      console.error(
        "Reassessment failed:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to reassess patient",
      });
    }

    if (!triage) {
      return res.status(500).json({
        error:
          "Assessment failed",
      });
    }

    const {
      error: auditError,
    } = await supabase
      .from("audit_logs")
      .insert({
        user_id:
          req.user!.id,
        user_email:
          req.user!.email,
        user_role:
          req.user!.role,
        patient_id: id,
        action: "REASSESS",
        details: {
          triage_id:
            triage.id,
        },
      });

    if (auditError) {
      console.error(
        "Audit log failed:",
        auditError
      );
    }

    return res.json(triage);
  } catch (error) {
    console.error(
      "reassess error:",
      error
    );

    return res.status(500).json({
      error:
        "Failed to reassess patient",
    });
  }
}

export async function decision(
  req: AuthReq,
  res: Response
) {
  try {
    const { id } = req.params;

    const {
      action,
      new_priority,
      new_pathway,
      reason,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "Patient ID is required",
      });
    }

    if (!action) {
      return res.status(400).json({
        error: "Decision action is required",
      });
    }

    if (
      action === "OVERRIDE" &&
      (!reason ||
        typeof reason !== "string" ||
        reason.trim().length < 3)
    ) {
      return res.status(400).json({
        error:
          "Reason required",
      });
    }

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
        error:
          "Patient not found",
      });
    }

    const {
      data: last,
      error: lastError,
    } = await supabase
      .from("triage_assessments")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .single();

    if (lastError || !last) {
      console.error(
        "Latest triage lookup error:",
        lastError
      );

      return res.status(400).json({
        error:
          "No triage assessment exists for this patient",
      });
    }

    const {
      error: decisionError,
    } = await supabase
      .from("clinician_decisions")
      .insert({
        patient_id: id,
        user_id:
          req.user!.id,
        action,
        previous_priority:
          last.priority,
        new_priority:
          new_priority ??
          last.priority,
        previous_pathway:
          last.care_pathway,
        new_pathway:
          new_pathway ??
          last.care_pathway,
        reason,
      });

    if (decisionError) {
      console.error(
        "Clinician decision insert error:",
        decisionError
      );

      return res.status(400).json({
        error:
          "Failed to save clinician decision",
      });
    }

    if (
      action !== "ACCEPT" &&
      new_priority
    ) {
      const {
        error: triageError,
      } = await supabase
        .from("triage_assessments")
        .insert({
          patient_id: id,
          priority:
            new_priority,
          priority_label:
            last.priority_label,
          deterioration_risk:
            last.deterioration_risk,
          risk_probability:
            last.risk_probability,
          confidence: 1.0,
          care_pathway:
            new_pathway ||
            last.care_pathway,
          reassessment_minutes:
            last.reassessment_minutes,
          key_factors: [
            "Clinician " +
              action,
            reason || "",
          ],
          explanation:
            "Clinician " +
            action +
            ": " +
            (reason ||
              "N/A"),
          recommendation:
            "Clinician-directed disposition",
          model_version:
            "clinician-override",
        });

      if (triageError) {
        console.error(
          "Clinician triage override insert error:",
          triageError
        );

        return res.status(400).json({
          error:
            "Decision saved, but failed to save triage override",
        });
      }
    }

    const {
      error: auditError,
    } = await supabase
      .from("audit_logs")
      .insert({
        user_id:
          req.user!.id,
        user_email:
          req.user!.email,
        user_role:
          req.user!.role,
        patient_id: id,
        action:
          "DECISION_" +
          action,
        details: {
          new_priority,
          new_pathway,
          reason,
          previous_priority:
            last.priority,
        },
      });

    if (auditError) {
      console.error(
        "Decision audit log failed:",
        auditError
      );
    }

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "decision error:",
      error
    );

    return res.status(500).json({
      error:
        "Failed to process clinician decision",
    });
  }
}
