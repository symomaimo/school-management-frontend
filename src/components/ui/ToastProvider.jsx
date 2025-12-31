import React, { createContext, useContext, useState, useCallback } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((type, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const ttl = opts.duration ?? (type === "error" ? 6000 : 3500);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), ttl);
  }, [remove]);

  const api = {
    success: (m, opts) => push("success", m, opts),
    error:   (m, opts) => push("error", m, opts),
    info:    (m, opts) => push("info", m, opts),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-3 right-3 z-[9999] space-y-2 max-w-sm w-[90vw] sm:w-96">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md shadow px-3 py-2 text-sm text-white flex items-start gap-2
              ${t.type === "success" ? "bg-green-600"
                : t.type === "error" ? "bg-red-600"
                : "bg-slate-700"}`}
          >
            <span className="mt-0.5">
              {t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : "ℹ️"}
            </span>
            <div className="flex-1">{t.message}</div>
            <button className="opacity-80 hover:opacity-100" onClick={() => remove(t.id)}>✖</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
