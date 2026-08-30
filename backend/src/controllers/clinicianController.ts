import { Request, Response } from "express";
import { supabase } from "../config/supabase";


// =====================================================
// GET AVAILABLE CLINICIANS
// =====================================================

export async function listClinicians(
  _req: Request,
  res: Response
) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, created_at")
      .in("role", ["doctor", "nurse"])
      .order("full_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "LIST CLINICIANS ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json({
      clinicians: data ?? [],
    });
  } catch (error) {
    console.error(
      "LIST CLINICIANS ERROR:",
      error
    );

    return res.status(500).json({
      error: "Unable to load clinicians",
    });
  }
}


// =====================================================
// GET PATIENT ASSIGNMENT
// =====================================================

export async function getPatientAssignment(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const { data, error } = await supabase
      .from("patients")
      .select(`
        id,
        patient_code,
        assigned_doctor_id,
        assigned_nurse_id,
        doctor:assigned_doctor_id (
          id,
          full_name,
          email,
          role
        ),
        nurse:assigned_nurse_id (
          id,
          full_name,
          email,
          role
        )
      `)
      .eq("id", patientId)
      .single();

    if (error) {
      console.error(
        "GET ASSIGNMENT ERROR:",
        error
      );

      return res.status(404).json({
        error: "Patient assignment not found",
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(
      "GET ASSIGNMENT ERROR:",
      error
    );

    return res.status(500).json({
      error: "Unable to load patient assignment",
    });
  }
}


// =====================================================
// ASSIGN / REASSIGN CLINICIANS
// =====================================================

export async function assignClinicians(
  req: Request,
  res: Response
) {
  try {
    const { patientId } = req.params;

    const {
      doctorId = null,
      nurseId = null,
    } = req.body;

    // -----------------------------------------------
    // CURRENT LOGGED-IN USER
    // -----------------------------------------------

    const currentUser = (req as any).user;

    if (!currentUser) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const currentRole =
      String(
        currentUser.role ?? ""
      ).toLowerCase();


    // -----------------------------------------------
    // ONLY ADMIN / DOCTOR CAN ASSIGN
    // -----------------------------------------------

    if (
      currentRole !== "admin" &&
      currentRole !== "doctor"
    ) {
      return res.status(403).json({
        error:
          "Only doctors and administrators can assign clinicians",
      });
    }


    // -----------------------------------------------
    // VALIDATE DOCTOR
    // -----------------------------------------------

    if (doctorId) {
      const { data: doctor, error } =
        await supabase
          .from("users")
          .select(
            "id, full_name, role"
          )
          .eq("id", doctorId)
          .eq("role", "doctor")
          .single();

      if (
        error ||
        !doctor
      ) {
        return res.status(400).json({
          error:
            "Selected doctor is invalid",
        });
      }
    }


    // -----------------------------------------------
    // VALIDATE NURSE
    // -----------------------------------------------

    if (nurseId) {
      const { data: nurse, error } =
        await supabase
          .from("users")
          .select(
            "id, full_name, role"
          )
          .eq("id", nurseId)
          .eq("role", "nurse")
          .single();

      if (
        error ||
        !nurse
      ) {
        return res.status(400).json({
          error:
            "Selected nurse is invalid",
        });
      }
    }


    // -----------------------------------------------
    // CHECK PATIENT
    // -----------------------------------------------

    const {
      data: existingPatient,
      error: patientError,
    } = await supabase
      .from("patients")
      .select(
        `
        id,
        patient_code,
        assigned_doctor_id,
        assigned_nurse_id
        `
      )
      .eq("id", patientId)
      .single();

    if (
      patientError ||
      !existingPatient
    ) {
      return res.status(404).json({
        error: "Patient not found",
      });
    }


    // -----------------------------------------------
    // UPDATE ASSIGNMENT
    // -----------------------------------------------

    const { data, error } =
      await supabase
        .from("patients")
        .update({
          assigned_doctor_id:
            doctorId,
          assigned_nurse_id:
            nurseId,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", patientId)
        .select(`
          id,
          patient_code,
          assigned_doctor_id,
          assigned_nurse_id,
          doctor:assigned_doctor_id (
            id,
            full_name,
            email,
            role
          ),
          nurse:assigned_nurse_id (
            id,
            full_name,
            email,
            role
          )
        `)
        .single();


    if (error) {
      console.error(
        "ASSIGN CLINICIAN ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message,
      });
    }


    // -----------------------------------------------
    // AUDIT LOG
    // -----------------------------------------------

    await supabase
      .from("audit_logs")
      .insert({
        user_id:
          currentUser.id,
        user_email:
          currentUser.email,
        user_role:
          currentRole,
        patient_id:
          patientId,
        action:
          "clinician_assignment",
        details: {
          previous_doctor_id:
            existingPatient.assigned_doctor_id,
          previous_nurse_id:
            existingPatient.assigned_nurse_id,

          new_doctor_id:
            doctorId,
          new_nurse_id:
            nurseId,
        },
      });


    return res.json({
      message:
        "Clinicians assigned successfully",
      assignment: data,
    });

  } catch (error) {

    console.error(
      "ASSIGN CLINICIAN ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to assign clinicians",
    });
  }
}