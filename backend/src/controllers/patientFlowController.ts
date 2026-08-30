import { Request, Response } from "express";
import { supabase } from "../config/supabase";

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

function getUserRole(req: Request) {
  return (
    (req as any).user?.role ||
    (req as any).role ||
    "clinician"
  );
}

/*
|--------------------------------------------------------------------------
| ACCEPT PATIENT
|
| POST /api/patients/:patientId/accept
|
| Waiting -> In Treatment
|
| This is what removes the patient from the
| "Waiting" queue.
|--------------------------------------------------------------------------
*/

export async function acceptPatient(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated clinician required",
      });
    }

    /*
     * Get patient
     */
    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    /*
     * Prevent accepting an already active/completed patient.
     */
    if (patient.status !== "Waiting") {
      return res.status(400).json({
        message:
          `Patient cannot be accepted because current status is "${patient.status}"`,
      });
    }

    /*
     * IMPORTANT:
     *
     * Changing status from Waiting -> In Treatment
     * removes this patient from a queue that filters
     * status = Waiting.
     */
    const {
      data: updatedPatient,
      error: updateError,
    } = await supabase
      .from("patients")
      .update({
        status: "In Treatment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId)
      .eq("status", "Waiting")
      .select("*")
      .single();

    if (updateError || !updatedPatient) {
      console.error(
        "ACCEPT PATIENT UPDATE ERROR:",
        updateError
      );

      return res.status(500).json({
        message:
          "Failed to accept patient",
        error:
          updateError?.message,
      });
    }

    /*
     * Record flow event in audit logs.
     *
     * Uses the schema you already have:
     * user_id
     * user_email
     * user_role
     * patient_id
     * action
     * details
     */
    const { error: auditError } =
      await supabase
        .from("audit_logs")
        .insert({
          user_id: userId,
          patient_id: patientId,
          action: "patient_accepted",
          details: {
            previous_status: "Waiting",
            new_status: "In Treatment",
            clinician_role: userRole,
          },
        });

    if (auditError) {
      console.error(
        "ACCEPT PATIENT AUDIT ERROR:",
        auditError
      );
    }

    return res.status(200).json({
      message:
        "Patient accepted successfully",

      patient: updatedPatient,

      previous_status: "Waiting",

      new_status: "In Treatment",
    });
  } catch (error: any) {
    console.error(
      "ACCEPT PATIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| COMPLETE PATIENT
|
| POST /api/patients/:patientId/complete
|
| In Treatment -> Completed
|--------------------------------------------------------------------------
*/

export async function completePatient(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated clinician required",
      });
    }

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    if (patient.status !== "In Treatment") {
      return res.status(400).json({
        message:
          `Patient cannot be completed because current status is "${patient.status}"`,
      });
    }

    const {
      data: updatedPatient,
      error: updateError,
    } = await supabase
      .from("patients")
      .update({
        status: "Completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId)
      .eq("status", "In Treatment")
      .select("*")
      .single();

    if (updateError || !updatedPatient) {
      console.error(
        "COMPLETE PATIENT UPDATE ERROR:",
        updateError
      );

      return res.status(500).json({
        message:
          "Failed to complete patient",
        error:
          updateError?.message,
      });
    }

    const { error: auditError } =
      await supabase
        .from("audit_logs")
        .insert({
          user_id: userId,
          patient_id: patientId,
          action: "patient_completed",
          details: {
            previous_status: "In Treatment",
            new_status: "Completed",
            clinician_role: userRole,
          },
        });

    if (auditError) {
      console.error(
        "COMPLETE PATIENT AUDIT ERROR:",
        auditError
      );
    }

    return res.status(200).json({
      message:
        "Patient completed successfully",

      patient: updatedPatient,
    });
  } catch (error: any) {
    console.error(
      "COMPLETE PATIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| DISCHARGE PATIENT
|
| POST /api/patients/:patientId/discharge
|
| In Treatment / Completed -> Discharged
|--------------------------------------------------------------------------
*/

export async function dischargePatient(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated clinician required",
      });
    }

    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    const allowedStatuses = [
      "In Treatment",
      "Completed",
    ];

    if (
      !allowedStatuses.includes(
        patient.status
      )
    ) {
      return res.status(400).json({
        message:
          `Patient cannot be discharged from "${patient.status}" status`,
      });
    }

    const previousStatus =
      patient.status;

    const {
      data: updatedPatient,
      error: updateError,
    } = await supabase
      .from("patients")
      .update({
        status: "Discharged",
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId)
      .select("*")
      .single();

    if (updateError || !updatedPatient) {
      console.error(
        "DISCHARGE PATIENT UPDATE ERROR:",
        updateError
      );

      return res.status(500).json({
        message:
          "Failed to discharge patient",
        error:
          updateError?.message,
      });
    }

    const { error: auditError } =
      await supabase
        .from("audit_logs")
        .insert({
          user_id: userId,
          patient_id: patientId,
          action: "patient_discharged",
          details: {
            previous_status:
              previousStatus,

            new_status:
              "Discharged",

            clinician_role:
              userRole,
          },
        });

    if (auditError) {
      console.error(
        "DISCHARGE PATIENT AUDIT ERROR:",
        auditError
      );
    }

    return res.status(200).json({
      message:
        "Patient discharged successfully",

      patient: updatedPatient,
    });
  } catch (error: any) {
    console.error(
      "DISCHARGE PATIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

/*
|--------------------------------------------------------------------------
| GENERIC STATUS UPDATE
|
| PATCH /api/patients/:patientId/status
|--------------------------------------------------------------------------
*/

export async function updatePatientStatus(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const {
      status,
    } = req.body;

    const VALID_STATUSES = [
      "Waiting",
      "In Treatment",
      "Completed",
      "Discharged",
    ];

    if (
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        message:
          "Invalid status. Allowed values: Waiting, In Treatment, Completed, Discharged",
      });
    }

    /*
     * Fetch current patient
     */
    const {
      data: patient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select("id, status")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    const previousStatus =
      patient.status;

    /*
     * No need to update if same status.
     */
    if (
      previousStatus === status
    ) {
      return res.status(200).json({
        message:
          "Patient already has this status",

        patient,
      });
    }

    /*
     * Update
     */
    const {
      data: updatedPatient,
      error: updateError,
    } = await supabase
      .from("patients")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId)
      .select("*")
      .single();

    if (updateError || !updatedPatient) {
      console.error(
        "UPDATE PATIENT STATUS ERROR:",
        updateError
      );

      return res.status(500).json({
        message:
          "Failed to update patient status",
        error:
          updateError?.message,
      });
    }

    /*
     * Audit
     */
    const { error: auditError } =
      await supabase
        .from("audit_logs")
        .insert({
          user_id: userId,
          patient_id: patientId,
          action: "patient_status_changed",
          details: {
            previous_status:
              previousStatus,

            new_status:
              status,

            clinician_role:
              userRole,
          },
        });

    if (auditError) {
      console.error(
        "STATUS AUDIT ERROR:",
        auditError
      );
    }

    return res.status(200).json({
      message:
        "Patient status updated successfully",

      patient: updatedPatient,

      previous_status:
        previousStatus,

      new_status:
        status,
    });
  } catch (error: any) {
    console.error(
      "UPDATE PATIENT STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}