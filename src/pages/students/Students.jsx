// src/pages/students/Students.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../../api/Axios.js";
import AddStudentForm from "./AddStudentForm";

const CLASS_FILTERS = [
  "Playgroup","PP1","PP2",
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9",
];

function normalizeClass(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "";
  if (["playgroup", "play group", "pg"].includes(v)) return "Playgroup";
  if (["pp1", "pp 1", "pp-1"].includes(v)) return "PP1";
  if (["pp2", "pp 2", "pp-2"].includes(v)) return "PP2";

  const gradeNum =
    v.match(/(?:grade|class|std|standard)[-\s]*([1-9])/i)?.[1] ||
    v.match(/^g([1-9])$/i)?.[1] ||
    v.match(/^grade\s*([1-9])$/i)?.[1] ||
    v.match(/^grade[-\s]*([1-9])$/i)?.[1];

  if (gradeNum) return `Grade ${gradeNum}`;
  return raw ? String(raw).trim() : "";
}

export default function Students() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("Duplicate / wrong entry");

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function fetchStudents() {
    try {
      setError(null);
      setLoading(true);

      // ✅ Option B: only students enrolled in selected year
      const res = await api.get("/students", {
        params: { year, onlyEnrolled: true },
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      setStudents(rows);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleStudentAdded() {
    fetchStudents();
  }

  function handleView(id) {
    const s = students.find((x) => x._id === id);
    if (!s) return;

    setDeleteReason("Duplicate / wrong entry");

    // ✅ when opening modal, use classForYear for editing
    setSelectedStudent({
      ...s,
      studentclass: s.classForYear || s.studentclass,
      parent: s.parent || { fullName: "", phone: "", address: "", email: "" },
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    try {
      const payload = {
        year, // ✅ IMPORTANT: update enrollment for this year
        firstName: selectedStudent.firstName,
        secondName: selectedStudent.secondName,
        studentclass: selectedStudent.studentclass,
        parentDetails: {
          fullName: selectedStudent.parent?.fullName || "",
          phone: selectedStudent.parent?.phone || "",
          address: selectedStudent.parent?.address || "",
          email: selectedStudent.parent?.email || "",
        },
      };

      const res = await api.put(`/students/${selectedStudent._id}`, payload);

      if (res.status === 200) {
        alert("Student updated ✅");
        setSelectedStudent(null);
        fetchStudents();
      }
    } catch (err) {
      const msg =
        err?.response?.status === 409
          ? "That phone is already linked to another parent."
          : err?.response?.data?.error ||
            err?.response?.data?.msg ||
            err.message ||
            "Update failed";
      alert(msg);
    }
  }

  async function handleDeleteStudent() {
    if (!selectedStudent?._id) return;

    const name = `${selectedStudent.firstName || ""} ${selectedStudent.secondName || ""}`.trim();

    const ok = window.confirm(
      `Delete (Deactivate) this student?\n\n${name}\nYear: ${year}\n\nThis will NOT remove payments. It only hides the student from active lists.`
    );
    if (!ok) return;

    try {
      setDeleting(true);

      await api.delete(`/students/${selectedStudent._id}`, {
        data: { reason: deleteReason || "Deleted by user" },
      });

      alert("Student deleted (deactivated) ✅");
      setSelectedStudent(null);
      await fetchStudents();
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to delete student";
      alert(msg);
    } finally {
      setDeleting(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (students || []).filter((s) => {
      const cls = normalizeClass(s?.classForYear || s?.studentclass);
      const matchesClass = selectedClass ? cls === selectedClass : true;

      const full = `${s?.firstName ?? ""} ${s?.secondName ?? ""}`.trim().toLowerCase();
      const matchesSearch = q ? full.includes(q) : true;

      return matchesClass && matchesSearch;
    });
  }, [students, selectedClass, searchTerm]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b pb-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div>
            <h2 className="text-2xl font-bold">Manage Students</h2>
            <div className="text-sm text-gray-600">
              Showing enrolled students for <b>{year}</b> (Total: {students.length})
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Year switcher */}
            <button
              type="button"
              className="px-2 py-1 border rounded text-sm"
              onClick={() => setYear((y) => y - 1)}
              title="Previous year"
            >
              −
            </button>
            <input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 border rounded-lg px-2 py-1 text-sm text-center"
            />
            <button
              type="button"
              className="px-2 py-1 border rounded text-sm"
              onClick={() => setYear((y) => y + 1)}
              title="Next year"
            >
              +
            </button>

            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
            >
              Add Student
            </button>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="mt-3">
          <p className="text-sm mb-2 text-gray-700">Filter by Class</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex flex-nowrap gap-2 min-w-max">
                {CLASS_FILTERS.map((label) => (
                  <button
                    key={label}
                    onClick={() => setSelectedClass(label)}
                    className={[
                      "px-3 py-1.5 rounded-lg text-xs sm:text-sm transition border",
                      selectedClass === label
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedClass("")}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs sm:text-sm transition border",
                    !selectedClass
                      ? "bg-gray-700 text-white border-gray-700"
                      : "bg-gray-500 hover:bg-gray-600 text-white border-gray-500",
                  ].join(" ")}
                >
                  All Classes
                </button>
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-64">
              <input
                type="text"
                placeholder="Search by name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 px-2 py-1 border rounded-lg shadow-sm text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 z-20 bg-gray-100 border-b">
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-2 px-4 py-3 text-gray-700 uppercase text-xs sm:text-sm font-semibold">
            <div>First Name</div>
            <div>Second Name</div>
            <div>Class ({year})</div>
            <div className="text-center">Action</div>
          </div>
        </div>

        <div className="divide-y">
          {filteredStudents.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500">No students found for {year}.</div>
          ) : (
            filteredStudents.map((s) => {
              const displayClass = normalizeClass(s?.classForYear || s?.studentclass);
              return (
                <div
                  key={s._id}
                  className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-2 px-4 py-3 hover:bg-gray-50 items-center text-sm"
                >
                  <div className="truncate">{s.firstName}</div>
                  <div className="truncate">{s.secondName}</div>
                  <div className="truncate">{displayClass}</div>
                  <div className="text-center">
                    <button
                      onClick={() => handleView(s._id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded"
                    >
                      View / Edit
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add modal */}
      {showAddForm && (
        <AddStudentForm
          onClose={() => setShowAddForm(false)}
          onStudentAdded={handleStudentAdded}
          selectedYear={year}   // ✅ pass year into form
          initialData={null}
        />
      )}

      {/* Edit modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-y-auto py-10">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-1">Student Details</h3>
            <div className="text-sm text-gray-600 mb-4">
              Editing enrollment for year <b>{year}</b>
            </div>

            <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="block">
                  <span className="block mb-1">First Name</span>
                  <input
                    type="text"
                    value={selectedStudent.firstName || ""}
                    onChange={(e) =>
                      setSelectedStudent({ ...selectedStudent, firstName: e.target.value })
                    }
                    className="w-full border p-2 rounded"
                    required
                  />
                </label>

                <label className="block">
                  <span className="block mb-1">Second Name</span>
                  <input
                    type="text"
                    value={selectedStudent.secondName || ""}
                    onChange={(e) =>
                      setSelectedStudent({ ...selectedStudent, secondName: e.target.value })
                    }
                    className="w-full border p-2 rounded"
                    required
                  />
                </label>

                <label className="block">
                  <span className="block mb-1">Class ({year})</span>
                  <select
                    value={selectedStudent.studentclass || ""}
                    onChange={(e) =>
                      setSelectedStudent({ ...selectedStudent, studentclass: e.target.value })
                    }
                    className="w-full border p-2 rounded bg-white"
                    required
                  >
                    <option value="" disabled>Select class</option>
                    {CLASS_FILTERS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                {/* Delete */}
                <div className="mt-4 border-t pt-3">
                  <div className="text-sm font-semibold text-red-700 mb-2">
                    Delete (Deactivate) Student
                  </div>
                  <input
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="Reason (e.g. duplicate, transferred, wrong entry)"
                  />
                  <button
                    type="button"
                    onClick={handleDeleteStudent}
                    disabled={deleting}
                    className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Delete Student"}
                  </button>
                  <div className="text-xs text-gray-500 mt-1">
                    Safe delete: student becomes <b>inactive</b> (payments remain).
                  </div>
                </div>
              </div>

              {/* Parent */}
              <div className="space-y-3">
                <label className="block">
                  <span className="block mb-1">Parent Full Name</span>
                  <input
                    type="text"
                    value={selectedStudent.parent?.fullName || ""}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        parent: { ...selectedStudent.parent, fullName: e.target.value },
                      })
                    }
                    className="w-full border p-2 rounded"
                  />
                </label>

                <label className="block">
                  <span className="block mb-1">Phone</span>
                  <input
                    type="tel"
                    value={selectedStudent.parent?.phone || ""}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        parent: { ...selectedStudent.parent, phone: e.target.value },
                      })
                    }
                    className="w-full border p-2 rounded"
                    placeholder="+254712345678"
                  />
                </label>

                <label className="block">
                  <span className="block mb-1">Address / Residence</span>
                  <input
                    type="text"
                    value={selectedStudent.parent?.address || ""}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        parent: { ...selectedStudent.parent, address: e.target.value },
                      })
                    }
                    className="w-full border p-2 rounded"
                  />
                </label>

                <label className="block">
                  <span className="block mb-1">Email (optional)</span>
                  <input
                    type="email"
                    value={selectedStudent.parent?.email || ""}
                    onChange={(e) =>
                      setSelectedStudent({
                        ...selectedStudent,
                        parent: { ...selectedStudent.parent, email: e.target.value },
                      })
                    }
                    className="w-full border p-2 rounded"
                  />
                </label>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
