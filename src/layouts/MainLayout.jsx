import { Outlet } from "react-router-dom";
import SideBar from "../components/sidebar/SideBar";
import HistoryTracker from "../components/nav/HistoryTracker.jsx";
export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <HistoryTracker />
      <SideBar />
      {/* mobile: no left padding (drawer floats)
          lg: leave space for fixed sidebar (w-64 = 16rem, plus ~1rem gap) */}
      <main className="pt-3 pb-6 px-4 lg:pl-[18rem] lg:pr-6">
       <Outlet /> {/* ← must exist */}
        
      </main>
    </div>
  );
}
