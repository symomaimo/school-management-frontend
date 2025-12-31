// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Students from "./pages/students/Students";
import PaymentPage from "./pages/payment/PaymentPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import ProtectedRoute from "./components/helpers/ProtectedRoute.jsx";

// Director reports
import DailyPage from "./pages/reports/DailyPage.jsx";
import DailyRangePage from "./pages/reports/DailyRangePage.jsx";
import TermSummary from "./pages/reports/TermSummary.jsx"; // <- whole-school totals

function NotAllowed() {
  return <div className="p-6">Not allowed.</div>;
}

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<NotAllowed />} />

      {/* everything under “/” requires auth */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* default landing (you can change to /payments if you want) */}
        <Route index element={<Students />} />

        {/* common pages */}
        <Route path="students" element={<Students />} />
        <Route path="payment" element={<PaymentPage />} />
        <Route path="payments" element={<PaymentPage />} />

        {/* DIRECTOR-ONLY reports */}
        <Route
          path="reports/daily-range"
          element={
            <ProtectedRoute roles={["DIRECTOR"]}>
              <DailyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/date-range"
          element={
            <ProtectedRoute roles={["DIRECTOR"]}>
              <DailyRangePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/term-summary"
          element={
            <ProtectedRoute roles={["DIRECTOR"]}>
              {/* default to 2026 Term1 as requested */}
              <TermSummary defaultYear={2026} defaultTerm="Term1" />
            </ProtectedRoute>
          }
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/students" replace />} />
      </Route>
    </Routes>
  );
}
