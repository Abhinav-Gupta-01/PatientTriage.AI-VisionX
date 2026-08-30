import { Router } from "express";

import {
  auth,
  requireRole,
} from "../middleware/auth";

import {
  acceptPatient,
  completePatient,
  dischargePatient,
  updatePatientStatus,
} from "../controllers/patientFlowController";

const router = Router();

/*
|--------------------------------------------------------------------------
| ACCEPT
|--------------------------------------------------------------------------
|
| POST /api/patients/:patientId/accept
|
| Waiting -> In Treatment
|
*/

router.post(
  "/patients/:patientId/accept",
  auth,
  requireRole("doctor", "nurse"),
  acceptPatient
);

/*
|--------------------------------------------------------------------------
| COMPLETE
|--------------------------------------------------------------------------
|
| POST /api/patients/:patientId/complete
|
| In Treatment -> Completed
|
*/

router.post(
  "/patients/:patientId/complete",
  auth,
  requireRole("doctor", "nurse"),
  completePatient
);

/*
|--------------------------------------------------------------------------
| DISCHARGE
|--------------------------------------------------------------------------
|
| POST /api/patients/:patientId/discharge
|
| In Treatment/Completed -> Discharged
|
*/

router.post(
  "/patients/:patientId/discharge",
  auth,
  requireRole("doctor", "nurse"),
  dischargePatient
);

/*
|--------------------------------------------------------------------------
| GENERIC STATUS
|--------------------------------------------------------------------------
|
| PATCH /api/patients/:patientId/status
|
*/

router.patch(
  "/patients/:patientId/status",
  auth,
  requireRole(
    "doctor",
    "nurse",
    "admin"
  ),
  updatePatientStatus
);

export default router;