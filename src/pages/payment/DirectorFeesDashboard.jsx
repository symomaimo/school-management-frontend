// src/pages/payment/DirectorFeesDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/Axios.js";

function guessTermFromMonth(m) {
  if (m <= 3) return "Term1";
  if (m <= 7) return "Term2";
  return "Term3";
}

function money(n) {
  return `KES ${Number(n || 0).toLocaleString()}`;
}

export default function DirectorFeesDashboard() {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [term, setTerm] = useState(guessTermFromMonth(today.getMonth()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/fees/director-dashboard", {
          params: { year, term },
        });

        if (!cancelled) {
          setData(res.data || null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.response?.data?.error ||
              e?.response?.data?.message ||
              e?.message ||
              "Failed to load fees dashboard"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, term]);

  const summary = data?.summary || {};
  const topDefaulters = Array.isArray(data?.topDefaulters) ? data.topDefaulters : [];
  const classBreakdown = Array.isArray(data?.classBreakdown) ? data.classBreakdown : [];

  const cards = useMemo(
    () => [
      { label: "Students", value: summary.studentsCount || 0, tone: "text-slate-900" },
      { label: "Expected", value: money(summary.totalExpected), tone: "text-slate-900" },
      { label: "Collected", value: money(summary.totalCollected), tone: "text-green-700" },
      { label: "Balance", value: money(summary.totalBalance), tone: "text-red-700" },
      { label: "Collection Rate", value: `${summary.collectionRate || 0}%`, tone: "text-blue-700" },
    ],
    [summary]
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b pb-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div>
            <h1 className="text-2xl font-bold">Director Fees Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">
              School-wide fee collection overview for the selected term.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="border rounded-lg px-3 py-2 bg-white text-sm"
            >
              <option value="Term1">Term 1</option>
              <option value="Term2">Term 2</option>
              <option value="Term3">Term 3</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="px-2 py-2 border rounded text-sm"
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
                className="w-24 border rounded-lg px-2 py-2 text-sm text-center"
              />

              <button
                type="button"
                className="px-2 py-2 border rounded text-sm"
                onClick={() => setYear((y) => y + 1)}
                title="Next year"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded mb-3" />
              <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className={`text-2xl font-bold mt-2 ${card.tone}`}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-white shadow-sm mb-6">
            <div className="px-4 py-3 border-b font-semibold">Top Defaulters</div>

            {topDefaulters.length === 0 ? (
              <div className="p-4 text-slate-500">No balances found for this term.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Expected</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDefaulters.map((s) => (
                      <tr key={s.studentId} className="border-t">
                        <td className="px-4 py-3">{s.name || "Unnamed"}</td>
                        <td className="px-4 py-3">{s.classLabel || "—"}</td>
                        <td className="px-4 py-3">{money(s.expected)}</td>
                        <td className="px-4 py-3">{money(s.paid)}</td>
                        <td className="px-4 py-3 font-semibold text-red-700">
                          {money(s.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white shadow-sm mb-6">
            <div className="px-4 py-3 border-b font-semibold">Class Breakdown</div>

            {classBreakdown.length === 0 ? (
              <div className="p-4 text-slate-500">No class data found for this term.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="px-4 py-3">Expected</th>
                      <th className="px-4 py-3">Collected</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classBreakdown.map((c) => (
                      <tr key={c.classLabel} className="border-t">
                        <td className="px-4 py-3">{c.classLabel || "Unassigned"}</td>
                        <td className="px-4 py-3">{c.studentsCount || 0}</td>
                        <td className="px-4 py-3">{money(c.expected)}</td>
                        <td className="px-4 py-3">{money(c.collected)}</td>
                        <td className="px-4 py-3 font-semibold text-red-700">
                          {money(c.balance)}
                        </td>
                        <td className="px-4 py-3">{c.collectionRate || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white shadow-sm">
            <div className="px-4 py-3 border-b font-semibold">Quick Notes</div>
            <div className="p-4 text-sm text-slate-700 space-y-3">
              <div>
                <div className="font-medium">Expected</div>
                <div>Total fees expected for the selected year and term.</div>
              </div>
              <div>
                <div className="font-medium">Collected</div>
                <div>Total payments recorded, excluding voided receipts.</div>
              </div>
              <div>
                <div className="font-medium">Balance</div>
                <div>Remaining unpaid amount for the term.</div>
              </div>
              <div>
                <div className="font-medium">Collection Rate</div>
                <div>Percentage of expected fees already collected.</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}