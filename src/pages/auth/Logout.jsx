// src/pages/auth/Logout.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear all auth data
    localStorage.removeItem("auth:user");
    localStorage.removeItem("token"); // if you ever used this

    // Optional: clear everything
    // localStorage.clear();

    // Redirect to login
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600 text-lg">Logging you out…</p>
    </div>
  );
}
