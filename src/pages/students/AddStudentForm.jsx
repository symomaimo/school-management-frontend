import React, { useState } from "react";
import api from "../../api/Axios.js";

const CLASS_LABELS = [
  "Playgroup", "PP1", "PP2",
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9"
];

const TERMS = ["Term1","Term2","Term3"];

function normalizePhone(input) {
  if (!input) return "";
  let s = String(input).trim();
  s = s.replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(s)) return "+254" + s.slice(1);
  if (/^7\d{8}$/.test(s)) return "+254" + s;
  return s;
}

const AddStudentForm = ({ onClose, onStudentAdded, selectedYear, initialData = null }) => {
  const [firstName, setFirstName] = useState(initialData?.firstName || "");
  const [secondName, setSecondName] = useState(initialData?.secondName || "");
  const [studentclass, setStudentClass] = useState(initialData?.studentclass || "");

  const [parentFullName, setParentFullName] = useState(
    initialData?.parent?.fullName || initialData?.parent?.name || ""
  );
  const [parentPhone, setParentPhone] = useState(initialData?.parent?.phone || "");
  const [parentAddress, setParentAddress] = useState(
    initialData?.parent?.address || initialData?.parent?.residence || ""
  );
  const [parentEmail, setParentEmail] = useState(initialData?.parent?.email || "");

  const [isNewAdmission, setIsNewAdmission] = useState(false);
  const [admittedYear, setAdmittedYear] = useState("");
  const [admittedTerm, setAdmittedTerm] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const phone = normalizePhone(parentPhone);
    if (phone && !/^\+?\d{10,15}$/.test(phone)) {
      alert("Please enter a valid phone number (e.g., +254712345678).");
      return;
    }

    const payload = {
      firstName,
      secondName,
      studentclass,

      // ✅ IMPORTANT: makes student appear in the selected year list (Option B)
      currentYear: Number(selectedYear),

      parentDetails: {
        fullName: parentFullName,
        phone,
        address: parentAddress,
        email: parentEmail,
      },
    };

    if (!initialData && isNewAdmission) {
      payload.isNewAdmission = true;
      payload.admittedYear = admittedYear ? Number(admittedYear) : undefined;
      payload.admittedTerm = admittedTerm || undefined;
    }

    setIsSubmitting(true);
    try {
      if (initialData) {
        await api.put(`/students/${initialData._id}`, payload);
      } else {
        await api.post("/students", payload);
      }

      alert(initialData ? "Student updated ✅" : "Student added ✅");
      onStudentAdded();
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.msg ||
        err?.message ||
        "Error submitting data ❌";
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 px-4">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg w-full max-w-xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-bold mb-1">
          {initialData ? "Edit Student" : "Add Student"}
        </h2>
        <div className="text-sm text-gray-600 mb-4">
          Enrollment year: <b>{selectedYear}</b>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Student Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block mb-1">First Name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </label>

            <label className="block">
              <span className="block mb-1">Second Name</span>
              <input
                type="text"
                value={secondName}
                onChange={(e) => setSecondName(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="block mb-1">Class</span>
              <select
                value={studentclass}
                onChange={(e) => setStudentClass(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded bg-white"
              >
                <option value="" disabled>Select class</option>
                {CLASS_LABELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          {/* New Admission (only when creating) */}
          {!initialData && (
            <div className="space-y-3 border rounded p-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isNewAdmission}
                  onChange={(e) => setIsNewAdmission(e.target.checked)}
                />
                <span className="font-medium">Mark as new admission</span>
              </label>

              {isNewAdmission && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block mb-1">Admitted Year</span>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={admittedYear}
                      onChange={(e) => setAdmittedYear(e.target.value)}
                      className="w-full border px-3 py-2 rounded"
                      placeholder="e.g., 2026"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block mb-1">Admitted Term</span>
                    <select
                      value={admittedTerm}
                      onChange={(e) => setAdmittedTerm(e.target.value)}
                      className="w-full border px-3 py-2 rounded bg-white"
                      required
                    >
                      <option value="" disabled>Select term</option>
                      {TERMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Parent Info */}
          <div>
            <h3 className="font-semibold mb-2">Parent / Guardian</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block mb-1">Full Name</span>
                <input
                  type="text"
                  value={parentFullName}
                  onChange={(e) => setParentFullName(e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                />
              </label>

              <label className="block">
                <span className="block mb-1">Phone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(normalizePhone(e.target.value))}
                  className="w-full border px-3 py-2 rounded"
                  placeholder="+254712345678"
                />
              </label>

              <label className="block">
                <span className="block mb-1">Address / Residence</span>
                <input
                  type="text"
                  value={parentAddress}
                  onChange={(e) => setParentAddress(e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                />
              </label>

              <label className="block">
                <span className="block mb-1">Email (optional)</span>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2 rounded text-white ${
                isSubmitting ? "bg-green-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isSubmitting ? "Saving..." : (initialData ? "Save Changes" : "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudentForm;
