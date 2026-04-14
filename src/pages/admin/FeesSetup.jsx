import React, { useEffect, useMemo, useState } from "react";
import { bulkUpsertExtraPrices, listExtraPrices } from "../../api/extraPrices";
import { asNumber, priceId, parsePriceId } from "./_priceHelpers";

const FIXED_KEYS = [
  // Admission / Onboarding (banded admission fee)
  { group: "Admission / Onboarding", key: "ADMISSION_FEE_PREPRIMARY", term: null },
  { group: "Admission / Onboarding", key: "ADMISSION_FEE_G1_3", term: null },
  { group: "Admission / Onboarding", key: "ADMISSION_FEE_G4_6", term: null },
  { group: "Admission / Onboarding", key: "ADMISSION_FEE_G7_9", term: null },

  // Assessment books (if applicable)
  { group: "Admission / Onboarding", key: "ASSESSMENT_BOOK", term: null },
  { group: "Admission / Onboarding", key: "TRACKSUIT_ONBOARD", term: null },

  // Feeding (termly only)
  { group: "Feeding Program", key: "FEEDING_TERMLY", term: null },

  // JSS entry
  { group: "JSS Entry", key: "LOCKER_G7_9", term: null },
  { group: "JSS Entry", key: "TRACKSUIT_ENTER_G7", term: null },

  // Fixed term items
  { group: "Fixed Term Items", key: "REAMS_G7_9_T1", term: "Term1" },
  { group: "Fixed Term Items", key: "GRAD_PP2_T3", term: "Term3" },

  // On-demand prices
  { group: "On-demand Items", key: "DAMAGE", term: null },
  { group: "On-demand Items", key: "MEDICAL", term: null },
  { group: "On-demand Items", key: "TOUR", term: null },
  { group: "On-demand Items", key: "SET_BOOKS_G7_9", term: null },
  { group: "On-demand Items", key: "TEXTBOOKS_ON_DEMAND", term: null },
  { group: "On-demand Items", key: "LOSTBOOKS", term: null },
  { group: "On-demand Items", key: "REAM", term: null },

  // ✅ TRANSPORT (3 routes / variants)
  { group: "On-demand Items", key: "TRANSPORT", variant: "TIPIS", term: null },
  { group: "On-demand Items", key: "TRANSPORT", variant: "MAU", term: null },
  { group: "On-demand Items", key: "TRANSPORT", variant: "GATIMU", term: null },
];

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

const prettyKey = (k) => {
  const map = {
    ADMISSION_FEE_PREPRIMARY: "Admission Fee (Playgroup–PP2)",
    ADMISSION_FEE_G1_3: "Admission Fee (Grade 1–3)",
    ADMISSION_FEE_G4_6: "Admission Fee (Grade 4–6)",
    ADMISSION_FEE_G7_9: "Admission Fee (Grade 7–9)",
    ASSESSMENT_BOOK: "Assessment Book (New Admission)",
    TRACKSUIT_ONBOARD: "Tracksuit (New Admission)",
    FEEDING_TERMLY: "Feeding Program (Termly, Opt-in)",
    LOCKER_G7_9: "Locker (Grade 7–9 entry)",
    TRACKSUIT_ENTER_G7: "Tracksuit (Enter Grade 7)",
    REAMS_G7_9_T2: "Reams (Grade 7–9, Term 2)",
    GRAD_PP2_T3: "Graduation (PP2, Term 3)",
    DAMAGE: "Damage (On-demand)",
    MEDICAL: "Medical (On-demand)",
    TOUR: "Tour (On-demand)",
    SET_BOOKS_G7_9: "Set Books (Grade 7–9, On-demand)",
    TEXTBOOKS_ON_DEMAND: "Extra Textbooks (On-demand)",
    LOSTBOOKS: "Lost Books (On-demand)",
    REAM: "Ream (On-demand)",
    TRANSPORT: "Transport (On-demand)",
  };
  return map[k] || k;
};

const prettyItemName = (it) => {
  if (it.key === "TRANSPORT") return `Transport (${it.variant})`;
  return prettyKey(it.key);
};

const LS_KEY = "feesSetup:modeYear";

export default function FeesSetup() {
  const [yearMode, setYearMode] = useState("GLOBAL"); // GLOBAL -> year=null, YEAR -> year=current
  const [year, setYear] = useState(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({}); // id -> { amount, isActive }

  // ✅ load saved mode/year
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.yearMode) setYearMode(parsed.yearMode);
      if (Number.isFinite(Number(parsed?.year))) setYear(Number(parsed.year));
    } catch {}
  }, []);

  // ✅ persist mode/year
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ yearMode, year }));
    } catch {}
  }, [yearMode, year]);

  const effectiveYear = yearMode === "GLOBAL" ? null : year;

  async function load(opts = {}) {
    setLoading(true);
    try {
      // ✅ IMPORTANT: load only relevant year rows
      const data = await listExtraPrices({
        year: effectiveYear,
        classLabel: "ALL",
        ...opts,
      });
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Reload when yearMode/year changes
  useEffect(() => {
    setEdits({});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYear]);

  const index = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const id = priceId({
        key: r.key,
        variant: r.variant ?? null, // ✅ include variant
        classLabel: r.classLabel,
        year: r.year,
        term: r.term,
      });
      m.set(id, r);
    }
    return m;
  }, [rows]);

  function getCell(key, term, variant = null) {
    const id = priceId({
      key,
      variant: variant ?? null, // ✅ include variant
      classLabel: "ALL",
      year: effectiveYear,
      term,
    });

    const base = index.get(id) || null;
    const e = edits[id] || {};
    return {
      id,
      amount: e.amount ?? (base ? base.amount : 0),
      isActive: e.isActive ?? (base ? base.isActive : true),
      exists: !!base,
    };
  }

  function setEdit(id, patch) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  async function saveAll() {
    const items = Object.entries(edits).map(([id, v]) => {
      const { key, variant, classLabel, year, term } = parsePriceId(id); // ✅ variant
      return {
        key,
        variant: variant ?? null, // ✅ send variant (null for normal)
        classLabel,
        year,
        term,
        amount: asNumber(v.amount),
        isActive: v.isActive ?? true,
      };
    });

    if (!items.length) return;

    setLoading(true);
    try {
      await bulkUpsertExtraPrices(items);
      setEdits({});
      await load();
      alert("Saved ✅");
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(() => groupBy(FIXED_KEYS, (x) => x.group), []);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Fees & Extras (Prices)
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border px-2 py-1"
            value={yearMode}
            onChange={(e) => setYearMode(e.target.value)}
          >
            <option value="GLOBAL">Global (all years)</option>
            <option value="YEAR">Specific year</option>
          </select>

          {yearMode === "YEAR" && (
            <input
              className="rounded-md border px-2 py-1 w-28"
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          )}

          <button
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            Refresh
          </button>

          <button
            onClick={saveAll}
            disabled={loading || !Object.keys(edits).length}
            className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            Save Changes ({Object.keys(edits).length})
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500 mb-3">Loading…</div>}

      <div className="grid gap-4">
        {[...groups.entries()].map(([groupName, items]) => (
          <div key={groupName} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{groupName}</h3>
              <div className="text-xs text-slate-500">
                classLabel: <b>ALL</b> • year: <b>{effectiveYear ?? "any"}</b>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2">Item</th>
                    <th className="py-2">Term</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Active</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it) => {
                    const cell = getCell(it.key, it.term, it.variant ?? null);
                    return (
                      <tr
                        key={`${it.key}-${it.variant ?? "base"}-${it.term ?? "any"}`}
                        className="border-t"
                      >
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-800">
                            {prettyItemName(it)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {it.key}
                            {it.variant ? ` • ${it.variant}` : ""}
                          </div>
                        </td>

                        <td className="py-2 pr-3 text-sm text-slate-600">
                          {it.term ?? "Any"}
                        </td>

                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            className="w-36 rounded-md border px-2 py-1"
                            value={cell.amount}
                            onChange={(e) => setEdit(cell.id, { amount: e.target.value })}
                          />
                        </td>

                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={!!cell.isActive}
                            onChange={(e) => setEdit(cell.id, { isActive: e.target.checked })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-2 text-xs text-slate-500">
                Fixed term items (like REAMS Term1) are locked to that term. Others apply any term.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
