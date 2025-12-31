import { useLocation, useNavigate } from "react-router-dom";

const KEY = "navStack:v1";

// Very forgiving matchers (singular/plural, nested, etc.)
const RECEIPT_RE   = /\/pay(?:ment|ments)\/.*\/?receipt\/?/i;     // …/payment/receipt/:id or …/payments/receipt/:id
const PAY_DETAIL_RE = /\/pay(?:ment|ments)\/.+/i;                 // any deeper payment page
const STUDENT_DETAIL_RE = /\/students\/(?!$).+/i;                 // /students/<something>
const REPORTS_DETAIL_RE = /\/reports\/(daily|daily-range|term-summary)\/(?!$).+/i;

// Decide best list page for current path
function mapDetailToList(path) {
  if (RECEIPT_RE.test(path)) return "/payment";         // prefer singular list
  if (PAY_DETAIL_RE.test(path)) return "/payment";
  if (STUDENT_DETAIL_RE.test(path)) return "/students";

  const m = path.match(REPORTS_DETAIL_RE);
  if (m) return `/reports/${m[1]}`;

  return null;
}

export default function SmartBackButton({
  fallback = "/payment",           // sensible default for your app
  children = "← Back",
  className,
  ...rest
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const onBack = () => {
    // 1) If SmartLink provided an origin, use it
    if (location.state?.from) {
      navigate(location.state.from, { replace: true });
      return;
    }

    // 2) Use HistoryTracker stack
    let stack = [];
    try { stack = JSON.parse(sessionStorage.getItem(KEY)) || []; } catch {}
    if (stack.length > 1) {
      const current = stack.pop();
      let target = stack.pop();
      while (target === current && stack.length) target = stack.pop();
      sessionStorage.setItem(KEY, JSON.stringify(stack));
      if (target) { navigate(target, { replace: true }); return; }
    }

    // 3) Deterministic mapping (detail → list), very broad
    const mapped = mapDetailToList(location.pathname);
    if (mapped) { navigate(mapped, { replace: true }); return; }

    // 4) True browser back if there *is* history
    const idx = window.history?.state?.idx ?? 0;
    if (idx > 0 || window.history.length > 1) {
      window.history.back();
      return;
    }

    // 5) Final fallback
    navigate(fallback, { replace: true });
  };

  return (
    <button type="button" onClick={onBack} className={className} {...rest}>
      {children}
    </button>
  );
}
