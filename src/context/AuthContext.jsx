// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthCtx = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // load from storage on mount
  useEffect(() => {
    const raw = localStorage.getItem("auth:user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
  }, []);

  // keep storage in sync when user changes
  useEffect(() => {
    if (!user) localStorage.removeItem("auth:user");
    else localStorage.setItem("auth:user", JSON.stringify(user));
  }, [user]);

  return (
    <AuthCtx.Provider value={{ user, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
