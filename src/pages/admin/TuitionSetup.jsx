import React, { useEffect, useMemo, useState } from "react";
import { bulkUpsertClassFees, listClassFees } from "../../api/classesApi";

const CLASS_LABELS = [
  "Playgroup", "PP1", "PP2",
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9"
];

const TERMS = ["Term1", "Term2", "Term3"];

const asNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function TuitionSetup() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState("Term1");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({}); // classLabel -> fees string/number

  async function load() {
    setLoading(true);
    try {
      const data = await listClassFees({ year, term });
      setRows(Array.isArray(data) ? data : []);
      setEdits({}); // reset edits when switching year/term
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [year, term]);

  const index = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      // backend uses "studentclass" field
      m.set(r.studentclass, r);
    }
    return m;
  }, [rows]);

  function getFeeFor(cls) {
    if (edits[cls] != null) return edits[cls];
    const row = index.get(cls);
    return row ? row.fees : 0;
  }

  function setFee(cls, value) {
    setEdits((prev) => ({ ...prev, [cls]: value }));
  }

  async function saveAll() {
    const items = CLASS_LABELS.map((cls) => ({
      studentclass: cls,
      year,
      term,
      fees: asNumber(getFeeFor(cls)),
    }));

    setLoading(true);
    try {
      await bulkUpsertClassFees(items);
      await load();
      alert("Tuition saved ✅");
    } finally {
      setLoading(false);
    }
  }

  async function applyPreset() {
    // Your given tuition bands:
    // playgroup–pp2: 2000
    // grade1–3: 3500
    // grade4–6: 4200
    // grade7–9: 7000
    const preset = {};
    for (const cls of CLASS_LABELS) {
      if (["Playgroup", "PP1", "PP2"].includes(cls)) preset[cls] = 2000;
      else if (["Grade 1","Grade 2","Grade 3"].includes(cls)) preset[cls] = 3500;
      else if (["Grade 4","Grade 5","Grade 6"].includes(cls)) preset[cls] = 4200;
      else if (["Grade 7","Grade 8","Grade 9"].includes(cls)) preset[cls] = 7000;
      else preset[cls] = 0;
    }
    setEdits((prev) => ({ ...preset, ...prev }));
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Tuition Fees Setup
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Year</span>
            <input
              className="rounded-md border px-2 py-1 w-28"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Term</span>
            <select
              className="rounded-md border px-2 py-1"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            >
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button
            onClick={applyPreset}
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Apply Preset Bands
          </button>

          <button
            onClick={saveAll}
            disabled={loading}
            className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            Save Tuition
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500 mb-3">Loading…</div>}

      <div className="rounded-2xl border bg-white p-4 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-2">Class</th>
              <th className="py-2">Fees</th>
            </tr>
          </thead>
          <tbody>
            {CLASS_LABELS.map((cls) => (
              <tr key={cls} className="border-t">
                <td className="py-2 pr-3 font-medium text-slate-800">{cls}</td>
                <td className="py-2">
                  <input
                    type="number"
                    className="w-40 rounded-md border px-2 py-1"
                    value={getFeeFor(cls)}
                    onChange={(e) => setFee(cls, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 text-xs text-slate-500">
          Saves to <b>/classes/bulk</b> for the selected year + term.
        </div>
      </div>
    </div>
  );
}
