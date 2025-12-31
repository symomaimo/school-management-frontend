// src/pages/payment/DailyPage.jsx
import React, { useEffect, useState } from "react";
import api from "../../api/Axios";
import { useToast } from "../../components/ui/ToastProvider";

/* ------- helpers ------- */
function fmtKE(dt) {
  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(dt));
  } catch {
    return "";
  }
}

function toCsv(rows) {
  const headers = ["Receipt","Student","Class","Method","Amount","Date","Year","Term","Category"];
  const lines = rows.map(r => [
    r.receiptNo || "",
    r.student?.name || "",
    r.student?.class || "",
    r.paymentMethod || "",
    Number(r.amountPaid || 0),
    fmtKE(r.datePaid),
    r.year || "",
    r.term || "",
    r.category || "FEES",
  ].map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(","));
  return [headers.join(","), ...lines].join("\n");
}

// minimal printable receipt opener (reuses JSON -> builds print HTML)
async function openReceipt(receiptNo, toast) {
  try {
    const { data } = await api.get(`/fees/receipt-by-number/${receiptNo}`);
    const dateStr = fmtKE(data.datePaid);

    const due = data.statement?.due || {};
    const tuition = Number(due.tuition || 0);
    const extras = Array.isArray(due.extras) ? due.extras : [];
    const adj = Number(due.adjustments?.total || 0);
    const totalDue = Number(due.total || (tuition + extras.reduce((a,x)=>a+Number(x.amount||0),0) + adj));

    const paidToDate = Number(data.statement?.totalPaidToDate || 0);
    const paidThis = Number(data.amountPaid || 0);
    const paidBefore = Math.max(0, paidToDate - paidThis);
    const balanceAfter = Number(data.statement?.balanceAfter || 0);
    const overAfter = Number(data.statement?.overpaymentAfter || 0);

    const extrasRows = extras.map(
      x => `<tr><td>${x.label || x.key}</td><td style="text-align:right">${Number(x.amount||0).toLocaleString()}</td></tr>`
    ).join("");

    const html = `
      <html><head><meta charset="utf-8"/>
      <title>Receipt ${data.receiptNo}</title>
      <style>
        body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:24px;}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .school{font-size:18px;font-weight:700}.meta{color:#555;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        th{background:#f9fafb}.right{text-align:right}.tr-total td{font-weight:700}
      </style></head><body>
      <div class="head">
        <div>
          <div class="school">${data.school?.name ?? "School"}</div>
          <div class="meta">${data.school?.address ?? ""} • ${data.school?.phone ?? ""}</div>
        </div>
        ${data.school?.logo ? `<img src="${data.school.logo}" height="56"/>` : ""}
      </div>
      <h2>Payment Receipt</h2>
      <p><b>Receipt:</b> ${data.receiptNo}<br/>
      <b>Date:</b> ${dateStr}<br/>
      <b>Student:</b> ${data.student?.name ?? ""} • <b>Class:</b> ${data.student?.class ?? ""}<br/>
      <b>Year/Term:</b> ${data.year} • ${data.term}<br/>
      <b>Method:</b> ${data.paymentMethod} • <b>Category:</b> ${data.appliedTo?.label || data.category || "FEES"}</p>
      <h3>Fee Breakdown</h3>
      <table>
        <thead><tr><th>Item</th><th class="right">Amount (KES)</th></tr></thead>
        <tbody>
          <tr><td>Tuition</td><td class="right">${tuition.toLocaleString()}</td></tr>
          ${extrasRows}
          <tr><td>Adjustments</td><td class="right">${adj.toLocaleString()}</td></tr>
          <tr class="tr-total"><td>Total Due</td><td class="right">${totalDue.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <h3>Payments & Balance</h3>
      <table><tbody>
        <tr><td>Paid before this receipt</td><td class="right">${paidBefore.toLocaleString()}</td></tr>
        <tr><td>Paid in this receipt</td><td class="right">${paidThis.toLocaleString()}</td></tr>
        <tr class="tr-total"><td>Total paid to date</td><td class="right">${paidToDate.toLocaleString()}</td></tr>
        <tr><td>Balance after</td><td class="right">${balanceAfter.toLocaleString()}</td></tr>
        ${overAfter>0 ? `<tr><td>Overpayment</td><td class="right">${overAfter.toLocaleString()}</td></tr>` : ""}
      </tbody></table>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
      </body></html>
    `;
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return toast.error("Popup blocked — allow popups to view/print the receipt.");
    w.document.open(); w.document.write(html); w.document.close();
  } catch (e) {
    toast.error(e?.response?.data?.message || e?.message || "Failed to open receipt");
  }
}

export default function DailyPage() {
  const toast = useToast();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  // drilldown modal state
  const [drill, setDrill] = useState({
    open: false,
    method: "ALL",
    rows: [],
    total: 0,
    loading: false,
  });

  async function load(d) {
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.get("/fees/daily", { params: { date: d } });
      setData(data);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(date); /* initial */ }, []); // eslint-disable-line

  async function openDrill(method = "ALL") {
    setDrill({ open: true, method, rows: [], total: 0, loading: true });
    try {
      const { data: details } = await api.get("/fees/daily/details", {
        params: { date, method },
      });
      setDrill({
        open: true,
        method: details.method || method,
        rows: details.payments || [],
        total: Number(details.total || 0),
        loading: false,
      });
    } catch (e) {
      setDrill(d => ({ ...d, loading: false }));
      toast.error(e?.response?.data?.error || e?.message || "Failed to load details");
    }
  }

  function downloadCsv() {
    const csv = toCsv(drill.rows || []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-${date}-${drill.method}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e)=>setDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button
          onClick={()=>load(date)}
          className="h-9 px-3 rounded bg-blue-600 text-white"
        >Fetch</button>

        {/* quick "view all" for the day */}
        {!!data && (
          <button
            onClick={()=>openDrill("ALL")}
            className="h-9 px-3 rounded border"
            title="Show all methods for this day"
          >
            View all payments
          </button>
        )}
      </div>

      {err && <div className="text-red-600 mb-2">{err}</div>}
      {loading && <div>Loading…</div>}

      {!loading && data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{data.school?.name}</div>
              <div className="text-gray-600 text-sm">
                {data.school?.address} • {data.school?.phone}
              </div>
            </div>
            {data.school?.logo && (
              <img src={data.school.logo} alt="logo" className="h-12" />
            )}
          </div>

          <div className="text-sm text-gray-600">
            Date: <span className="font-medium">{data.date}</span>
          </div>

          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border-b">Method</th>
                  <th className="text-right p-2 border-b">Count</th>
                  <th className="text-right p-2 border-b">Total ({data.currency})</th>
                </tr>
              </thead>
              <tbody>
                {(data.methods || []).map((m)=>(
                  <tr key={m.paymentMethod} className="border-b">
                    <td className="p-2">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={()=>openDrill(m.paymentMethod)}
                        title={`View all ${m.paymentMethod} payments`}
                      >
                        {m.paymentMethod}
                      </button>
                    </td>
                    <td className="p-2 text-right">{m.count}</td>
                    <td className="p-2 text-right">{Number(m.total||0).toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td className="p-2 font-semibold">Grand Total</td>
                  <td className="p-2 text-right font-semibold">{data.count}</td>
                  <td className="p-2 text-right font-semibold">
                    {Number(data.grandTotal||0).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drilldown modal */}
      {drill.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow p-4 w-[95vw] max-w-5xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {drill.method === "ALL" ? "All methods" : drill.method} • {date}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadCsv} className="border rounded px-3 py-1 text-sm">
                  Export CSV
                </button>
                <button onClick={()=>setDrill(d=>({...d,open:false}))} className="border rounded px-3 py-1 text-sm">
                  Close
                </button>
              </div>
            </div>

            <div className="mt-3">
              {drill.loading ? (
                <div className="text-sm text-gray-600">Loading…</div>
              ) : drill.rows.length === 0 ? (
                <div className="text-sm text-gray-600">No payments found.</div>
              ) : (
                <div className="overflow-auto max-h-[70vh]">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border px-2 py-1 text-left">Receipt</th>
                        <th className="border px-2 py-1 text-left">Student</th>
                        <th className="border px-2 py-1 text-left">Class</th>
                        <th className="border px-2 py-1 text-left">Method</th>
                        <th className="border px-2 py-1 text-right">Amount</th>
                        <th className="border px-2 py-1 text-left">Date/Time</th>
                        <th className="border px-2 py-1 text-left">Year/Term</th>
                        <th className="border px-2 py-1 text-left">Category</th>
                        <th className="border px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {drill.rows.map(r => (
                        <tr key={r._id} className="hover:bg-gray-50">
                          <td className="border px-2 py-1">{r.receiptNo}</td>
                          <td className="border px-2 py-1">{r.student?.name}</td>
                          <td className="border px-2 py-1">{r.student?.class}</td>
                          <td className="border px-2 py-1">{r.paymentMethod}</td>
                          <td className="border px-2 py-1 text-right">{Number(r.amountPaid).toLocaleString()}</td>
                          <td className="border px-2 py-1">{fmtKE(r.datePaid)}</td>
                          <td className="border px-2 py-1">{r.year} • {r.term}</td>
                          <td className="border px-2 py-1">{r.category || "FEES"}</td>
                          <td className="border px-2 py-1">
                            {r.receiptNo && (
                              <button
                                className="text-blue-600 hover:underline"
                                onClick={()=>openReceipt(r.receiptNo, toast)}
                              >
                                Receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="border px-2 py-1" colSpan={4}>Total</td>
                        <td className="border px-2 py-1 text-right">
                          KES {Number(drill.total).toLocaleString()}
                        </td>
                        <td className="border px-2 py-1" colSpan={4}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
