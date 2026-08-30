import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const steps = ["Patient Info", "Complaint", "Vitals", "Observations", "Review"];

const Field = ({ name, label, type, f, setF }: any) => (
  <div>
    <label className="text-xs uppercase text-slate-500 font-semibold">
      {label}
    </label>

    <input
      type={type || "text"}
      value={f[name]}
      onChange={(e) =>
        setF({
          ...f,
          [name]: type === "number" ? Number(e.target.value) : e.target.value,
        })
      }
      className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300"
    />
  </div>
);

export default function AddPatient() {
  const nav = useNavigate();

  const [step, setStep] = useState(0);

  const [f, setF] = useState<any>({
    age: 45,
    sex: "M",
    medical_history: "",
    medications: "",
    allergies: "",
    chief_complaint: "",
    symptoms: "",
    pain_score: 3,
    duration: "1 hour",
    heart_rate: 80,
    systolic_bp: 120,
    diastolic_bp: 80,
    spo2: 98,
    respiratory_rate: 16,
    temperature: 36.9,
    consciousness: "Alert",
    distress: "None",
    mobility: "Ambulatory",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setLoading(true);
    setErr("");

    try {
      const { data } = await api.post("/patients", f);
      nav("/patient/" + data.patient.id);
    } catch (e: any) {
      setErr(e.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Add Patient</h1>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={
              "flex-1 h-2 rounded-full " +
              (i <= step ? "bg-indigo-600" : "bg-slate-200")
            }
          />
        ))}
      </div>

      <div className="text-sm text-slate-600">
        Step {step + 1} of {steps.length}: <b>{steps[step]}</b>
      </div>

      <div className="card p-6 space-y-4">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Field
              name="age"
              label="Age"
              type="number"
              f={f}
              setF={setF}
            />

            <div>
              <label className="text-xs uppercase text-slate-500 font-semibold">
                Sex
              </label>

              <select
                value={f.sex}
                onChange={(e) => setF({ ...f, sex: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300"
              >
                <option>M</option>
                <option>F</option>
                <option>Other</option>
              </select>
            </div>

            <Field
              name="medical_history"
              label="Medical History"
              f={f}
              setF={setF}
            />

            <Field
              name="medications"
              label="Medications"
              f={f}
              setF={setF}
            />

            <Field
              name="allergies"
              label="Allergies"
              f={f}
              setF={setF}
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <Field
              name="chief_complaint"
              label="Chief Complaint"
              f={f}
              setF={setF}
            />

            <Field
              name="symptoms"
              label="Symptoms"
              f={f}
              setF={setF}
            />

            <Field
              name="pain_score"
              label="Pain (0-10)"
              type="number"
              f={f}
              setF={setF}
            />

            <Field
              name="duration"
              label="Duration"
              f={f}
              setF={setF}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-3 gap-4">
            <Field
              name="heart_rate"
              label="Heart Rate"
              type="number"
              f={f}
              setF={setF}
            />

            <Field
              name="systolic_bp"
              label="Systolic BP"
              type="number"
              f={f}
              setF={setF}
            />

            <Field
              name="diastolic_bp"
              label="Diastolic BP"
              type="number"
              f={f}
              setF={setF}
            />

            <Field
              name="spo2"
              label="SpO2 %"
              type="number"
              f={f}
              setF={setF}
            />

            <Field
              name="respiratory_rate"
              label="Respiratory Rate"
              type="number"
              f={f}
              setF={setF}
            />

            <Field
              name="temperature"
              label="Temperature (C)"
              type="number"
              f={f}
              setF={setF}
            />
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-2 gap-4">
            <Field
              name="consciousness"
              label="Consciousness"
              f={f}
              setF={setF}
            />

            <Field
              name="distress"
              label="Distress"
              f={f}
              setF={setF}
            />

            <Field
              name="mobility"
              label="Mobility"
              f={f}
              setF={setF}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-500">
              Review patient data before analysis:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 bg-slate-50/80 backdrop-blur p-5 rounded-xl border border-slate-200 shadow-sm">
              {Object.entries(f).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm font-medium text-slate-800 mt-0.5">
                    {value !== "" ? String(value) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {err && (
          <div className="flex items-start gap-3 p-4 bg-red-50/80 backdrop-blur border border-red-200/60 rounded-xl text-red-700 shadow-sm">
            <span className="mt-0.5 text-red-500">⚠️</span>
            <div>
              <div className="font-bold text-sm">Submission Failed</div>
              <div className="text-xs font-medium mt-1 opacity-90">{err}</div>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="btn btn-secondary"
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="btn btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              disabled={loading}
              onClick={submit}
              className="btn btn-primary"
            >
              {loading ? "Analyzing..." : "Analyze Patient"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}