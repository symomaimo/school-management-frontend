// src/components/nav/HistoryTracker.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
const KEY = "navStack:v1";

export default function HistoryTracker() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname + location.search + location.hash;
    let stack = [];
    try { stack = JSON.parse(sessionStorage.getItem(KEY)) || []; } catch {}
    if (stack[stack.length - 1] !== path) {
      stack.push(path);
      if (stack.length > 50) stack.shift();
      sessionStorage.setItem(KEY, JSON.stringify(stack));
    }
  }, [location.key]);
  return null;
}
