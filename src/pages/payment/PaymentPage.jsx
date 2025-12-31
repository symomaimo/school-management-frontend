// src/pages/payment/PaymentPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/Axios.js";            // ✅ use the shared axios instance
import StudentsPayments from "./StudentsPayments.jsx";

// fixed order so every class appears (even when count = 0)
const CLASS_ORDER = [
  "Playgroup", "PP1", "PP2",
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9"
];

/* ---------- class normalizer so filter always works ---------- */
function normalizeClass(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "Unassigned";
  if (["playgroup", "play group", "pg"].includes(v)) return "Playgroup";
  if (["pp1", "pp 1", "pp-1"].includes(v)) return "PP1";
  if (["pp2", "pp 2", "pp-2"].includes(v)) return "PP2";
  const m = v.match(/(grade|class|std|standard)\s*[- ]?\s*([1-9])/);
  if (m) return `Grade ${m[2]}`;
  const m2 = v.match(/^grade\s*([1-9])$/);
  if (m2) return `Grade ${m2[1]}`;
  return "Unassigned";
}

/* ---------- sensible defaults for year/term ---------- */
function guessTermFromMonth(m /* 0-11 */) {
  if (m <= 3) return "Term1";   // Jan–Apr
  if (m <= 7) return "Term2";   // May–Aug
  return "Term3";               // Sep–Dec
}

function PaymentPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("All");

  // DEFAULTS that can be changed by the user
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [term, setTerm] = useState(guessTermFromMonth(today.getMonth()));

  const [statusMap, setStatusMap] = useState(new Map()); // id -> {total, paid, status}

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/students");          // ✅ use api and a leading slash
        if (!alive) return;

        const rows = Array.isArray(res.data) ? res.data : [];
        const normalized = rows.map((s, idx) => {
          const id = s?._id ?? s?.id ?? s?.studentId ?? `tmp-${idx}`;
          const first =
            s?.firstName ?? s?.firstname ?? s?.FirstName ?? s?.first_name ?? s?.first ?? s?.fname;
          const second =
            s?.secondName ?? s?.secondname ?? s?.SecondName ?? s?.second_name ??
            s?.surname ?? s?.sirName ?? s?.sirname ?? s?.last ?? s?.lname;
          const fallbackName = [first, second].filter(Boolean).join(" ").trim();
          const displayName =
            (s?.name ?? s?.studentName ?? s?.studentname ?? s?.fullName ?? s?.fullname ?? fallbackName) || "Unnamed";

          const rawClass =
            s?.studentclass ?? s?.className ?? s?.class_name ?? s?.class ?? s?.Class ?? "";
          const norm = normalizeClass(rawClass);

          return {
            ...s,
            _id: String(id),
            name: displayName,
            studentclass: rawClass,
            normClass: norm,
          };
        });

        setStudents(normalized);
      } catch (e) {
        console.error(e);
        if (alive) setErr("Failed to load students.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Build status badges by calling /fees/statement per student
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!students.length) {
        setStatusMap(new Map());
        return;
      }
      try {
        const calls = students.map((s) =>
          api
            .get(`/fees/statement/${s._id}`, { params: { year, term } }) // ✅ api instance
            .then((r) => ({ id: s._id, ok: true, data: r.data }))
            .catch(() => ({ id: s._id, ok: false }))
        );
        const results = await Promise.all(calls);
        if (!alive) return;
        const map = new Map();
        for (const r of results) {
          if (!r.ok) { map.set(r.id, { total: 0, paid: 0, status: "—" }); continue; }
          const total = Number(r.data?.due?.total || 0);
          const paid = Number(r.data?.totalPaid || 0);
          let status = "OWING";
          if (paid >= total && total > 0) status = "PAID";
          else if (paid > 0 && paid < total) status = "PART";
          map.set(r.id, { total, paid, status });
        }
        setStatusMap(map);
      } catch (e) {
        if (!alive) return;
        console.error("summary build failed", e);
        setStatusMap(new Map());
      }
    })();
    return () => { alive = false; };
  }, [students, year, term]);

  // chips with counts (fixed order + All + Unassigned when present)
  const classChips = useMemo(() => {
    const counts = new Map();
    for (const s of students) {
      const cls = s?.normClass || "Unassigned";
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
    const chips = CLASS_ORDER.map((name) => ({ name, count: counts.get(name) ?? 0 }));
    if ((counts.get("Unassigned") ?? 0) > 0) {
      chips.push({ name: "Unassigned", count: counts.get("Unassigned") });
    }
    const allCount = students.length;
    return [{ name: "All", count: allCount }, ...chips];
  }, [students]);

  const visibleStudents = useMemo(() => {
    let list = students;
    if (classFilter !== "All") {
      list = list.filter((s) => (s.normClass || "Unassigned") === classFilter);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        (`${s.firstName ?? ""} ${s.secondName ?? ""} ${s.name ?? ""}`).toLowerCase().includes(q)
      );
    }
    return list
      .slice()
      .sort(
        (a, b) =>
          String(a.normClass || "").localeCompare(String(b.normClass || "")) ||
          String(a.firstName || a.name || "").localeCompare(String(b.firstName || b.name || ""))
      );
  }, [students, classFilter, searchTerm]);

  const Badge = ({ s }) => {
    const info = statusMap.get(s._id);
    if (!info) return <span className="text-xs text-gray-400">…</span>;
    const tone =
      info.status === "PAID"
        ? "bg-green-100 text-green-700 border-green-200"
        : info.status === "PART"
        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
        : info.status === "OWING"
        ? "bg-red-100 text-red-700 border-red-200"
        : "bg-gray-100 text-gray-600 border-gray-200";
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${tone}`}>
        {info.status}
      </span>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Sticky header with title + total students + term/year controls */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b pb-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <h1 className="text-2xl font-bold">
            Payments — Choose a Student
            <span className="ml-2 text-base font-medium text-gray-600">
              (Total: {students.length})
            </span>
          </h1>

          {/* Year/Term controls */}
          <div className="flex items-center gap-2">
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="border rounded-lg px-2 py-1 bg-white text-sm"
            >
              <option value="Term1">Term 1</option>
              <option value="Term2">Term 2</option>
              <option value="Term3">Term 3</option>
            </select>

            <div className="flex items-center gap-1">
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
            </div>
          </div>
        </div>

        {/* Chips + Search in one sticky bar */}
        <div className="mt-3 border-t pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex flex-nowrap gap-2 min-w-max">
                {classChips.map((c) => {
                  const active = classFilter === c.name;
                  return (
                    <button
                      key={c.name}
                      onClick={() => { setClassFilter(c.name); setSearchTerm(""); }}
                      className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm transition ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
                      }`}
                      title={`${c.name} (${c.count})`}
                    >
                      {c.name}
                      <span className={`ml-2 text-xs ${active ? "text-blue-100" : "text-gray-500"}`}>
                        {c.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact search */}
            <div className="shrink-0 w-full sm:w-64">
              <input
                type="text"
                placeholder={`Search in ${classFilter === "All" ? "all classes" : classFilter}…`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 px-2 py-1 border rounded-lg shadow-sm text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {err && <p className="text-red-600 mb-3">{err}</p>}
      {loading && (
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
          <div className="h-6 w-64 bg-gray-200 animate-pulse rounded" />
        </div>
      )}

      {/* List or Details */}
      {!loading && !selectedStudent && (
        <div className="bg-white border rounded-xl shadow-sm max-h-[82vh] overflow-y-auto">
          <div className="p-4">
            {visibleStudents.length === 0 ? (
              <p className="text-slate-600">
                {students.length === 0 ? "No students found." : "No matching students."}
              </p>
            ) : (
              <ul className="divide-y">
                {visibleStudents.map((s) => {
                  const displayName = s.firstName
                    ? `${s.firstName} ${s.secondName || ""}`.trim()
                    : s.name || "Unnamed";
                  return (
                    <li key={s._id} className="py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        <div className="text-xs text-slate-500">
                          Class: {s.studentclass || s.normClass || "—"} • ADM: {s.admissionNumber || "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge s={s} />
                        <button
                          onClick={() => setSelectedStudent(s)}
                          className="text-blue-600 hover:underline"
                        >
                          View/Add Payment
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {!loading && selectedStudent?._id && (
        <div className="bg-white border rounded-xl shadow-sm p-4">
          <button
            onClick={() => setSelectedStudent(null)}
            className="mb-3 text-sm text-blue-600 hover:underline"
          >
            ← Back to Students
          </button>
          <StudentsPayments
            studentId={selectedStudent._id}
            studentName={
              selectedStudent.firstName
                ? `${selectedStudent.firstName} ${selectedStudent.secondName || ""}`.trim()
                : selectedStudent.name
            }
            year={year}
            term={term}
          />
        </div>
      )}
    </div>
  );
}

export default PaymentPage;
