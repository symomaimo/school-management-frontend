import React, { useEffect, useMemo, useState } from "react";
import { bulkUpsertExtraPrices, listExtraPrices } from "../../api/extraPrices";
import { asNumber, priceId, parsePriceId } from "./_priceHelpers";

const STAGES = [
  { stage: "1_3", label: "Stage 1–3 (Grade 1 to 3)" },
  { stage: "4_6", label: "Stage 4–6 (Grade 4 to 6)" },
  { stage: "7_9", label: "Stage 7–9 (Grade 7 to 9)" },
];

function keyFor(stage, variant) {
  return `TEXTBOOKS_STAGE_${stage}_${variant}`;
}

export default function TextbookPrices() {
  const [yearMode, setYearMode] = useState("GLOBAL"); // GLOBAL -> year=null, YEAR -> year=current
  const [year, setYear] = useState(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({}); // id -> { amount, isActive }

  const effectiveYear = yearMode === "GLOBAL" ? null : year;

  async function load() {
    setLoading(true);
    try {
      const data = await listExtraPrices({});
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const index = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const id = priceId({
        key: r.key,
        classLabel: r.classLabel,
        year: r.year,
        term: r.term,
      });
      m.set(id, r);
    }
    return m;
  }, [rows]);

  function getCell(key) {
    const id = priceId({
      key,
      classLabel: "ALL",
      year: effectiveYear,
      term: null,
    });
    const base = index.get(id) || null;
    const e = edits[id] || {};
    return {
      id,
      amount: e.amount ?? (base ? base.amount : 0),
      isActive: e.isActive ?? (base ? base.isActive : true),
    };
  }

  function setEdit(id, patch) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  async function saveAll() {
    const items = Object.entries(edits).map(([id, v]) => {
      const { key, classLabel, year, term } = parsePriceId(id);
      return {
        key,
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

  // quick helpers: apply same prices to multiple stages
  function applyToAllStages(internalAmount, externalAmount) {
    for (const s of STAGES) {
      const ki = keyFor(s.stage, "INTERNAL");
      const ke = keyFor(s.stage, "EXTERNAL");
      setEdit(getCell(ki).id, { amount: internalAmount, isActive: true });
      setEdit(getCell(ke).id, { amount: externalAmount, isActive: true });
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Textbook Prices (Stage-Based)
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
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          )}

          <button
            onClick={load}
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

      <div className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
        <div className="text-sm font-semibold text-slate-900">Quick Apply</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => applyToAllStages(2500, 5000)}
          >
            Set all stages: Internal 2500 / External 5000
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Prices are saved with classLabel <b>ALL</b> and term <b>Any</b>. Entry
          time is controlled by backend rules.
        </div>
      </div>

      <div className="grid gap-4">
        {STAGES.map((s) => {
          const internalKey = keyFor(s.stage, "INTERNAL");
          const externalKey = keyFor(s.stage, "EXTERNAL");

          const cInt = getCell(internalKey);
          const cExt = getCell(externalKey);

          return (
            <div
              key={s.stage}
              className="rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {s.label}
                </h3>
                <div className="text-xs text-slate-500">
                  year: <b>{effectiveYear ?? "any"}</b>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    INTERNAL (your student entering stage)
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      className="w-40 rounded-md border px-2 py-1"
                      value={cInt.amount}
                      onChange={(e) =>
                        setEdit(cInt.id, { amount: e.target.value })
                      }
                    />
                    <label className="text-sm text-slate-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!cInt.isActive}
                        onChange={(e) =>
                          setEdit(cInt.id, { isActive: e.target.checked })
                        }
                      />
                      Active
                    </label>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {internalKey}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    EXTERNAL (new admission into school)
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      className="w-40 rounded-md border px-2 py-1"
                      value={cExt.amount}
                      onChange={(e) =>
                        setEdit(cExt.id, { amount: e.target.value })
                      }
                    />
                    <label className="text-sm text-slate-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!cExt.isActive}
                        onChange={(e) =>
                          setEdit(cExt.id, { isActive: e.target.checked })
                        }
                      />
                      Active
                    </label>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {externalKey}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
