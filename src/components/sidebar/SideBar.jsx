import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import SmartBackButton from "../nav/SmartBackButton.jsx";

function navClasses(isActive) {
  return [
    "flex items-center gap-2 rounded-lg px-3 py-2 transition",
    isActive ? "bg-white text-slate-900 shadow-sm"
             : "text-slate-200 hover:bg-white/10 hover:text-white"
  ].join(" ");
}

export default function SideBar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isDirector = user?.role === "DIRECTOR";

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Back (mobile) */}
          <SmartBackButton
            fallback="/payment"
            className="rounded-md p-2 text-slate-200 hover:bg-white/10"
            aria-label="Go back"
            title="Go back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14 7l-5 5l5 5V7z"/>
            </svg>
          </SmartBackButton>

          <h1 className="text-sm font-semibold text-white truncate">
            School Management System
          </h1>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-slate-200 hover:bg-white/10"
          aria-label="Toggle menu"
          title="Toggle menu"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24">
            <path fill="currentColor" d="M3 7h18v2H3zm0 4h18v2H3zm0 4h18v2H3"/>
          </svg>
        </button>
      </div>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Sidebar"
        className={[
          "fixed left-3 top-3 lg:left-3 lg:top-3",
          "z-50 lg:z-40",
          "w-64 h-[90vh] lg:h-[calc(100vh-1.5rem)]",
          "rounded-2xl overflow-hidden",
          "bg-gradient-to-b from-slate-800 to-slate-900",
          "shadow-lg ring-1 ring-slate-700/30",
          "grid grid-rows-[auto,1fr,auto]",
          "transition-transform",
          open ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0"
        ].join(" ")}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-slate-900/80 shadow ring-1 ring-white/10 flex items-center gap-1">
          {/* Back (desktop) */}
          <SmartBackButton
            fallback="/payment"
            className="rounded-md p-2 text-slate-200 hover:bg-white/10"
            aria-label="Go back"
            title="Go back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14 7l-5 5l5 5V7z"/>
            </svg>
          </SmartBackButton>

          <h1 className="ml-1 text-[12px] font-semibold leading-tight text-slate-100 truncate">
            School Management System
          </h1>
        </div>

        {/* Nav */}
        <nav className="p-3 overflow-y-auto space-y-1">
          <NavLink to="/" className={({isActive}) => navClasses(isActive)} onClick={() => setOpen(false)}>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M13 8V4q0-.425.288-.712T14 3h6q.425 0 .713.288T21 4v4q0 .425-.288.713T20 9h-6q-.425 0-.712-.288T13 8M3 12V4q0-.425.288-.712T4 3h6q.425 0 .713.288T11 4v8q0 .425-.288.713T10 13H4q-.425 0-.712-.288T3 12m10 8v-8q0-.425.288-.712T14 11h6q.425 0 .713.288T21 12v8q0 .425-.288.713T20 21h-6q-.425 0-.712-.288T13 20M3 20v-4q0-.425.288-.712T4 15h6q.425 0 .713.288T11 16v4q0 .425-.288.713T10 21H4q-.425 0-.712-.288T3 20"/>
            </svg>
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/students" className={({isActive}) => navClasses(isActive)} onClick={() => setOpen(false)}>
            <svg className="h-5 w-5" viewBox="0 0 256 256">
              <path fill="currentColor" d="m225.9 58.31l-96-32a6 6 0 0 0-3.8 0l-96 32A6 6 0 0 0 26 64v80a6 6 0 0 0 12 0V72.32l38.68 12.9A62 62 0 0 0 99 174.75c-19.25 6.53-36 19.59-48 38a6 6 0 0 0 10 6.53C76.47 195.59 100.88 182 128 182s51.53 13.59 67 37.28a6 6 0 0 0 10-6.56c-12-18.38-28.73-31.44-48-38a62 62 0 0 0 22.27-89.53l46.63-15.5a6 6 0 0 0 0-11.38M178 120a50 50 0 1 1-89.37-30.8l37.47 12.49a6 6 0 0 0 3.8 0l37.47-12.49A49.78 49.78 0 0 1 178 120m-50-30.32L51 64l77-25.68L205 64Z"/>
            </svg>
            <span>Students</span>
          </NavLink>

          <NavLink to="/payment" className={({isActive}) => navClasses(isActive)} onClick={() => setOpen(false)}>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M4.308 18.616q-.667 0-1.141-.475q-.475-.475-.475-1.141V8.692q0-.212.144-.356t.357-.144t.356.144t.143.356V17q0 .23.192.423q.193.193.424.193h13.538q.213 0 .356.143q.144.144.144.357t-.144.356t-.356.144z"/>
            </svg>
            <span>Payment</span>
          </NavLink>

          {/* Director-only */}
          {isDirector && (
            <>
              <div className="pt-3 pb-1 text-[11px] uppercase tracking-wide text-slate-400">
                Director Reports
              </div>

              <NavLink
                to="/reports/daily"
                className={({isActive}) => navClasses(isActive)}
                onClick={() => setOpen(false)}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M3 5h18v2H3zm0 4h10v2H3zm0 4h14v2H3zm0 4h18v2H3z"/>
                </svg>
                <span>Daily Totals</span>
              </NavLink>

              <NavLink
                to="/reports/daily-range"
                className={({isActive}) => navClasses(isActive)}
                onClick={() => setOpen(false)}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5 4h14v2H5zm0 14h14v2H5zM7 8h10v2H7zm0 4h6v2H7z"/>
                </svg>
                <span>Daily Range</span>
              </NavLink>

              <NavLink
                to="/reports/term-summary"
                className={({isActive}) => navClasses(isActive)}
                onClick={() => setOpen(false)}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z"/>
                </svg>
                <span>Term Summary</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <NavLink to="/settings" className={({isActive}) => navClasses(isActive)} onClick={() => setOpen(false)}>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12.563 3.2h-1.126l-.645 2.578l-.647.2a6.3 6.3 0 0 0-1.091.452l-.599.317l-2.28-1.368l-.796.797l1.368 2.28l-.317.598q.278.523.453 1.091l.199.647l2.578.645v1.126l-2.578.645l-.2.647a6.3 6.3 0 0 0 .452 1.091l.317.599l-1.368 2.28l-.797.796l-2.28 1.368l-.598.317q.523.278 1.091.453l.647.199l.645 2.578h1.126l.645-2.578l.647-.2a6.3 6.3 0 0 0 1.091-.452l.599-.317l2.28 1.368l-.796-.797l-1.368-2.28l-.317-.598q.278-.523.453-1.091l.199-.647l2.578-.645v-1.126l-2.578-.645l-.2-.647a6.3 6.3 0 0 0-.452-1.091l-.317-.599l1.368-2.28l-.797-.796l-2.28 1.368l-.598-.317a6.3 6.3 0 0 0-1.091-.453l-.647-.199zm-.563 12.8a4 4 0 1 1 0-8a4 4 0 0 1 0 8"/>
            </svg>
            <span>Settings</span>
          </NavLink>

          <NavLink to="/logout" className={({isActive}) => navClasses(isActive)} onClick={() => setOpen(false)}>
            <svg className="h-5 w-5" viewBox="0 0 1024 1024">
              <path fill="currentColor" d="M868 732h-70.3c-4.8 0-9.3 2.1-12.3 5.8c-7 8.5-14.5 16.7-22.4 24.5a353.8 353.8 0 0 1-112.7 75.9A352.8 352.8 0 0 1 512.4 866c-47.9 0-94.3-9.4-137.9-27.8a353.8 353.8 0 0 1-112.7-75.9a353.3 353.3 0 0 1-76-112.5C167.3 606.2 158 559.9 158 512s9.4-94.2 27.8-137.8c17.8-42.1 43.4-80 76-112.5s70.5-58.1 112.7-75.9c43.6-18.4 90-27.8 137.9-27.8s94.3 9.3 137.9 27.8c42.2 17.8 80.1 43.4 112.7 75.9c7.9 7.9 15.3 16.1 22.4 24.5c3 3.7 7.6 5.8 12.3 5.8H868c6.3 0 10.2-7 6.7-12.3m88.9-226.3L815 393.7c-5.3-4.2-13-.4-13 6.3v76H488c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h314v76c0 6.7 7.8 10.5 13 6.3l141.9-112a8 8 0 0 0 0-12.6"/>
            </svg>
            <span>Logout</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
