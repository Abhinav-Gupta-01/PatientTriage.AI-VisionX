import { Router } from "express";

import {
  getPatientDecisions,
  createClinicianDecision,
} from "../controllers/clinicianDecisionController";

import { auth, requireRole } from "../middleware/auth";

const router = Router();

/*
 * GET
 * /api/patients/:patientId/decisions
 *
 * Any authenticated clinical user can view
 * the decision history.
 */
router.get(
  "/patients/:patientId/decisions",
  auth,
  getPatientDecisions
);

/*
 * POST
 * /api/patients/:patientId/decisions
 *
 * Doctor/Admin can record final clinical decisions.
 */
router.post(
  "/patients/:patientId/decisions",
  auth,
  requireRole("doctor", "admin"),
  createClinicianDecision
);

export default router;