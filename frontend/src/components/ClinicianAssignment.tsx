import { useEffect, useState } from "react";
import {
  UserRound,
  Stethoscope,
  HeartPulse,
  Save,
  X,
  RefreshCw,
} from "lucide-react";

import api from "../services/api";

type Clinician = {
  id: string;
  full_name: string;
  email: string;
  role: "doctor" | "nurse";
};

type Props = {
  patientId: string;
};

export default function ClinicianAssignment({
  patientId,
}: Props) {

  const [clinicians, setClinicians] =
    useState<Clinician[]>([]);

  const [doctorId, setDoctorId] =
    useState("");

  const [nurseId, setNurseId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  // ===================================================
  // LOAD
  // ===================================================

  async function loadData() {

    try {

      setLoading(true);
      setError("");

      const [
        cliniciansResponse,
        assignmentResponse,
      ] = await Promise.all([
        api.get("/clinicians"),
        api.get(
          `/patients/${patientId}/assignment`
        ),
      ]);


      const list =
        cliniciansResponse.data
          ?.clinicians ??
        [];

      setClinicians(list);


      const assignment =
        assignmentResponse.data;

      setDoctorId(
        assignment?.assigned_doctor_id ??
        assignment?.doctor?.id ??
        ""
      );

      setNurseId(
        assignment?.assigned_nurse_id ??
        assignment?.nurse?.id ??
        ""
      );

    } catch (err: any) {

      console.error(
        "CLINICIAN LOAD ERROR:",
        err
      );

      setError(
        err?.response?.data?.error ??
        "Unable to load clinician assignment"
      );

    } finally {

      setLoading(false);

    }
  }


  useEffect(() => {
    loadData();
  }, [patientId]);


  // ===================================================
  // SAVE
  // ===================================================

  async function saveAssignment() {

    try {

      setSaving(true);
      setError("");
      setSuccess("");

      await api.post(
        `/patients/${patientId}/assignment`,
        {
          doctorId:
            doctorId || null,

          nurseId:
            nurseId || null,
        }
      );

      setSuccess(
        "Care team updated successfully."
      );

    } catch (err: any) {

      console.error(
        "CLINICIAN ASSIGNMENT ERROR:",
        err
      );

      setError(
        err?.response?.data?.error ??
        "Unable to update care team"
      );

    } finally {

      setSaving(false);

    }
  }


  const doctors =
    clinicians.filter(
      (c) =>
        c.role === "doctor"
    );

  const nurses =
    clinicians.filter(
      (c) =>
        c.role === "nurse"
    );


  if (loading) {

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">

        <div className="flex items-center gap-2 text-sm text-slate-500">

          <RefreshCw
            size={16}
            className="animate-spin"
          />

          Loading care team...

        </div>

      </div>
    );
  }


  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

      {/* HEADER */}

      <div className="border-b border-slate-200 p-5">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">

            <UserRound size={20} />

          </div>

          <div>

            <h2 className="font-semibold text-slate-900">

              Assigned Care Team

            </h2>

            <p className="text-xs text-slate-500">

              Manage the clinicians responsible
              for this patient

            </p>

          </div>

        </div>

      </div>


      {/* BODY */}

      <div className="space-y-5 p-5">

        {/* DOCTOR */}

        <div>

          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">

            <Stethoscope
              size={16}
              className="text-indigo-600"
            />

            Primary Doctor

          </label>

          <select
            value={doctorId}
            onChange={(e) =>
              setDoctorId(
                e.target.value
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >

            <option value="">
              No doctor assigned
            </option>

            {doctors.map(
              (doctor) => (
                <option
                  key={
                    doctor.id
                  }
                  value={
                    doctor.id
                  }
                >
                  {doctor.full_name}
                  {" — "}
                  {doctor.email}
                </option>
              )
            )}

          </select>

        </div>


        {/* NURSE */}

        <div>

          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">

            <HeartPulse
              size={16}
              className="text-rose-500"
            />

            Assigned Nurse

          </label>

          <select
            value={nurseId}
            onChange={(e) =>
              setNurseId(
                e.target.value
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >

            <option value="">
              No nurse assigned
            </option>

            {nurses.map(
              (nurse) => (
                <option
                  key={
                    nurse.id
                  }
                  value={
                    nurse.id
                  }
                >
                  {nurse.full_name}
                  {" — "}
                  {nurse.email}
                </option>
              )
            )}

          </select>

        </div>


        {/* ERROR */}

        {error && (

          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">

            {error}

          </div>

        )}


        {/* SUCCESS */}

        {success && (

          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">

            {success}

          </div>

        )}


        {/* BUTTON */}

        <div className="flex justify-end">

          <button
            onClick={
              saveAssignment
            }
            disabled={
              saving
            }
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {saving ? (
              <>
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />

                Saving...

              </>
            ) : (
              <>
                <Save
                  size={16}
                />

                Save Care Team

              </>
            )}

          </button>

        </div>

      </div>

    </div>
  );
}