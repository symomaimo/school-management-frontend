// src/pages/payment/StudentsPayments.jsx
// ✅ UPDATED AddPaymentForm (your full code block, with Transport checkbox + dropdown + value-based save)

import React, { useEffect, useMemo, useState, useCallback ,useRef} from "react";
import api from "../../api/Axios.js";
import { useToast } from "../../components/ui/ToastProvider";

/* ---------------- Date/time helpers ---------------- */
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

// input for datetime-local in Nairobi time
function toDateTimeLocalNairobi(iso) {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return "";
  }
}

// convert datetime-local string into ISO (assumes local machine TZ)
function dateTimeLocalToISO(dtLocal) {
  return new Date(dtLocal).toISOString();
}

/* ---------------- Receipt data helper ---------------- */
async function fetchReceiptData(receiptNo) {
  const { data } = await api.get(`/fees/receipt-by-number/${receiptNo}`);

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

  return {
    data,
    dateStr: formatDateTime(data.datePaid),
    tuition,
    dueExtras,
    adjustmentsTotal,
    totalDue,
    paidToDate,
    paidThisReceipt,
    paidBefore,
    balanceAfter,
    overAfter,
  };
}

/* ---------------- auth/role helper ---------------- */
function getUserRoleFromStorage() {
  try {
    const raw = localStorage.getItem("auth:user");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.user?.role || parsed?.role || parsed?.userRole || "").toUpperCase();
  } catch {
    return "";
  }
}

function minutesBetween(aMs, bMs) {
  return Math.floor((bMs - aMs) / 60000);
}

function canEditPayment(role, payment, nowTick, limitMinutes = 10) {
  if (!payment) return false;
  if (role === "DIRECTOR") return true;
  if (role !== "SECRETARY") return false;

  const base = payment.createdAt || payment.datePaid;
  if (!base) return false;

  const paidAt = new Date(base).getTime();
  const mins = minutesBetween(paidAt, nowTick);
  return mins <= limitMinutes;
}

function canDeletePayment(role) {
  return role === "DIRECTOR";
}

function editRemainingText(payment, nowTick, limitMinutes = 10) {
  const base = payment?.createdAt || payment?.datePaid;
  if (!base) return "";
  const end = new Date(base).getTime() + limitMinutes * 60 * 1000;
  const leftMs = end - nowTick;
  if (leftMs <= 0) return "Expired";
  const m = Math.floor(leftMs / 60000);
  const s = Math.floor((leftMs % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------------- demand helpers ---------------- */
function normalizeDemand(arr) {
  const a = Array.isArray(arr) ? arr : [];
  // unique + stable order
  return [...new Set(a.map((x) => String(x).trim()).filter(Boolean))].sort();
}
function demandKey(arr) {
  return normalizeDemand(arr).join("|"); // stable string key
}
function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ---------------- search helpers ---------------- */
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

/* ---------------- Add Payment Form ---------------- */
/* ---------------- Add Payment Form ---------------- */
function AddPaymentForm({
  studentId,
  year,
  term,
  onDone,
  onPreviewApplied,
  demand,
  setDemand,
  onDemandPersist,
  student,
  setStudent,
}) {
  const toast = useToast();

  const TRANSPORT_PLACES = ["TIPIS", "MAU", "GATIMU"];
  const [transportPlace, setTransportPlace] = useState("");
  const transportSelected = Array.isArray(demand) && demand.includes("TRANSPORT");

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

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);

  const [tAmount, setTAmount] = useState(false);
  const [tDate, setTDate] = useState(false);

  const [savingOptIn, setSavingOptIn] = useState("");

const toggleDemand = (key, checked) => {
  setDemand((prev) => {
    const arr = normalizeDemand(prev);
    return checked ? normalizeDemand([...arr, key]) : arr.filter((k) => k !== key);
  });
};

const applyDemandLocally = (key, checked) => {
  setDemand((prev) => {
    const arr = normalizeDemand(prev);
    return checked
      ? normalizeDemand([...arr, key])
      : arr.filter((k) => k !== key);
  });
};

  // hydrate saved transport value from parent student
  useEffect(() => {
    if (!student || !year || !term) return;

    const enr = (student.enrollments || []).find((e) => Number(e.year) === Number(year));
    if (!enr) {
      setTransportPlace("");
      return;
    }

    const holder = enr.termOptIns?.[term];
    if (!holder) {
      setTransportPlace("");
      return;
    }

    const v =
      typeof holder.get === "function"
        ? holder.get("TRANSPORT")
        : holder?.TRANSPORT;

  if (typeof v === "string" && v.trim()) {
  const place = v.trim().toUpperCase();
  if (TRANSPORT_PLACES.includes(place)) {
    setTransportPlace(place);
  } else {
    setTransportPlace("");
  }
} else {
  setTransportPlace("");
}
  }, [student, year, term]);

  const toggleTermOptIn = async (key, checked) => {
    const K = String(key).toUpperCase();
    setSavingOptIn(K);

    try {
      // TRANSPORT:
      // when checked -> only enable dropdown locally first
      // actual save happens when user chooses place
      if (K === "TRANSPORT") {
        if (!checked) {
          const resp = await api.patch(`/students/${studentId}/term-optin`, {
            year,
            term,
            key: "TRANSPORT",
            enabled: false,
          });

          setTransportPlace("");
          applyDemandLocally("TRANSPORT", false);
          setStudent?.(resp?.data?.student || null);
        } else {
          setDemand((prev) => {
            const arr = normalizeDemand(prev);
            return arr.includes("TRANSPORT") ? arr : normalizeDemand([...arr, "TRANSPORT"]);
          });
        }

        return;
      }

      // normal boolean extras: save first, then update UI
      const resp = await api.patch(`/students/${studentId}/term-optin`, {
        year,
        term,
        key: K,
        enabled: checked,
      });

      applyDemandLocally(K, checked);
      setStudent?.(resp?.data?.student || null);
    } catch (e) {
      toast?.error?.(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Failed to save option"
      );
    } finally {
      setSavingOptIn("");
    }
  };

  const changeTransportPlace = async (place) => {
    const p = String(place || "").trim().toUpperCase();
    const prevPlace = transportPlace;

    setTransportPlace(p);
    setSavingOptIn("TRANSPORT");

    if (!p) {
      setSavingOptIn("");
      return;
    }

    try {
      const resp = await api.patch(`/students/${studentId}/term-optin`, {
        year,
        term,
        key: "TRANSPORT",
        enabled: true,
        value: p,
      });

      applyDemandLocally("TRANSPORT", true);
      setStudent?.(resp?.data?.student || null);
    } catch (e) {
      setTransportPlace(prevPlace);
      toast?.error?.(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Failed to save transport place"
      );
    } finally {
      setSavingOptIn("");
    }
  };

  const amountNumber = Number(amountPaid);
  const validAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const validDate = typeof datePaidLocal === "string" && datePaidLocal.length >= 16;

  const validMethod = ["CASH", "M-PESA", "TILL", "PAYBILL", "TOWER SACCO", "M-Pesa"].includes(
    String(paymentMethod)
  );

  const validCategory = ["FEES", "EXTRAS"].includes(category);
  const validProps = Boolean(studentId) && Number.isFinite(Number(year)) && Boolean(term);

  const formValid = validAmount && validDate && validMethod && validCategory && validProps;

  async function handlePreview() {
    if (!validProps) {
      toast.error("Missing student/year/term.");
      return;
    }

    if (transportSelected && !String(transportPlace || "").trim()) {
      toast.error("Select transport place before preview.");
      return;
    }

    setPreviewing(true);
    setPreview(null);

    try {
      const r = await api.get(`/fees/statement/${studentId}`, {
        params: { year, term, demand: normalizeDemand(demand).join(",") },
      });

      setPreview(r.data || null);
      onPreviewApplied?.(r.data || null);
      toast.success("Preview loaded ✅");
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Failed to preview due");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!tAmount) setTAmount(true);
    if (!tDate) setTDate(true);

    if (!formValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    if (transportSelected && !String(transportPlace || "").trim()) {
      toast.error("Select transport place (TIPIS / MAU / GATIMU).");
      return;
    }

    const datePaidISO = dateTimeLocalToISO(datePaidLocal);

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
        demand: normalizeDemand(demand),
      });

      toast.success("Payment saved ✅");
      onDone?.();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Failed to save payment";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Preview numbers
  const pDue = preview?.due || null;
  const pTuition = Number(pDue?.tuition || 0);
  const pExtras = Array.isArray(pDue?.extras) ? pDue.extras : [];
  const pAdj = Number(pDue?.adjustments?.total || 0);
  const pTotal = Number(
    pDue?.total ||
      pTuition + pExtras.reduce((a, x) => a + Number(x.amount || 0), 0) + pAdj
  );
  const pPaid = Number(preview?.totalPaid || 0);
  const pBal = preview?.balance != null ? Number(preview.balance) : Math.max(0, pTotal - pPaid);

  return (
    <>
      {/* Optional items */}
      <div className="mt-3 rounded-lg border p-3 bg-slate-50">
        <div className="text-sm font-semibold text-slate-800 mb-2">
          Optional Items (only if selected)
        </div>

        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("FEEDING_TERMLY")}
              disabled={savingOptIn === "FEEDING_TERMLY"}
              onChange={(e) => toggleTermOptIn("FEEDING_TERMLY", e.target.checked)}
            />
            Feeding (Termly)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("DAMAGE")}
              disabled={savingOptIn === "DAMAGE"}
              onChange={(e) => toggleTermOptIn("DAMAGE", e.target.checked)}
            />
            Damage
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("MEDICAL")}
              disabled={savingOptIn === "MEDICAL"}
              onChange={(e) => toggleTermOptIn("MEDICAL", e.target.checked)}
            />
            Medical
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("TOUR")}
              disabled={savingOptIn === "TOUR"}
              onChange={(e) => toggleTermOptIn("TOUR", e.target.checked)}
            />
            Tour
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("TEXTBOOKS_ON_DEMAND")}
              disabled={savingOptIn === "TEXTBOOKS_ON_DEMAND"}
              onChange={(e) => toggleTermOptIn("TEXTBOOKS_ON_DEMAND", e.target.checked)}
            />
            Extra Textbooks (On demand)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("SET_BOOKS_G7_9")}
              disabled={savingOptIn === "SET_BOOKS_G7_9"}
              onChange={(e) => toggleTermOptIn("SET_BOOKS_G7_9", e.target.checked)}
            />
            Set Books (Grade 7–9)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("LOSTBOOKS")}
              disabled={savingOptIn === "LOSTBOOKS"}
              onChange={(e) => toggleTermOptIn("LOSTBOOKS", e.target.checked)}
            />
            Lost books (On demand)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={normalizeDemand(demand).includes("REAMS")}
              disabled={savingOptIn === "REAMS"}
              onChange={(e) => toggleTermOptIn("REAMS", e.target.checked)}
            />
            REAMS (Grade 7–9 )
          </label>

          {/* ✅ TRANSPORT */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transportSelected}
                disabled={savingOptIn === "TRANSPORT"}
                onChange={(e) => toggleTermOptIn("TRANSPORT", e.target.checked)}
              />
              Transport (On demand)
            </label>

            <select
              className={`border rounded px-2 py-1 text-sm w-44 ${
                transportSelected && !transportPlace ? "border-red-400" : ""
              }`}
              value={transportPlace}
              onChange={(e) => changeTransportPlace(e.target.value)}
              disabled={!transportSelected || savingOptIn === "TRANSPORT"}
            >
              <option value="">Select place…</option>
              {TRANSPORT_PLACES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {transportSelected && !transportPlace && (
              <span className="text-[11px] text-red-600">
                Choose TIPIS / MAU / GATIMU
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 text-xs text-slate-500">
          Selected:{" "}
          <span className="font-medium">
            {normalizeDemand(demand).length ? normalizeDemand(demand).join(", ") : "None"}
          </span>
        </div>
      </div>

      {/* Preview panel */}
      <div className="mt-3 rounded-lg border p-3 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-800">Preview Due</div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing || !validProps}
            className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {previewing ? "Loading…" : "Preview"}
          </button>
        </div>

        {!preview ? (
          <div className="text-xs text-slate-500 mt-2">
            Click <b>Preview</b> to apply the selected optional items to the totals above.
            {transportSelected && !transportPlace && (
              <span className="block text-red-600 mt-1">
                Select a transport place first.
              </span>
            )}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
            <div>
              <div className="text-slate-500 text-xs">Tuition</div>
              <div className="font-medium">KES {pTuition.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Extras</div>
              <div className="font-medium">
                KES {pExtras.reduce((a, x) => a + Number(x.amount || 0), 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Adjustments</div>
              <div className="font-medium">KES {pAdj.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Total Due</div>
              <div className="font-medium">KES {pTotal.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Balance</div>
              <div className="font-medium">KES {pBal.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Payment form */}
      <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
        <div className="sm:col-span-1">
          <input
            type="number"
            step="1"
            min="1"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            onBlur={() => setTAmount(true)}
            placeholder="Amount (KES)"
            className={`border rounded px-2 py-2 w-full ${
              tAmount && !validAmount ? "border-red-500" : "border-gray-300"
            }`}
            required
          />
          {tAmount && !validAmount && (
            <div className="text-xs text-red-600 mt-1">Enter an amount greater than 0.</div>
          )}
        </div>

        <div className="sm:col-span-1">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="border rounded px-2 py-2 w-full bg-white border-gray-300"
            required
          >
            <option value="CASH">CASH</option>
            <option value="M-Pesa">M-Pesa</option>
            <option value="TILL">TILL</option>
            <option value="PAYBILL">PAYBILL</option>
            <option value="TOWER SACCO">TOWER SACCO</option>
          </select>
        </div>

        <div className="sm:col-span-1">
          <input
            type="datetime-local"
            value={datePaidLocal}
            onChange={(e) => setDatePaidLocal(e.target.value)}
            onBlur={() => setTDate(true)}
            className={`border rounded px-2 py-2 w-full ${
              tDate && !validDate ? "border-red-500" : "border-gray-300"
            }`}
            required
          />
          {tDate && !validDate && (
            <div className="text-xs text-red-600 mt-1">Pick the payment date and time.</div>
          )}
        </div>

        <div className="sm:col-span-1">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded px-2 py-2 w-full bg-white border-gray-300"
            required
          >
            <option value="FEES">Fees</option>
            <option value="EXTRAS">Extras</option>
          </select>
        </div>

        <div className="sm:col-span-1">
          <button
            type="submit"
            disabled={!formValid || submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 w-full disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Payment"}
          </button>
        </div>

        {err && <div className="text-red-600 text-sm sm:col-span-5">{err}</div>}
      </form>
    </>
  );
}

/* ---------- Print receipt: A4 (Office/Director) ---------- */
async function printReceiptA4(receiptNo, toast) {
  try {
    const {
      data,
      dateStr,
      tuition,
      dueExtras,
      adjustmentsTotal,
      totalDue,
      paidToDate,
      paidThisReceipt,
      paidBefore,
      balanceAfter,
      overAfter,
    } = await fetchReceiptData(receiptNo);

    const css = `
      @page { size: A4; margin: 12mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }

      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 0; color: #111; }
      .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .school { font-size:18px; font-weight:700; }
      .meta { color:#555; font-size:12px; }
      h1 { font-size:20px; margin:16px 0; }
      .row { display:flex; gap:24px; font-size:14px; margin:8px 0; }
      .label { color:#555; min-width:120px; }
      .amount { font-size:18px; font-weight:700; margin-top:8px; }
      .footer { margin-top:24px; font-size:12px; color:#666; }
      hr { border:0; border-top:1px solid #e5e7eb; margin:16px 0; }
      table { width:100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
      th, td { border:1px solid #e5e7eb; padding:8px; text-align:left; }
      th { background:#f9fafb; }
      .tr-total td { font-weight:700; }
      .right { text-align:right; }
      .green { color:#166534; }
    `;

    const extrasRowsHtml = (Array.isArray(dueExtras) ? dueExtras : [])
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
          <title>Receipt ${data.receiptNo} (A4)</title>
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

          <h1>Payment Receipt (Office Copy)</h1>
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

          <div class="footer">Office copy • System-generated receipt.</div>
          <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return toast?.error("Popup blocked — allow popups to view/print the receipt.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch (e) {
    toast?.error(e?.response?.data?.message || e?.message || "Failed to load receipt");
  }
}
/* =========================
   THERMAL (80mm) RECEIPT — FINAL STABLE VERSION (XP-Q38L)
   ========================= */

/* ---------- Key -> short label ---------- */
const RECEIPT_LABELS = {
  ADMISSION_FEE: "Admission Fee",
  ADMISSION_FEE_PREPRIMARY: "Admission (Pre-Primary)",
  ADMISSION_FEE_G1_3: "Admission (G1–G3)",
  ADMISSION_FEE_G4_6: "Admission (G4–G6)",
  ADMISSION_FEE_G7_9: "Admission (G7–G9)",

  ASSESSMENT_BOOK: "Assessment Book",
  TRACKSUIT_ONBOARD: "Tracksuit (Onboard)",
  TRACKSUIT_ENTER_G7: "Tracksuit (Enter G7)",
  LOCKER_G7_9: "Locker (G7–G9)",

  GRAD_PP2_T3: "PP2 Graduation (T3)",
  REAMS_G7_9_T2: "Reams (G7–G9 T1)",

  FEEDING_TERMLY: "Feeding (Term)",
  DAMAGE: "Damage",
  MEDICAL: "Medical",
  TOUR: "Tour",
  SET_BOOKS_G7_9: "Set Books (G7–G9)",
  LOSTBOOKS: "Lost Books",

  TEXTBOOKS_ONBOARD: "Textbooks (Onboard)",
  TEXTBOOKS_ON_DEMAND: "Textbooks (On demand)",

  TEXTBOOKS_STAGE_1_3_INTERNAL: "Books S1–3 (Int)",
  TEXTBOOKS_STAGE_1_3_EXTERNAL: "Books S1–3 (Ext)",
  TEXTBOOKS_STAGE_4_6_INTERNAL: "Books S4–6 (Int)",
  TEXTBOOKS_STAGE_4_6_EXTERNAL: "Books S4–6 (Ext)",
  TEXTBOOKS_STAGE_7_9_INTERNAL: "Books S7–9 (Int)",
  TEXTBOOKS_STAGE_7_9_EXTERNAL: "Books S7–9 (Ext)",
};

function receiptLabelForExtra(x) {
  const key = String(x?.key || "").toUpperCase();
  const raw = String(x?.label || x?.name || x?.key || "").trim();
  return RECEIPT_LABELS[key] || raw || key || "Extra";
}

/* ---------- Print window helper (prints only after load) ---------- */
function openPrintWindow(html, title = "Receipt") {
  const w = window.open("", "_blank", "width=420,height=900");
  if (!w) return null;

  w.document.open();
  w.document.write(html);
  w.document.close();

  try { w.document.title = title; } catch {}

  w.onload = () => {
    w.focus();
    w.print();
    w.onafterprint = () => w.close();
  };

  return w;
}

/* ---------- Thermal printing ---------- */
async function printReceipt80mm(receiptNo, toast) {
  try {
    const {
      data,
      dateStr,
      tuition,
      dueExtras,
      adjustmentsTotal,
      totalDue,
      paidToDate,
      paidThisReceipt,
      paidBefore,
      balanceAfter,
      overAfter,
    } = await fetchReceiptData(receiptNo);

    // Default columns for XP 80mm
    let COLS = 42;

    const clean = (s) =>
      String(s ?? "")
        .replace(/\s+/g, " ")
        .trim();

    const escHtml = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const money = (n) => Number(n || 0).toLocaleString("en-KE");

    const trunc = (s, n = COLS) => {
      s = clean(s);
      return s.length > n ? s.slice(0, n) : s;
    };

    const hr = (ch = "-") => ch.repeat(COLS);

    const center = (txt) => {
      txt = clean(txt);
      if (!txt) return "";
      if (txt.length >= COLS) return txt.slice(0, COLS);
      const left = Math.floor((COLS - txt.length) / 2);
      return " ".repeat(left) + txt;
    };

    const wrapFixed = (txt, width) => {
      txt = clean(txt);
      if (!txt) return [""];
      const out = [];
      let i = 0;
      while (i < txt.length) {
        out.push(txt.slice(i, i + width));
        i += width;
      }
      return out;
    };

    // amount aligned right; label wraps; amount only on final line
    const itemLine = (label, amount) => {
      const amt = money(amount);
      const amtCol = Math.max(amt.length, 8);
      const leftW = COLS - amtCol - 1;
      const parts = wrapFixed(label, leftW);

      return parts
        .map((p, idx) => {
          if (idx < parts.length - 1) return p;
          return p.padEnd(leftW, " ") + " " + amt;
        })
        .join("\n");
    };

    // Build receipt items (skip zeros)
    const items = [
      { label: "Tuition", amount: tuition },
      ...(Array.isArray(dueExtras) ? dueExtras : []).map((x) => ({
        label: receiptLabelForExtra(x),
        amount: Number(x?.amount || 0),
      })),
      { label: "Adjustments", amount: adjustmentsTotal },
    ].filter((it) => Number(it.amount || 0) !== 0);

    // --- AUTO-TUNE: if any raw line would exceed COLS, reduce COLS to 40 ---
    // This is to handle edge cases where driver font is wider.
    const maxAmtLen = Math.max(
      8,
      ...items.map((it) => String(money(it.amount)).length),
      String(money(totalDue)).length
    );
    // label area when amount uses maxAmtLen
    const safeLeftW42 = 42 - maxAmtLen - 1;
    const safeLeftW40 = 40 - maxAmtLen - 1;

    if (safeLeftW42 < 18) COLS = 40; // if amounts too wide, reduce cols
    // (COLS change affects all helper funcs via closure, so update hr/center trunc widths)
    // Re-define dependent fns after COLS change:
    const trunc2 = (s, n = COLS) => (clean(s).length > n ? clean(s).slice(0, n) : clean(s));
    const hr2 = (ch = "-") => ch.repeat(COLS);
    const center2 = (txt) => {
      txt = clean(txt);
      if (!txt) return "";
      if (txt.length >= COLS) return txt.slice(0, COLS);
      const left = Math.floor((COLS - txt.length) / 2);
      return " ".repeat(left) + txt;
    };
    const itemLine2 = (label, amount) => {
      const amt = money(amount);
      const amtCol = Math.max(amt.length, 8);
      const leftW = COLS - amtCol - 1;
      const parts = wrapFixed(label, leftW);
      return parts
        .map((p, idx) => {
          if (idx < parts.length - 1) return p;
          return p.padEnd(leftW, " ") + " " + amt;
        })
        .join("\n");
    };

    const schoolName = clean(data.school?.name || "School");
    const schoolAddr = clean(data.school?.address || "");
    const schoolPhone = clean(data.school?.phone || "");

    const studentName = clean(data.student?.name || "");
    const className = clean(data.student?.class || "");

    const method = clean(data.paymentMethod || "");
    const category = clean(data.appliedTo?.label || data.category || "FEES");

    const lines = [];

    // Header
    lines.push(center2(schoolName));
    if (schoolAddr) lines.push(center2(schoolAddr));
    if (schoolPhone) lines.push(center2(`Tel: ${schoolPhone}`));
    lines.push(hr2("="));

    // Meta (wrap student/category to avoid overflow)
    lines.push(trunc2(`RECEIPT: ${clean(data.receiptNo)}`));
    lines.push(trunc2(`DATE:    ${dateStr}`));
    wrapFixed(`STUDENT: ${studentName}`, COLS).forEach((l) => lines.push(trunc2(l)));
    lines.push(trunc2(`CLASS:   ${className}`));
    lines.push(trunc2(`TERM:    ${clean(data.term)} ${clean(data.year)}`));

    lines.push(hr2("-"));
    lines.push(trunc2(`METHOD:  ${method}`));
    wrapFixed(`FOR:     ${category}`, COLS).forEach((l) => lines.push(trunc2(l)));

    lines.push(hr2("-"));
    lines.push(center2("FEE BREAKDOWN"));

    items.forEach((it) => {
      itemLine2(it.label, it.amount)
        .split("\n")
        .forEach((l) => lines.push(trunc2(l)));
    });

    lines.push(hr2("-"));
    itemLine2(`TOTAL DUE (${clean(data.term)} ${clean(data.year)})`, totalDue)
      .split("\n")
      .forEach((l) => lines.push(trunc2(l)));

    lines.push(hr2("-"));
    itemLine2("PAID BEFORE", paidBefore).split("\n").forEach((l) => lines.push(trunc2(l)));
    itemLine2("PAID NOW", paidThisReceipt).split("\n").forEach((l) => lines.push(trunc2(l)));
    itemLine2("TOTAL PAID", paidToDate).split("\n").forEach((l) => lines.push(trunc2(l)));

    lines.push(hr2("-"));
    itemLine2("BALANCE", balanceAfter).split("\n").forEach((l) => lines.push(trunc2(l)));
    if (overAfter > 0) {
      itemLine2("OVERPAYMENT", overAfter).split("\n").forEach((l) => lines.push(trunc2(l)));
    }

    lines.push(hr2("="));
    lines.push(center2("Thank you"));
    lines.push(center2("System Generated"));

    // Final safety: absolutely no line longer than COLS
    const receiptText = lines.map((l) => (l.length > COLS ? l.slice(0, COLS) : l)).join("\n");

    const css = `
      @page { size: 80mm auto; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body {
        width: 72mm;      /* printable width */
        padding: 4mm;     /* safe padding */
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        line-height: 1.18;
        color: #111;
      }
      pre {
        margin: 0;
        white-space: pre; /* critical: browser MUST NOT wrap */
      }
    `;

    const html = `
      <html>
        <head>
          <title>Receipt ${escHtml(clean(data.receiptNo))} (80mm)</title>
          <meta charset="utf-8" />
          <style>${css}</style>
        </head>
        <body>
          <pre>${escHtml(receiptText)}</pre>
        </body>
      </html>
    `;

    const w = openPrintWindow(html, `Receipt ${clean(data.receiptNo)}`);
    if (!w) return toast?.error("Popup blocked — allow popups to view/print the receipt.");
  } catch (e) {
    toast?.error(e?.response?.data?.message || e?.message || "Failed to load receipt");
  }
}


/* ---------------- Main Page ---------------- */
export default function StudentsPayments({
  studentId,
  studentName,
  year = 2026,
  term = "Term1",
  initialDemand = [],
  onDemandPersist,
  onPaymentsChanged,
}) {
  const toast = useToast();

  // ✅ MUST be before early returns (hooks rule)
  const role = useMemo(() => getUserRoleFromStorage(), []);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15 * 1000);
    return () => clearInterval(t);
  }, []);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statement, setStatement] = useState(null);
  const [payments, setPayments] = useState([]);
  const [showPayForm, setShowPayForm] = useState(false);

  // demand state (internal)
  const [demand, setDemand] = useState(() => normalizeDemand(initialDemand));
  const [liveStatement, setLiveStatement] = useState(null);
  const [previewApplied, setPreviewApplied] = useState(false);

  // stable keys (IMPORTANT)
  const initialDemandKey = useMemo(() => demandKey(initialDemand), [initialDemand]);
  const demandKeyState = useMemo(() => demandKey(demand), [demand]);
  const appliedKey = previewApplied ? demandKeyState : "BASE";

  // edit modal state
  const [edit, setEdit] = useState({
    open: false,
    payment: null,
    amountPaid: "",
    paymentMethod: "CASH",
    datePaidLocal: "",
    category: "FEES",
    saving: false,
  });

  // search + pagination state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

// ✅ sync demand from props ONLY when content changes
useEffect(() => {
  const next = normalizeDemand(initialDemand);

  setDemand((prev) => {
    const p = normalizeDemand(prev);
    return arraysEqual(p, next) ? prev : next;
  });

  // reset preview only when the identity really changes
  setLiveStatement(null);
  setPreviewApplied(false);

  // allow fresh loads for a new student/year/term/initial demand
  lastBaseLoadedRef.current = "";
  lastPreviewLoadedRef.current = "";

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [studentId, year, term, initialDemandKey]);

const baseReqRef = useRef(new Set());
const previewReqRef = useRef(new Set());

// remembers the last successfully requested base identity
const lastBaseLoadedRef = useRef("");

// remembers the last successfully requested preview identity
const lastPreviewLoadedRef = useRef("");

const loadBase = useCallback(
  async ({ force = false } = {}) => {
    if (!studentId) return;

    const key = `${studentId}-${year}-${term}`;

    // already loaded for this exact identity
    if (!force && lastBaseLoadedRef.current === key) {
      console.log("SKIP already loaded loadBase", { key });
      return;
    }

    // same request is currently in flight
    if (baseReqRef.current.has(key)) {
      console.log("SKIP in-flight loadBase", { key });
      return;
    }

    baseReqRef.current.add(key);
    lastBaseLoadedRef.current = key;

    console.log("LOAD BASE StudentsPayments", {
      studentId,
      year,
      term,
      force,
      at: new Date().toISOString(),
    });

    setError("");
    setLoading(true);

    try {
      const [stRes, payRes] = await Promise.all([
        api.get(`/fees/statement/${studentId}`, {
          params: { year, term },
        }),
        api.get(`/fees/by-student/${studentId}`, {
          params: { year, term },
        }),
      ]);

      console.log("STATEMENT RESPONSE", stRes.data);
      console.log("PAYMENTS RESPONSE", payRes.data);

      setStatement(stRes.data || null);
      setPayments(Array.isArray(payRes.data?.payments) ? payRes.data.payments : []);
    } catch (e) {
      // allow retry after failure
      lastBaseLoadedRef.current = "";

      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to load payments";

      console.error("loadBase failed", {
        message: e?.message,
        code: e?.code,
        status: e?.response?.status,
        data: e?.response?.data,
      });

      setError(msg);
      toast.error(msg);
    } finally {
      baseReqRef.current.delete(key);
      setLoading(false);
    }
  },
  [studentId, year, term]
);

useEffect(() => {
  if (!studentId) return;

  console.log("EFFECT -> loadBase()", {
    studentId,
    year,
    term,
    at: new Date().toISOString(),
  });

  loadBase();
}, [studentId, year, term, loadBase]);

const loadAppliedPreview = useCallback(
  async ({ force = false } = {}) => {
    if (!studentId || appliedKey === "BASE") {
      setLiveStatement(null);
      return;
    }

    const demandList = normalizeDemand(demand);
    const key = `${studentId}-${year}-${term}-${appliedKey}-${demandList.join(",")}`;

    // already loaded for this exact preview identity
    if (!force && lastPreviewLoadedRef.current === key) {
      console.log("SKIP already loaded preview", { key });
      return;
    }

    // same preview request is currently in flight
    if (previewReqRef.current.has(key)) {
      console.log("SKIP in-flight preview", { key });
      return;
    }

    previewReqRef.current.add(key);
    lastPreviewLoadedRef.current = key;

    console.log("LOAD APPLIED PREVIEW", {
      studentId,
      year,
      term,
      demand: demandList,
      appliedKey,
      force,
      at: new Date().toISOString(),
    });

    try {
      const appliedRes = await api.get(`/fees/statement/${studentId}`, {
        params: {
          year,
          term,
          demand: demandList.join(","),
        },
      });

      setLiveStatement(appliedRes.data || null);
    } catch (e) {
      // allow retry after failure
      lastPreviewLoadedRef.current = "";

      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Failed to preview due";

      console.error("loadAppliedPreview failed", {
        message: e?.message,
        code: e?.code,
        status: e?.response?.status,
        data: e?.response?.data,
      });

      toast.error(msg);
    } finally {
      previewReqRef.current.delete(key);
    }
  },
  [studentId, year, term, appliedKey, demand]
);

useEffect(() => {
  if (normalizeDemand(demand).length === 0 && previewApplied) {
    setPreviewApplied(false);
    setLiveStatement(null);
    lastPreviewLoadedRef.current = "";
  }
}, [demand, previewApplied]);

useEffect(() => {
  if (!studentId) return;

  console.log("EFFECT -> preview", {
    studentId,
    year,
    term,
    appliedKey,
    demand: normalizeDemand(demand),
    at: new Date().toISOString(),
  });

  if (appliedKey === "BASE") {
    setLiveStatement(null);
    lastPreviewLoadedRef.current = "";
    return;
  }

  loadAppliedPreview();
}, [studentId, year, term, appliedKey, demand, loadAppliedPreview]);

// ---- edit modal handlers ----
function openEditModal(p) {
  setEdit({
    open: true,
    payment: p,
    amountPaid: String(p.amountPaid ?? ""),
    paymentMethod: p.paymentMethod || "CASH",
    datePaidLocal: toDateTimeLocalNairobi(p.datePaid),
    category: p.category || "FEES",
    saving: false,
  });
}

function closeEditModal() {
  setEdit((x) => ({ ...x, open: false, payment: null, saving: false }));
}

async function saveEdit() {
  const p = edit.payment;
  if (!p?._id) return;

  const amount = Number(edit.amountPaid);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast.error("Enter a valid amount.");
    return;
  }

  if (!edit.datePaidLocal || edit.datePaidLocal.length < 16) {
    toast.error("Pick a valid date/time.");
    return;
  }

  // re-check permission at the moment of saving
  if (!canEditPayment(role, p, nowTick, 10)) {
    toast.error("Edit time expired for this payment.");
    closeEditModal();
    return;
  }

  try {
    setEdit((x) => ({ ...x, saving: true }));

    await api.patch(`/fees/${p._id}/edit`, {
      amountPaid: amount,
      paymentMethod: edit.paymentMethod,
      datePaid: dateTimeLocalToISO(edit.datePaidLocal),
      category: edit.category,
    });

    toast.success("Payment updated ✅");
    closeEditModal();

    // force real refresh after save
    await loadBase({ force: true });

    if (appliedKey !== "BASE") {
      await loadAppliedPreview({ force: true });
    } else {
      setLiveStatement(null);
    }

    onPaymentsChanged?.();
  } catch (e) {
    toast.error(e?.response?.data?.message || e?.message || "Failed to update payment");
    setEdit((x) => ({ ...x, saving: false }));
  }
}

const displayStatement = liveStatement || statement;

// totals
const tuition = Number(displayStatement?.due?.tuition || 0);
const extras = Array.isArray(displayStatement?.due?.extras) ? displayStatement.due.extras : [];
const extrasSum = extras.reduce((a, e) => a + Number(e.amount || 0), 0);
const adjSum = Number(displayStatement?.due?.adjustments?.total || 0);
const total = Number(displayStatement?.due?.total || 0);
const paid = Number(displayStatement?.totalPaid || 0);
const balance = Number(displayStatement?.balance || 0);
const over = Number(displayStatement?.overpayment || 0);

const balanceMap = useMemo(() => {
  const m = new Map();
  const sorted = [...(payments || [])].sort((a, b) => new Date(a.datePaid) - new Date(b.datePaid));
  let remaining = total;

  for (const p of sorted) {
    remaining -= Number(p.amountPaid || 0);
    const balanceAfter = remaining > 0 ? remaining : 0;
    const overAfter = remaining < 0 ? Math.abs(remaining) : 0;
    m.set(p._id, { balanceAfter, overAfter });
  }

  return m;
}, [payments, total]);

const filteredSortedPayments = useMemo(() => {
  const list = (payments || []).filter((p) => matchPayment(p, search));
  return list.sort((a, b) => new Date(b.datePaid) - new Date(a.datePaid));
}, [payments, search]);

const totalRows = filteredSortedPayments.length;
const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

useEffect(() => setPage(1), [search, pageSize]);

const paginatedPayments = useMemo(() => {
  const startIdx = (page - 1) * pageSize;
  return filteredSortedPayments.slice(startIdx, startIdx + pageSize);
}, [filteredSortedPayments, page, pageSize]);

// Early returns
if (loading) return <div>Loading fee info…</div>;
if (error) return <div className="text-red-600">{error}</div>;
if (!displayStatement) return null;

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

            {extras.length > 0 && (
              <div className="mt-3">
                <div className="text-gray-600 text-sm mb-1">Extras breakdown</div>
                <ul className="text-sm list-disc ml-5">
                  {extras.map((x, i) => (
                    <li key={`${x.key}-${x.term || "all"}-${i}`}>
                      {x.label || x.key}: KES {Number(x.amount || 0).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {normalizeDemand(demand).length > 0 && (
              <div className="mt-2 text-xs text-slate-600">
                Optional selected: <b>{normalizeDemand(demand).join(", ")}</b>{" "}
                {previewApplied ? "(applied ✅)" : "(click Preview to apply)"}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setShowPayForm((v) => !v)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm"
            >
              {showPayForm ? "Close Form" : "Add Payment"}
            </button>

            {previewApplied && (
              <button
                onClick={() => {
                  setPreviewApplied(false);
                  setLiveStatement(null);
                }}
                className="border rounded px-4 py-2 text-sm"
              >
                Clear Preview
              </button>
            )}
          </div>
        </div>

        {showPayForm && (
          <AddPaymentForm
            studentId={studentId}
            year={year}
            term={term}
            demand={demand}
            student={student}
            setDemand={(updater) => {
              if (typeof updater === "function") {
                setDemand((prev) => {
                  const next = normalizeDemand(updater(prev));
                  onDemandPersist?.(next);
                  return next;
                });
              } else {
                const next = normalizeDemand(updater);
                setDemand(next);
                onDemandPersist?.(next);
              }
            }}
            onDemandPersist={(next) => onDemandPersist?.(normalizeDemand(next))}
            onPreviewApplied={(st) => {
              setLiveStatement(st);
              setPreviewApplied(true);
            }}
           onDone={async () => {
  setShowPayForm(false);
  await loadBase();
  if (appliedKey !== "BASE") await loadAppliedPreview();
  onPaymentsChanged?.();
}}
          />
        )}
      </div>

      {/* History */}
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

        <div className="divide-y">
          {paginatedPayments.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500">
              {search ? "No matching payments." : `No payments found for ${term} ${year}.`}
            </div>
          ) : (
            paginatedPayments.map((p) => {
              const bal = balanceMap.get(p._id);
              const canEdit = canEditPayment(role, p, nowTick, 10);

              return (
                <div key={p._id} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">KES {Number(p.amountPaid || 0).toLocaleString()}</div>
                    <div className="text-gray-500 truncate">
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

  <div className="flex items-center gap-3 shrink-0">
  {p.receiptNo && (
    <>
      {/* Parent Copy - everyone */}
      <button
        className="text-green-600 hover:underline text-sm"
        onClick={() => printReceipt80mm(p.receiptNo, toast)}
      >
        Parent Copy
      </button>

      {/* Office Copy - Director only */}
      {role === "DIRECTOR" && (
        <button
          className="text-blue-600 hover:underline text-sm"
          onClick={() => printReceiptA4(p.receiptNo, toast)}
        >
          Office Copy
        </button>
      )}
    </>
  )}
                    {/* EDIT */}
                    {canEdit && (
                      <button
                        className="text-amber-700 hover:underline"
                        onClick={() => openEditModal(p)}
                        title={
                          role === "SECRETARY"
                            ? `Edit allowed for 10 minutes. Remaining: ${editRemainingText(p, nowTick, 10)}`
                            : "Edit payment"
                        }
                      >
                        Edit
                        {role === "SECRETARY" && (
                          <span className="ml-2 text-xs text-slate-500">
                            ({editRemainingText(p, nowTick, 10)})
                          </span>
                        )}
                      </button>
                    )}

                    {/* DELETE */}
                    {canDeletePayment(role) && (
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => voidPayment(p._id)}
                        title="Delete (void) this payment"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

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

      {/* ---------- Edit Modal ---------- */}
      {edit.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow p-4 w-[95vw] max-w-xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                Edit Payment{" "}
                {role === "SECRETARY" && (
                  <span className="text-xs text-slate-500">
                    (Time left: {editRemainingText(edit.payment, nowTick, 10)})
                  </span>
                )}
              </div>
              <button className="border rounded px-3 py-1 text-sm" onClick={closeEditModal}>
                Close
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600">Amount (KES)</label>
                <input
                  type="number"
                  min="1"
                  value={edit.amountPaid}
                  onChange={(e) => setEdit((x) => ({ ...x, amountPaid: e.target.value }))}
                  className="border rounded px-2 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Method</label>
                <select
                  value={edit.paymentMethod}
                  onChange={(e) => setEdit((x) => ({ ...x, paymentMethod: e.target.value }))}
                  className="border rounded px-2 py-2 w-full bg-white"
                >
                  <option value="CASH">CASH</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="TILL">TILL</option>
                  <option value="PAYBILL">PAYBILL</option>
                  <option value="TOWER SACCO">TOWER SACCO</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600">Date/Time</label>
                <input
                  type="datetime-local"
                  value={edit.datePaidLocal}
                  onChange={(e) => setEdit((x) => ({ ...x, datePaidLocal: e.target.value }))}
                  className="border rounded px-2 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600">Category</label>
                <select
                  value={edit.category}
                  onChange={(e) => setEdit((x) => ({ ...x, category: e.target.value }))}
                  className="border rounded px-2 py-2 w-full bg-white"
                >
                  <option value="FEES">Fees</option>
                  <option value="EXTRAS">Extras</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="border rounded px-4 py-2" onClick={closeEditModal}>
                Cancel
              </button>
              <button
                className="bg-amber-600 hover:bg-amber-700 text-white rounded px-4 py-2 disabled:opacity-50"
                disabled={edit.saving}
                onClick={saveEdit}
              >
                {edit.saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
