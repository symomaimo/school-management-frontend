// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Students from "./pages/students/Students";
import PaymentPage from "./pages/payment/PaymentPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import Logout from "./pages/auth/Logout.jsx";
import ProtectedRoute from "./components/helpers/ProtectedRoute.jsx";

// Director reports
import DailyPage from "./pages/reports/DailyPage.jsx";
import DailyRangePage from "./pages/reports/DailyRangePage.jsx";
import TermSummary from "./pages/reports/TermSummary.jsx"; // <- whole-school totals
import TextbookPrices from "./pages/admin/TextbookPrices.jsx";
import FeesSetup from "./pages/admin/FeesSetup.jsx";
import TuitionSetup from "./pages/admin/TuitionSetup.jsx";
import DirectorFeesDashboard from "./pages/payment/DirectorFeesDashboard.jsx";

function NotAllowed() {
  return <div className="p-6">Not allowed.</div>;
}

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<Logout />} />
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
      <DailyRangePage />
    </ProtectedRoute>
  }
/>

<Route
  path="reports/date-range"
  element={
    <ProtectedRoute roles={["DIRECTOR"]}>
      <DailyPage />
    </ProtectedRoute>
  }
/>

<Route
  path="reports/term-summary"
  element={
    <ProtectedRoute roles={["DIRECTOR"]}>
      <TermSummary defaultYear={2026} defaultTerm="Term1" />
    </ProtectedRoute>
  }
/>
<Route 
path="fees-dashboard"
element={
  <ProtectedRoute roles={["DIRECTOR"]}>
    <DirectorFeesDashboard />
  </ProtectedRoute>
}
/>
{/* ✅ DIRECTOR-ONLY admin fees setup */}
<Route
  path="admin/fees-setup"
  element={
    <ProtectedRoute roles={["DIRECTOR"]}>
      <FeesSetup />
    </ProtectedRoute>
  }
/>

<Route
  path="admin/textbooks"
  element={
    <ProtectedRoute roles={["DIRECTOR"]}>
      <TextbookPrices />
    </ProtectedRoute>
  }
/>

<Route
  path="admin/tuition"
  element={
    <ProtectedRoute roles={["DIRECTOR"]}>
      <TuitionSetup />
    </ProtectedRoute>
  }
/>
{/* fallback */}
<Route path="*" element={<Navigate to="/students" replace />} />

      </Route>
    </Routes>
  );
}
