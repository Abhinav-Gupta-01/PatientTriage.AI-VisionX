import { Router } from "express";

import {
  listClinicians,
  getPatientAssignment,
  assignClinicians,
} from "../controllers/clinicianController";

import { auth } from "../middleware/auth";

const router = Router();


// =====================================================
// GET AVAILABLE DOCTORS + NURSES
// =====================================================

router.get(
  "/clinicians",
  auth,
  listClinicians
);


// =====================================================
// GET PATIENT ASSIGNMENT
// =====================================================

router.get(
  "/patients/:patientId/assignment",
  auth,
  getPatientAssignment
);


// =====================================================
// ASSIGN / REASSIGN
// =====================================================

router.post(
  "/patients/:patientId/assignment",
  auth,
  assignClinicians
);


export default router;