import { Router } from "express";

import {
  auth,
  requireRole,
} from "../middleware/auth";

import {
  login,
  me,
} from "../controllers/authController";

import {
  listPatients,
  getPatient,
  createPatient,
  reassess,
  decision,
} from "../controllers/patientController";

import {
  alerts,
  resolveAlert,
  auditLogs,
  analytics,
  systemHealth,
} from "../controllers/otherControllers";

import {
  startSim,
  stopSim,
  simStatus,
} from "../simulation/engine";

import clinicianDecisionRoutes from "./clinicianDecisionRoutes";

import patientFlowRoutes from "./patientFlowRoutes";

const r = Router();

// ==================================================
// AUTH
// ==================================================

r.post(
  "/auth/login",
  login
);

r.get(
  "/auth/me",
  auth,
  me
);

// ==================================================
// PATIENTS
// ==================================================

r.get(
  "/patients",
  auth,
  listPatients
);

r.get(
  "/patients/:id",
  auth,
  getPatient
);

r.post(
  "/patients",
  auth,
  createPatient
);

r.post(
  "/patients/:id/reassess",
  auth,
  reassess
);

r.post(
  "/patients/:id/decision",
  auth,
  requireRole(
    "doctor",
    "admin"
  ),
  decision
);

// ==================================================
// ALERTS
// ==================================================

r.get(
  "/alerts",
  auth,
  alerts
);

r.post(
  "/alerts/:id/resolve",
  auth,
  resolveAlert
);

// ==================================================
// AUDIT
// ==================================================

r.get(
  "/audit-logs",
  auth,
  auditLogs
);

// ==================================================
// ANALYTICS
// ==================================================

r.get(
  "/analytics",
  auth,
  analytics
);

// ==================================================
// SYSTEM HEALTH
// ==================================================

r.get(
  "/system-health",
  auth,
  systemHealth
);

// ==================================================
// SIMULATION
// ==================================================

r.post(
  "/simulation/start",
  auth,
  requireRole(
    "admin",
    "doctor"
  ),
  async (req, res) => {
    try {
      const {
        mode = "normal",
        speed = 1,
      } = req.body;

      const s = await startSim(
        mode,
        speed
      );

      return res.json(s);
    } catch (error: any) {
      console.error(
        "SIMULATION START ERROR:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to start simulation",
      });
    }
  }
);

r.post(
  "/simulation/stop",
  auth,
  requireRole(
    "admin",
    "doctor"
  ),
  (_req, res) => {
    return res.json(
      stopSim()
    );
  }
);

r.get(
  "/simulation/status",
  auth,
  (_req, res) => {
    return res.json(
      simStatus()
    );
  }
);

// ==================================================
// CLINICIAN DECISIONS
// ==================================================

r.use(
  clinicianDecisionRoutes
);

// ==================================================
// PATIENT FLOW
// ==================================================

r.use(
  patientFlowRoutes
);

export default r;