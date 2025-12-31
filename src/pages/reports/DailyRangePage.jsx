import React, { useState } from "react";
import api from "../../api/Axios";

export default function DailyRangePage() {
  const today = new Date().toISOString().slice(0,10);
  const firstOfMonth = new Date(); firstOfMonth.setDate(1);
  const defaultStart = firstOfMonth.toISOString().slice(0,10);

  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(today);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/fees/daily-range", { params: { start, end } });
      setData(data);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load");
    } finally { setLoading(false); }
  }

  const dayKeys = data?.days ? Object.keys(data.days).sort() : [];

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-600">Start</label>
          <input type="date" value={start} onChange={(e)=>setStart(e.target.value)}
                 className="border rounded px-2 py-1"/>
        </div>
        <div>
          <label className="block text-sm text-gray-600">End</label>
          <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)}
                 className="border rounded px-2 py-1"/>
        </div>
        <button onClick={load} className="h-9 px-3 rounded bg-blue-600 text-white">
          Fetch
        </button>
      </div>

      {err && <div className="text-red-600 mb-2">{err}</div>}
      {loading && <div>Loading…</div>}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{data.school?.name}</div>
              <div className="text-gray-600 text-sm">
                {data.school?.address} • {data.school?.phone}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Range: <span className="font-medium">{data.start}</span> →{" "}
                <span className="font-medium">{data.end}</span>
              </div>
            </div>
            {data.school?.logo && <img src={data.school.logo} alt="logo" className="h-12" />}
          </div>

          {dayKeys.length === 0 ? (
            <div className="text-sm text-gray-600">No payments in this range.</div>
          ) : (
            dayKeys.map((day) => {
              const d = data.days[day];
              return (
                <div key={day} className="border rounded">
                  <div className="px-3 py-2 bg-gray-50 border-b font-medium">{day}</div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2 border-b">Method</th>
                        <th className="text-right p-2 border-b">Count</th>
                        <th className="text-right p-2 border-b">Total ({data.currency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(d.methods || []).map((m) => (
                        <tr key={`${day}-${m.paymentMethod}`} className="border-b">
                          <td className="p-2">{m.paymentMethod}</td>
                          <td className="p-2 text-right">{m.count}</td>
                          <td className="p-2 text-right">{Number(m.total||0).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="p-2 font-semibold">Grand Total</td>
                        <td className="p-2 text-right font-semibold">{d.count}</td>
                        <td className="p-2 text-right font-semibold">
                          {Number(d.grandTotal||0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
