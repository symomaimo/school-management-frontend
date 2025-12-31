// src/pages/payment/StudentsPayments.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "../../api/Axios.js";
import { useToast } from "../../components/ui/ToastProvider";

/* ---------------- Date/time helpers ---------------- */
// Show dates in Africa/Nairobi (no more “3:00 AM” surprises)
function formatDateTime(iso) {
  try {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/* ---------------- search helpers (client-side) ---------------- */
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}
function matchPayment(p, q) {
  if (!q) return true;
  const n = norm(q);
  const fields = [
    p.paymentMethod,
    p.category,
    p.receiptNo,
    String(p.amountPaid),
    new Date(p.datePaid).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" }),
  ];
  return fields.some((f) => norm(f).includes(n));
}

/* ---------------- Add Payment Form (with live validation) ---------------- */
function AddPaymentForm({ studentId, year, term, onDone }) {
  const toast = useToast();

  // form state
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [datePaidLocal, setDatePaidLocal] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;
  });
  const [category, setCategory] = useState("FEES");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // "touched" flags for friendly validation UX
  const [tAmount, setTAmount] = useState(false);
  const [tDate, setTDate] = useState(false);

  // validation rules
  const amountNumber = Number(amountPaid);
  const validAmount = Number.isFinite(amountNumber) && amountNumber > 0;

  // datetime-local returns "YYYY-MM-DDTHH:mm" or ""
  const validDate = typeof datePaidLocal === "string" && datePaidLocal.length >= 16;

  const validMethod = ["CASH", "TILL", "PAYBILL", "TOWER SACCO"].includes(paymentMethod);
  const validCategory = ["FEES", "EXTRAS"].includes(category);
  const validProps = Boolean(studentId) && Number.isFinite(Number(year)) && Boolean(term);

  const formValid = validAmount && validDate && validMethod && validCategory && validProps;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!tAmount) setTAmount(true);
    if (!tDate) setTDate(true);
    if (!formValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const datePaidISO = new Date(datePaidLocal).toISOString();

    try {
      setSubmitting(true);
      await api.post("/fees", {
        studentId,
        amountPaid: amountNumber,
        paymentMethod,
        datePaid: datePaidISO,
        year,
        term,
        category,
      });
      toast.success("Payment saved ✅");
      onDone?.();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || e?.message || "Failed to save payment";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputBase = "border rounded px-2 py-2 w-full";
  const invalidCls = "border-red-500 focus:ring-red-500";
  const validCls = "border-gray-300 focus:ring-indigo-500";

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
      {/* Amount */}
      <div className="sm:col-span-1">
        <input
          type="number"
          step="1"
          min="1"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          onBlur={() => setTAmount(true)}
          placeholder="Amount (KES)"
          className={`${inputBase} ${tAmount && !validAmount ? invalidCls : validCls}`}
          aria-invalid={tAmount && !validAmount}
          required
        />
        {tAmount && !validAmount && (
          <div className="text-xs text-red-600 mt-1">Enter an amount greater than 0.</div>
        )}
      </div>

      {/* Method */}
      <div className="sm:col-span-1">
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className={`${inputBase} bg-white ${validMethod ? validCls : invalidCls}`}
          aria-invalid={!validMethod}
          required
        >
          <option value="CASH">CASH</option>
          <option value="M-Pesa">M-Pesa</option>
          <option value="TILL">TILL</option>
          <option value="PAYBILL">PAYBILL</option>
          <option value="TOWER SACCO">TOWER SACCO</option>
        </select>
      </div>

      {/* Date & time */}
      <div className="sm:col-span-1">
        <input
          type="datetime-local"
          value={datePaidLocal}
          onChange={(e) => setDatePaidLocal(e.target.value)}
          onBlur={() => setTDate(true)}
          className={`${inputBase} ${tDate && !validDate ? invalidCls : validCls}`}
          aria-invalid={tDate && !validDate}
          required
        />
        {tDate && !validDate && (
          <div className="text-xs text-red-600 mt-1">Pick the payment date and time.</div>
        )}
      </div>

      {/* Category */}
      <div className="sm:col-span-1">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputBase} bg-white ${validCategory ? validCls : invalidCls}`}
          aria-invalid={!validCategory}
          required
        >
          <option value="FEES">Fees</option>
          <option value="EXTRAS">Extras</option>
        </select>
      </div>

      {/* Submit */}
      <div className="sm:col-span-1">
        <button
          type="submit"
          disabled={!formValid || submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : "Save Payment"}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm sm:col-span-5">{err}</div>}
    </form>
  );
}


/* ---------- Print a receipt window WITH full breakdown ---------- */
async function printReceipt(receiptNo, toast) {
  try {
    const { data } = await api.get(`/fees/receipt-by-number/${receiptNo}`);

    const dateStr = formatDateTime(data.datePaid);

    const due = data.statement?.due || {};
    const tuition = Number(due.tuition || 0);
    const dueExtras = Array.isArray(due.extras) ? due.extras : [];
    const adjustmentsTotal = Number(due.adjustments?.total || 0);

    const totalDue = Number(
      due.total ||
        tuition + dueExtras.reduce((a, x) => a + Number(x.amount || 0), 0) + adjustmentsTotal
    );

    const paidToDate = Number(data.statement?.totalPaidToDate || 0);
    const paidThisReceipt = Number(data.amountPaid || 0);
    const paidBefore = Math.max(0, paidToDate - paidThisReceipt);

    const balanceAfter = Number(data.statement?.balanceAfter || 0);
    const overAfter = Number(data.statement?.overpaymentAfter || 0);

    const css = `
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; color: #111; }
      .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .school { font-size:18px; font-weight:700; }
      .meta { color:#555; font-size:12px; }
      h1 { font-size:20px; margin:16px 0; }
      .row { display:flex; gap:24px; font-size:14px; margin:8px 0; }
      .label { color:#555; min-width:120px; }
      .amount { font-size:18px; font-weight:700; margin-top:8px; }
      .footer { margin-top:32px; font-size:12px; color:#666; }
      hr { border:0; border-top:1px solid #e5e7eb; margin:16px 0; }
      .btn { display:inline-block; margin-top:12px; padding:6px 10px; border:1px solid #ccc; border-radius:6px; }

      table { width:100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
      th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; }
      th { background:#f9fafb; }
      .tr-total td { font-weight:700; }
      .right { text-align:right; }
      .green { color:#166534; }
    `;

    const extrasRowsHtml = dueExtras
      .map(
        (x) => `
      <tr>
        <td>${x.label || x.key}</td>
        <td class="right">${Number(x.amount || 0).toLocaleString()}</td>
      </tr>`
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Receipt ${data.receiptNo}</title>
          <meta charset="utf-8" />
          <style>${css}</style>
        </head>
        <body>
          <div class="head">
            <div>
              <div class="school">${data.school?.name ?? "School"}</div>
              <div class="meta">${data.school?.address ?? ""} • ${data.school?.phone ?? ""}</div>
            </div>
            ${data.school?.logo ? `<img src="${data.school.logo}" alt="logo" height="56" />` : ""}
          </div>

          <h1>Payment Receipt</h1>
          <div class="row"><div class="label">Receipt No</div><div>${data.receiptNo}</div></div>
          <div class="row"><div class="label">Date</div><div>${dateStr}</div></div>
          <div class="row"><div class="label">Student</div><div>${data.student?.name ?? ""}</div></div>
          <div class="row"><div class="label">Class</div><div>${data.student?.class ?? ""}</div></div>
          <div class="row"><div class="label">Year/Term</div><div>${data.year} • ${data.term}</div></div>
          <hr/>
          <div class="row"><div class="label">Payment Method</div><div>${data.paymentMethod}</div></div>
          <div class="row"><div class="label">Category</div><div>${data.appliedTo?.label || data.category || "FEES"}</div></div>
          <div class="amount">${data.currency ?? "KES"} ${paidThisReceipt.toLocaleString()}</div>

          <h2 style="margin-top:24px;">Fee Breakdown</h2>
          <table>
            <thead>
              <tr><th>Item</th><th class="right">Amount (KES)</th></tr>
            </thead>
            <tbody>
              <tr><td>Tuition</td><td class="right">${tuition.toLocaleString()}</td></tr>
              ${extrasRowsHtml}
              <tr><td>Adjustments</td><td class="right">${adjustmentsTotal.toLocaleString()}</td></tr>
              <tr class="tr-total"><td>Total Due for ${data.term} ${data.year}</td><td class="right">${totalDue.toLocaleString()}</td></tr>
            </tbody>
          </table>

          <h2 style="margin-top:16px;">Payments & Balance</h2>
          <table>
            <tbody>
              <tr><td>Paid before this receipt</td><td class="right">${paidBefore.toLocaleString()}</td></tr>
              <tr><td>Paid in this receipt</td><td class="right">${paidThisReceipt.toLocaleString()}</td></tr>
              <tr class="tr-total"><td>Total paid to date</td><td class="right">${paidToDate.toLocaleString()}</td></tr>
              <tr><td>Balance after this receipt</td><td class="right ${overAfter > 0 ? "green" : ""}">${balanceAfter.toLocaleString()}</td></tr>
              ${overAfter > 0 ? `<tr><td>Overpayment</td><td class="right green">${overAfter.toLocaleString()}</td></tr>` : ""}
            </tbody>
          </table>

          <div class="footer">Thank you. This is a system-generated receipt.</div>
          <button class="btn" onclick="window.print()">Print</button>
          <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) {
      toast?.error("Popup blocked — allow popups to view/print the receipt.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch (e) {
    console.error(e);
    toast?.error(e?.response?.data?.message || e?.message || "Failed to load receipt");
  }
}

/* ---------------- Main Page ---------------- */
function StudentsPayments({
  studentId,
  studentName,
  year = 2026,        // default year
  term = "Term1",     // default term
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statement, setStatement] = useState(null);
  const [payments, setPayments] = useState([]);
  const [showPayForm, setShowPayForm] = useState(false);

  // search + pagination state (client-side)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    setError("");
    try {
      setLoading(true);
      const [st, hist] = await Promise.all([
        api.get(`/fees/statement/${studentId}`, { params: { year, term } }),
        api.get(`/fees/by-student/${studentId}`, { params: { year, term } }),
      ]);
      setStatement(st.data);
      setPayments(hist.data?.payments || []);
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || e?.message || "Failed to load payments";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, year, term]);

  // Derived totals
  const tuition = Number(statement?.due?.tuition || 0);
  const extras = Array.isArray(statement?.due?.extras) ? statement.due.extras : [];
  const extrasSum = extras.reduce((a, e) => a + Number(e.amount || 0), 0);
  const adjSum = Number(statement?.due?.adjustments?.total || 0);
  const total = Number(statement?.due?.total || 0);
  const paid = Number(statement?.totalPaid || 0);
  const balance = Number(statement?.balance || 0);
  const over = Number(statement?.overpayment || 0);

  // Compute balance-after for each payment (keep hooks before early returns)
  const balanceMap = useMemo(() => {
    const m = new Map();
    const sorted = [...payments].sort((a, b) => new Date(a.datePaid) - new Date(b.datePaid));
    let remaining = total; // tuition + extras + adjustments
    for (const p of sorted) {
      remaining -= Number(p.amountPaid || 0);
      const balanceAfter = remaining > 0 ? remaining : 0;
      const overAfter = remaining < 0 ? Math.abs(remaining) : 0;
      m.set(p._id, { balanceAfter, overAfter });
    }
    return m;
  }, [payments, total]);

  // ---- search + pagination memos ----
  const filteredSortedPayments = useMemo(() => {
    const list = (payments || []).filter((p) => matchPayment(p, search));
    return list.sort((a, b) => new Date(b.datePaid) - new Date(a.datePaid)); // newest first
  }, [payments, search]);

  const totalRows = filteredSortedPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    setPage(1); // reset to first page when search or pageSize changes
  }, [search, pageSize]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSortedPayments.slice(start, start + pageSize);
  }, [filteredSortedPayments, page, pageSize]);

  // Early returns
  if (loading) return <div>Loading fee info…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!statement) return null;

  return (
    <div className="space-y-4">
      {/* Summary + add payment */}
      <div className="rounded-lg border p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold mb-1">{studentName}</div>
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Tuition</div>
                <div className="font-medium">KES {tuition.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Extras</div>
                <div className="font-medium">KES {extrasSum.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Adjustments</div>
                <div className="font-medium">KES {adjSum.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Due</div>
                <div className="font-medium">KES {total.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Paid</div>
                <div className="font-medium">KES {paid.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Balance</div>
                <div className="font-medium">KES {balance.toLocaleString()}</div>
              </div>
              {over > 0 && (
                <div>
                  <div className="text-gray-500">Overpayment</div>
                  <div className="font-medium text-green-700">KES {over.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowPayForm((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm shrink-0"
          >
            {showPayForm ? "Close Form" : "Add Payment"}
          </button>
        </div>

        {extras.length > 0 && (
          <div className="mt-3">
            <div className="text-gray-600 text-sm mb-1">Extras breakdown</div>
            <ul className="text-sm list-disc ml-5">
              {extras.map((x) => (
                <li key={`${x.key}-${x.term || "all"}`}>
                  {x.label || x.key}: KES {Number(x.amount || 0).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showPayForm && (
          <AddPaymentForm
            studentId={studentId}
            year={year}
            term={term}
            onDone={async () => {
              setShowPayForm(false);
              await load();
            }}
          />
        )}
      </div>

      {/* History (with search + pagination) */}
      <div className="rounded-lg border">
        <div className="px-3 py-2 bg-gray-50 border-b font-medium flex items-center justify-between gap-2">
          <span>Payment History</span>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: receipt, method, category, amount, date…"
              className="border rounded px-2 py-1 text-sm w-56"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm bg-white"
              title="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y">
          {paginatedPayments.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500">
              {search ? "No matching payments." : `No payments found for ${term} ${year}.`}
            </div>
          ) : (
            paginatedPayments.map((p) => {
              const bal = balanceMap.get(p._id);
              return (
                <div key={p._id} className="px-3 py-2 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      KES {Number(p.amountPaid || 0).toLocaleString()}
                    </div>
                    <div className="text-gray-500">
                      {formatDateTime(p.datePaid)} • {p.paymentMethod}
                      {p.category ? ` • ${p.category}` : " • FEES"}
                      {p.receiptNo ? ` • Receipt: ${p.receiptNo}` : ""}
                    </div>
                    {bal && (
                      <div className="text-gray-700 mt-0.5">
                        Balance after: KES {Number(bal.balanceAfter || 0).toLocaleString()}
                        {Number(bal.overAfter || 0) > 0 && (
                          <span className="ml-2 text-green-700">
                            (Overpayment: KES {Number(bal.overAfter).toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {p.receiptNo && (
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => {
                        try {
                          printReceipt(p.receiptNo, toast);
                        } catch (e) {
                          toast.error(e?.message || "Could not open receipt");
                        }
                      }}
                    >
                      Receipt
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination footer */}
        <div className="px-3 py-2 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Showing{" "}
            <span className="font-medium">
              {totalRows === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)}
            </span>{" "}
            of <span className="font-medium">{totalRows}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="border rounded px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-gray-700">
              Page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="border rounded px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentsPayments;
