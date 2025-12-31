// src/api/Axios.js
import axios from "axios";

// Prefer env when available (recommended)
const fromEnv = import.meta?.env?.VITE_API_BASE;

// Fallback: infer API from current origin but force port 5000
let inferred = "";
if (typeof window !== "undefined") {
  const origin = window.location.origin; // e.g. http://localhost:5173
  inferred = origin.replace(/:\d+$/, ":5000"); // force API to 5000
}

const API_BASE = fromEnv || inferred || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem("auth:user");
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return config;
});

export default api;
