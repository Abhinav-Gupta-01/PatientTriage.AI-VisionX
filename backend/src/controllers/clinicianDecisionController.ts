import { Request, Response } from "express";
import { supabase } from "../config/supabase";

type DecisionType = "accept" | "modify" | "override";

const VALID_DECISIONS: DecisionType[] = [
  "accept",
  "modify",
  "override",
];

// --------------------------------------------------
// Get authenticated user ID
// --------------------------------------------------
function getUserId(req: Request) {
  return (
    (req as any).user?.id ||
    (req as any).user?.user_id ||
    (req as any).userId ||
    null
  );
}

// --------------------------------------------------
// Get authenticated user role
// --------------------------------------------------
function getUserRole(req: Request) {
  return (
    (req as any).user?.role ||
    (req as any).role ||
    "clinician"
  );
}

// --------------------------------------------------
// Get authenticated user email
// --------------------------------------------------
function getUserEmail(req: Request) {
  return (
    (req as any).user?.email ||
    null
  );
}

// ==================================================
// GET PATIENT DECISIONS
// GET /api/patients/:patientId/decisions
// ==================================================
export async function getPatientDecisions(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        message: "Patient ID is required",
      });
    }

    const { data, error } = await supabase
      .from("clinician_decisions")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "GET CLINICIAN DECISIONS ERROR:",
        error
      );

      return res.status(500).json({
        message: "Failed to fetch clinician decisions",
        error: error.message,
      });
    }

    return res.status(200).json({
      decisions: data || [],
    });
  } catch (error: any) {
    console.error(
      "GET CLINICIAN DECISIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

// ==================================================
// CREATE CLINICIAN DECISION
//
// POST /api/patients/:patientId/decisions
//
// ACCEPT
// MODIFY
// OVERRIDE
// ==================================================
export async function createClinicianDecision(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const userId = getUserId(req);
    const userRole = getUserRole(req);
    const userEmail = getUserEmail(req);

    // ------------------------------------------------
    // Request body
    // ------------------------------------------------

    const {
      decision_type,

      // AI recommendation
      ai_recommended_priority,
      ai_recommended_risk,
      ai_confidence,

      // Final clinician decision
      final_priority,
      final_care_pathway,
      final_reassessment_minutes,

      // Optional reason
      reason,
    } = req.body;

    console.log("CLINICIAN DECISION REQUEST:", {
      patientId,
      userId,
      userRole,
      decision_type,
      ai_recommended_priority,
      final_priority,
      final_care_pathway,
      final_reassessment_minutes,
      reason,
    });

    // ------------------------------------------------
    // Basic validation
    // ------------------------------------------------

    if (!patientId) {
      return res.status(400).json({
        message: "Patient ID is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated clinician is required",
      });
    }

    if (
      !decision_type ||
      !VALID_DECISIONS.includes(decision_type)
    ) {
      return res.status(400).json({
        message:
          "decision_type must be accept, modify or override",
      });
    }

    // ------------------------------------------------
    // Final priority
    // ------------------------------------------------

    if (
      final_priority === undefined ||
      final_priority === null
    ) {
      return res.status(400).json({
        message: "final_priority is required",
      });
    }

    const parsedFinalPriority = Number(final_priority);

    if (
      !Number.isInteger(parsedFinalPriority) ||
      parsedFinalPriority < 1 ||
      parsedFinalPriority > 5
    ) {
      return res.status(400).json({
        message:
          "final_priority must be an integer from 1 to 5",
      });
    }

    // ------------------------------------------------
    // Modify / Override require a reason
    // ------------------------------------------------

    if (
      (decision_type === "modify" ||
        decision_type === "override") &&
      (!reason || !String(reason).trim())
    ) {
      return res.status(400).json({
        message:
          "A reason is required for modify or override decisions",
      });
    }

    // ------------------------------------------------
    // Fetch patient
    // ------------------------------------------------

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select(
        "id, patient_code, status"
      )
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      console.error(
        "PATIENT LOOKUP ERROR:",
        patientError
      );

      return res.status(404).json({
        message: "Patient not found",
      });
    }

    // ------------------------------------------------
    // Fetch latest AI assessment
    //
    // This makes ACCEPT work even if the frontend
    // does not send every AI field again.
    // ------------------------------------------------

    const {
      data: latestAssessment,
      error: assessmentError,
    } = await supabase
      .from("triage_assessments")
      .select(
        `
        id,
        priority,
        priority_label,
        deterioration_risk,
        risk_probability,
        confidence,
        care_pathway,
        reassessment_minutes
        `
      )
      .eq("patient_id", patientId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      console.error(
        "LATEST ASSESSMENT ERROR:",
        assessmentError
      );

      return res.status(500).json({
        message:
          "Failed to fetch latest AI assessment",
        error: assessmentError.message,
      });
    }

    // ------------------------------------------------
    // Determine AI values
    // ------------------------------------------------

    const aiPriority =
      ai_recommended_priority !== undefined &&
      ai_recommended_priority !== null
        ? Number(ai_recommended_priority)
        : latestAssessment?.priority ?? null;

    const aiRisk =
      ai_recommended_risk ??
      latestAssessment?.deterioration_risk ??
      null;

    const aiConfidence =
      ai_confidence ??
      latestAssessment?.confidence ??
      null;

    const aiPathway =
      latestAssessment?.care_pathway ??
      null;

    const aiReassessment =
      latestAssessment?.reassessment_minutes ??
      null;

    // ------------------------------------------------
    // IMPORTANT ACCEPT LOGIC
    //
    // ACCEPT means:
    // clinician accepts exactly what AI recommended.
    //
    // Therefore final values are taken from AI if
    // frontend didn't explicitly send them.
    // ------------------------------------------------

    let finalPriority = parsedFinalPriority;
    let finalPathway =
      final_care_pathway ??
      aiPathway;

    let finalReassessment =
      final_reassessment_minutes ??
      aiReassessment;

    if (decision_type === "accept") {
      if (aiPriority === null) {
        return res.status(400).json({
          message:
            "Cannot accept recommendation because no AI recommendation exists",
        });
      }

      finalPriority = Number(aiPriority);

      finalPathway = aiPathway;

      finalReassessment = aiReassessment;
    }

    // ------------------------------------------------
    // Validate final priority after ACCEPT
    // ------------------------------------------------

    if (
      !Number.isInteger(finalPriority) ||
      finalPriority < 1 ||
      finalPriority > 5
    ) {
      return res.status(400).json({
        message:
          "Final priority must be an integer from 1 to 5",
      });
    }

    // ------------------------------------------------
    // Previous values
    //
    // If there is a previous clinician decision,
    // use its final values as the previous state.
    // Otherwise use the AI recommendation.
    // ------------------------------------------------

    const {
      data: previousDecision,
      error: previousDecisionError,
    } = await supabase
      .from("clinician_decisions")
      .select(
        `
        new_priority,
        new_pathway
        `
      )
      .eq("patient_id", patientId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (previousDecisionError) {
      console.error(
        "PREVIOUS DECISION ERROR:",
        previousDecisionError
      );
    }

    const previousPriority =
      previousDecision?.new_priority ??
      aiPriority ??
      null;

    const previousPathway =
      previousDecision?.new_pathway ??
      aiPathway ??
      null;

    // ------------------------------------------------
    // Save clinician decision
    //
    // IMPORTANT:
    // These column names exactly match your current
    // clinician_decisions SQL schema.
    // ------------------------------------------------

    const { data: decision, error: decisionError } =
      await supabase
        .from("clinician_decisions")
        .insert({
          patient_id: patientId,

          user_id: userId,

          action: decision_type,

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
              : decision_type === "accept"
                ? "Accepted AI recommendation"
                : null,
        })
        .select("*")
        .single();

    if (decisionError) {
      console.error(
        "CREATE CLINICIAN DECISION ERROR:",
        decisionError
      );

      return res.status(500).json({
        message:
          "Failed to save clinician decision",
        error: decisionError.message,
      });
    }

    // ------------------------------------------------
    // Audit log
    //
    // Uses ONLY columns that exist in your current
    // audit_logs table.
    // ------------------------------------------------

    const auditDetails = {
      decision_type,

      ai_recommendation: {
        priority: aiPriority,
        risk: aiRisk,
        confidence: aiConfidence,
        care_pathway: aiPathway,
        reassessment_minutes:
          aiReassessment,
      },

      clinician_decision: {
        final_priority: finalPriority,
        final_pathway: finalPathway,
        final_reassessment_minutes:
          finalReassessment,
      },

      reason:
        reason
          ? String(reason).trim()
          : decision_type === "accept"
            ? "Accepted AI recommendation"
            : null,

      clinician_role: userRole,

      decision_id: decision.id,

      patient_code:
        patient.patient_code,
    };

    const { error: auditError } =
      await supabase
        .from("audit_logs")
        .insert({
          user_id: userId,

          user_email:
            userEmail,

          user_role:
            userRole,

          patient_id:
            patientId,

          action:
            `clinician_${decision_type}`,

          details:
            auditDetails,
        });

    if (auditError) {
      console.error(
        "AUDIT LOG ERROR:",
        auditError
      );

      // Do NOT fail the decision.
      // The clinical decision has already been saved.
    }

    // ------------------------------------------------
    // Response
    // ------------------------------------------------

    return res.status(201).json({
      message:
        decision_type === "accept"
          ? "AI recommendation accepted successfully"
          : decision_type === "modify"
            ? "AI recommendation modified successfully"
            : "AI recommendation overridden successfully",

      decision,

      ai_recommendation: {
        priority: aiPriority,
        risk: aiRisk,
        confidence: aiConfidence,
        care_pathway: aiPathway,
        reassessment_minutes:
          aiReassessment,
      },

      final_decision: {
        priority: finalPriority,
        care_pathway: finalPathway,
        reassessment_minutes:
          finalReassessment,
      },

      audit_logged:
        !auditError,
    });
  } catch (error: any) {
    console.error(
      "CREATE CLINICIAN DECISION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error?.message
          : undefined,
    });
  }
}