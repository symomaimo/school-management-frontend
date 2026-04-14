import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../api/Axios";

export default function TermSummary({ defaultYear = 2026, defaultTerm = "Term1" }) {
  const [year, setYear] = useState(defaultYear);
  const [term, setTerm] = useState(defaultTerm);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const reqIdRef = useRef(0);

  async function load(y = year, t = term) {
    const reqId = ++reqIdRef.current;
    setErr("");
    setLoading(true);
    try {
      const res = await api.get("/fees/term-summary", { params: { year: y, term: t } });
      if (reqId !== reqIdRef.current) return;
      setData(res.data);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setErr(e?.response?.data?.error || e?.message || "Failed to load");
      setData(null);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  // Re-fetch when year/term changes OR when we navigate back to this page
  useEffect(() => {
    if (!year || !term) return;
    load(year, term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, term, location.key]);

  // Also re-fetch when tab/window refocus
  useEffect(() => {
    const onFocus = () => load(year, term);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, term]);

  // ✅ ADD THESE (you were missing them)
  const pct = Number(data?.percent || 0);
  const expected = Number(data?.totalExpected || 0);
  const received = Number(data?.totalReceived || 0);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-600">Year</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2000}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Term</label>
          <select
            className="border rounded px-2 py-1"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          >
            <option value="Term1">Term1</option>
            <option value="Term2">Term2</option>
            <option value="Term3">Term3</option>
          </select>
        </div>

        <button
          onClick={() => load(year, term)}
          className="h-9 px-3 rounded bg-blue-600 text-white"
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err && <div className="text-red-600 mb-2">{err}</div>}
      {loading && <div>Loading…</div>}

      {!loading && data && (
        <div className="border rounded p-4">
          <div className="font-semibold mb-1">
            {data.school?.name} — {term} {year}
          </div>

          <div className="text-sm text-gray-600 mb-3">
            Active students: {data.studentsCount?.toLocaleString()} • Receipts:{" "}
            {data.receiptsCount?.toLocaleString()}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <div className="text-gray-500">Total Expected</div>
              <div className="font-medium">
                {data.currency} {expected.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Total Received</div>
              <div className="font-medium">
                {data.currency} {received.toLocaleString()}
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Collection progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
              <div className="h-full bg-green-600" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>

          {data.notes && <div className="text-xs text-amber-700 mt-2">{data.notes}</div>}
        </div>
      )}
    </div>
  );
}
