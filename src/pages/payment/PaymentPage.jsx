// src/pages/payment/PaymentPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../api/Axios.js";
import StudentsPayments from "./StudentsPayments.jsx";

const CLASS_ORDER = [
  "Playgroup", "PP1", "PP2",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
  "Grade 6", "Grade 7", "Grade 8", "Grade 9"
];

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

function guessTermFromMonth(m) {
  if (m <= 3) return "Term1";
  if (m <= 7) return "Term2";
  return "Term3";
}

/* ---------------- demand persistence ---------------- */
function demandKey(studentId, year, term) {
  return `demand:${studentId}:${year}:${term}`;
}
function getSavedDemand(studentId, year, term) {
  try {
    const raw = localStorage.getItem(demandKey(studentId, year, term));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveDemand(studentId, year, term, demandArr) {
  try {
    const clean = Array.isArray(demandArr) ? [...new Set(demandArr)].filter(Boolean) : [];
    localStorage.setItem(demandKey(studentId, year, term), JSON.stringify(clean));
  } catch {}
}

/* ---------------- promotion persistence ---------------- */
function promotedKey(studentId, fromYear) {
  return `promoted:${studentId}:${fromYear}`;
}
function getPromoted(studentId, fromYear) {
  try {
    return localStorage.getItem(promotedKey(studentId, fromYear)) === "1";
  } catch {
    return false;
  }
}
function setPromoted(studentId, fromYear, val) {
  try {
    localStorage.setItem(promotedKey(studentId, fromYear), val ? "1" : "0");
  } catch {}
}

/* ---------------- auth helpers ---------------- */
function getAuthUser() {
  try {
    const raw = localStorage.getItem("auth:user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function canPromoteByRole() {
  const u = getAuthUser();
  const role = u?.role || u?.user?.role;
  return role === "DIRECTOR" || role === "SECRETARY";
}

export default function PaymentPage() {
  const today = new Date();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("All");

  const [year, setYear] = useState(today.getFullYear());
  const [term, setTerm] = useState(guessTermFromMonth(today.getMonth()));

  // id -> {total, paid, balance, status}
  const [statusMap, setStatusMap] = useState(new Map());

  // promotion UI states
  const [promoting, setPromoting] = useState(false);
  const [promoteMsg, setPromoteMsg] = useState("");
  const [alreadyPromoted, setAlreadyPromoted] = useState(false);



  /* ---------------- load students for selected year ---------------- */
async function fetchStudentsForYear(y, attempt = 1) {
  console.log("FETCH STUDENTS START", {
    year: y,
    attempt,
    at: new Date().toISOString(),
  });

  try {
    const res = await api.get("/students", {
      params: { year: y, onlyEnrolled: true },
    });

    console.log("FETCH STUDENTS RESPONSE STATUS", res?.status);
    console.log("FETCH STUDENTS RAW DATA", res?.data);

    const rows = Array.isArray(res.data) ? res.data : [];

    console.log("FETCH STUDENTS COUNT", rows.length);

    return rows.map((s, idx) => {
      const id = s?._id ?? s?.id ?? s?.studentId ?? `tmp-${idx}`;

      const first =
        s?.firstName ?? s?.firstname ?? s?.FirstName ?? s?.first_name ?? s?.first ?? s?.fname;

      const second =
        s?.secondName ??
        s?.secondname ??
        s?.SecondName ??
        s?.second_name ??
        s?.surname ??
        s?.sirName ??
        s?.sirname ??
        s?.last ??
        s?.lname;

      const fallbackName = [first, second].filter(Boolean).join(" ").trim();

      const displayName =
        s?.name ??
        s?.studentName ??
        s?.studentname ??
        s?.fullName ??
        s?.fullname ??
        fallbackName ??
        "Unnamed";

      const rawClass =
        s?.classForYear ??
        s?.studentclass ??
        s?.className ??
        s?.class_name ??
        s?.class ??
        s?.Class ??
        "";

      const norm = normalizeClass(rawClass);

      return {
        ...s,
        _id: String(id),
        name: displayName || "Unnamed",
        studentclass: rawClass,
        normClass: norm,
      };
    });
  } catch (e) {
    const status = e?.response?.status;

    if (status === 503 && attempt < 3) {
      console.warn(`FETCH STUDENTS retrying after 503 (attempt ${attempt})`);
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
      return fetchStudentsForYear(y, attempt + 1);
    }

    throw e;
  }
}

  /* ---------------- compute one student's badge ---------------- */
  const refreshOneStatus = useCallback(
    async (studentId) => {
      if (!studentId) return;

      const savedDemand = getSavedDemand(studentId, year, term);

      try {
        const r = await api.get(`/fees/statement/${studentId}`, {
          params: { year, term, demand: savedDemand.join(",") },
        });

        const total = Number(r.data?.due?.total || 0);
        const paid = Number(r.data?.totalPaid || 0);
        const balance = Number(r.data?.balance ?? Math.max(0, total - paid));

        let status = "OWING";
        if (total > 0 && balance <= 0) status = "PAID";
        else if (paid > 0 && paid < total) status = "PART";

        setStatusMap((prev) => {
          const next = new Map(prev);
          next.set(String(studentId), { total, paid, balance, status });
          return next;
        });
      } catch (e) {
        setStatusMap((prev) => {
          const next = new Map(prev);
          next.set(String(studentId), {
            total: 0,
            paid: 0,
            balance: 0,
            status: "—",
          });
          return next;
        });
      }
    },
    [year, term]
  );

  /* ---------------- refresh selected student's live status ---------------- */
useEffect(() => {
  if (!selectedStudent?._id) return;
  refreshOneStatus(selectedStudent._id);
}, [selectedStudent?._id, year, term, refreshOneStatus]);

  /* ---------------- build badges in batches, skip while one student is open ---------------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      if (selectedStudent?._id) return;

      if (!students.length) {
        setStatusMap(new Map());
        return;
      }

      try {
        console.log("LOAD STATUS SUMMARY", {
          year,
          term,
          at: new Date().toISOString(),
        });

        const r = await api.get("/fees/status-summary", {
          params: { year, term },
        });

        if (!alive) return;

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        const map = new Map();

        for (const item of items) {
          map.set(String(item.studentId), {
            total: Number(item.total || 0),
            paid: Number(item.paid || 0),
            balance: Number(item.balance || 0),
            status: item.status || "—",
          });
        }

        setStatusMap(map);
      } catch (e) {
        if (!alive) return;
        console.error("status-summary load failed", e);
        setStatusMap(new Map());
      }
    })();

    return () => {
      alive = false;
    };
  }, [students, year, term, selectedStudent?._id]);

  /* ---------------- reset selected student on year change ---------------- */
  useEffect(() => {
    setSelectedStudent(null);
    setPromoteMsg("");
    setAlreadyPromoted(false);
    setClassFilter("All");
    setSearchTerm("");
  }, [year]);

  /* ---------------- fetch students when year changes ---------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log("PAYMENT PAGE LOAD STUDENTS", {
          year,
          at: new Date().toISOString(),
        });

        setErr("");
        setLoading(true);

        const normalized = await fetchStudentsForYear(year);

        console.log("NORMALIZED STUDENTS COUNT", normalized.length);

        if (cancelled) return;
        setStudents(normalized);
      } catch (e) {
        console.error("FAILED TO LOAD STUDENTS");
        console.error("message:", e?.message);
        console.error("status:", e?.response?.status);
        console.error("data:", e?.response?.data);

        if (!cancelled) {
          const status = e?.response?.status;
          const backendMsg =
            e?.response?.data?.message ||
            e?.response?.data?.error;

          setErr(
            status === 503
              ? "Database connection was interrupted. Please try again."
              : backendMsg || e?.message || "Failed to load students."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year]);


  /* ---------------- load local promoted flag ---------------- */
  useEffect(() => {
    if (!selectedStudent?._id) return;
    setAlreadyPromoted(getPromoted(selectedStudent._id, year));
  }, [selectedStudent?._id, year]);

  /* ---------------- chips ---------------- */
  const classChips = useMemo(() => {
    const counts = new Map();

    for (const s of students) {
      const cls = s?.normClass || "Unassigned";
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }

    const chips = CLASS_ORDER.map((name) => ({
      name,
      count: counts.get(name) ?? 0,
    }));

    if ((counts.get("Unassigned") ?? 0) > 0) {
      chips.push({
        name: "Unassigned",
        count: counts.get("Unassigned"),
      });
    }

    return [{ name: "All", count: students.length }, ...chips];
  }, [students]);

  const visibleStudents = useMemo(() => {
    let list = students;

    if (classFilter !== "All") {
      list = list.filter((s) => (s.normClass || "Unassigned") === classFilter);
    }

    const q = searchTerm.trim().toLowerCase();

    if (q) {
      list = list.filter((s) =>
        (`${s.firstName ?? ""} ${s.secondName ?? ""} ${s.name ?? ""}`)
          .toLowerCase()
          .includes(q)
      );
    }

    return list
      .slice()
      .sort(
        (a, b) =>
          String(a.normClass || "").localeCompare(String(b.normClass || "")) ||
          String(a.firstName || a.name || "").localeCompare(
            String(b.firstName || b.name || "")
          )
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

  /* ---------------- promotion helpers ---------------- */
  const selectedInfo = selectedStudent?._id
    ? statusMap.get(selectedStudent._id)
    : null;

  const canRole = canPromoteByRole();
  const isPaid =
    selectedInfo?.status === "PAID" || Number(selectedInfo?.balance || 0) <= 0;
  const isTerm3 = term === "Term3";

  async function handlePromoteSelected() {
    if (!selectedStudent?._id) return;
    setPromoteMsg("");

    if (!canRole) return setPromoteMsg("Only DIRECTOR or SECRETARY can promote.");
    if (!isTerm3) return setPromoteMsg("Promotion is only allowed in Term 3.");
    if (!isPaid) {
      return setPromoteMsg(`Cannot promote: fees not fully paid for ${term} ${year}.`);
    }

    if (alreadyPromoted) {
      return setPromoteMsg(`Already promoted from ${year}.`);
    }

    const name = selectedStudent.firstName
      ? `${selectedStudent.firstName} ${selectedStudent.secondName || ""}`.trim()
      : selectedStudent.name;

    const ok = window.confirm(
      `Promote this student?\n\n${name}\nYear: ${year}\nTerm: ${term}\nStatus: PAID`
    );
    if (!ok) return;

    try {
      setPromoting(true);

      const res = await api.post(`/students/promote-one/${selectedStudent._id}`, {
        fromYear: year,
        term,
      });

      const promoted = Boolean(res.data?.promoted);

      if (!promoted) {
        const note = res.data?.note || "Not promoted.";
        if (/already\s*promoted/i.test(note)) {
          setAlreadyPromoted(true);
          setPromoted(selectedStudent._id, year, true);
        }
        setPromoteMsg(note);
        return;
      }

      const toClass = res.data?.student?.to;
      setPromoteMsg(`✅ Promoted to ${toClass || "next class"}`);

      setAlreadyPromoted(true);
      setPromoted(selectedStudent._id, year, true);

      const normalized = await fetchStudentsForYear(year + 1);
      setStudents(normalized);

      setSelectedStudent((prev) => (prev ? { ...prev } : prev));
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.msg ||
        e?.message ||
        "Promotion failed";
      setPromoteMsg(msg);
    } finally {
      setPromoting(false);
    }
  }

  /* ---------------- callbacks from StudentsPayments ---------------- */
  const handleDemandPersist = useCallback(
    (studentId, demandArr) => {
      saveDemand(studentId, year, term, demandArr);
      refreshOneStatus(studentId);
    },
    [year, term, refreshOneStatus]
  );

  const handlePaymentsChanged = useCallback(
    (studentId) => {
      refreshOneStatus(studentId);
    },
    [refreshOneStatus]
  );

  const promoteDisabled =
    !canRole || !isPaid || !isTerm3 || promoting || alreadyPromoted;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b pb-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <h1 className="text-2xl font-bold">
            Payments — Choose a Student
            <span className="ml-2 text-base font-medium text-gray-600">
              (Total: {students.length})
            </span>
          </h1>

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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setYear(Number.isFinite(v) ? v : today.getFullYear());
                }}
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

        <div className="mt-3 border-t pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex flex-nowrap gap-2 min-w-max">
                {classChips.map((c) => {
                  const active = classFilter === c.name;
                  return (
                    <button
                      key={c.name}
                      onClick={() => {
                        setClassFilter(c.name);
                        setSearchTerm("");
                      }}
                      className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm transition ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
                      }`}
                      title={`${c.name} (${c.count})`}
                    >
                      {c.name}
                      <span
                        className={`ml-2 text-xs ${
                          active ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {c.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-64">
              <input
                type="text"
                placeholder={`Search in ${
                  classFilter === "All" ? "all classes" : classFilter
                }…`}
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
                    <li
                      key={s._id}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        <div className="text-xs text-slate-500">
                          Class: {s.studentclass || s.normClass || "—"}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge s={s} />
                        <button
                          onClick={() => {
                            setSelectedStudent(s);
                            setPromoteMsg("");
                          }}
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
            onClick={() => {
              setSelectedStudent(null);
              setPromoteMsg("");
              setAlreadyPromoted(false);
            }}
            className="mb-3 text-sm text-blue-600 hover:underline"
          >
            ← Back to Students
          </button>

          <div className="mb-3 p-3 rounded-lg border bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm">
              <div className="font-medium">
                Promotion Check: {term} {year}
              </div>
              <div className="text-gray-600">
                Status:{" "}
                <span
                  className={`font-semibold ${
                    isPaid ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {selectedInfo?.status || "—"}
                </span>
                {selectedInfo ? (
                  <>
                    {" "}
                    • Balance:{" "}
                    <span className="font-semibold">
                      KES {Number(selectedInfo.balance || 0).toLocaleString()}
                    </span>
                  </>
                ) : null}
              </div>

              {alreadyPromoted && (
                <div className="text-xs text-green-700 mt-1">
                  ✅ Already promoted from <b>{year}</b>. Button disabled.
                </div>
              )}

              {!alreadyPromoted && !isTerm3 && (
                <div className="text-xs text-gray-600 mt-1">
                  Promotion button is available only in <b>Term 3</b>.
                </div>
              )}

              {!canRole && (
                <div className="text-xs text-red-700 mt-1">
                  Your role cannot promote. (Allowed: DIRECTOR, SECRETARY)
                </div>
              )}
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-1">
              <button
                type="button"
                onClick={handlePromoteSelected}
                disabled={promoteDisabled}
                className="px-4 py-2 rounded text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {alreadyPromoted
                  ? "Already Promoted"
                  : promoting
                  ? "Promoting…"
                  : "Promote Student"}
              </button>

              {promoteMsg && <div className="text-xs text-gray-700">{promoteMsg}</div>}

              {!isPaid && (
                <div className="text-xs text-gray-500">
                  Must clear fees for {term} {year} before promotion.
                </div>
              )}
            </div>
          </div>

          <StudentsPayments
            studentId={selectedStudent._id}
            studentName={
              selectedStudent.firstName
                ? `${selectedStudent.firstName} ${selectedStudent.secondName || ""}`.trim()
                : selectedStudent.name
            }
            year={year}
            term={term}
            initialDemand={getSavedDemand(selectedStudent._id, year, term)}
            onDemandPersist={(demandArr) =>
              handleDemandPersist(selectedStudent._id, demandArr)
            }
            onPaymentsChanged={() => handlePaymentsChanged(selectedStudent._id)}
          />
        </div>
      )}
    </div>
  );
}