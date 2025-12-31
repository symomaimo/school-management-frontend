// src/pages/auth/LoginPage.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api/Axios.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    const payload = {
      email: String(email || "").trim(),
      password: String(password || ""),
    };
    if (!payload.email || !payload.password) {
      setErr("Email and password are required.");
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await api.post("/auth/login", payload);
      // data = { token, user: { id, name, email, role } }

      const authUser = { ...data.user, token: data.token };
      // persist for interceptor (Option A)
      localStorage.setItem("auth:user", JSON.stringify(authUser));
      setUser(authUser);

      // redirect: prefer "from", otherwise by role
      const fallback =
        authUser.role === "DIRECTOR" ? "/reports/daily" : "/payments";
      navigate(from || fallback, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="border rounded w-full p-2"
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border rounded w-full p-2"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Login"}
        </button>
      </form>

      {/* Quick note with your seeded accounts (remove in production) */}
      <div className="mt-4 text-xs text-gray-600">
        <div>Director: <code>madamgrace255@gmail.com</code> / <code>5030</code></div>
        <div>Secretary: <code>secretary27@gmail.com</code> / <code>12345</code></div>
      </div>
    </div>
  );
}
