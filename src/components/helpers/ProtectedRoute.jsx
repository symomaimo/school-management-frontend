import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();

  // not logged in -> send to login, keep where they came from
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // role-gated route
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
