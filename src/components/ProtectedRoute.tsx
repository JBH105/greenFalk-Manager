import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import LoadingBar from "./common/LoadingBar/LoadingBar";


export default function ProtectedRoute() {
  const { isAuthenticated, hydrated, user } = useAuthStore();
  const location = useLocation();

  // Wait for the saved session to be read before deciding.
  if (!hydrated) return <LoadingBar />;

  // Block unauthenticated users
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (user?.role?.name === "chef") {
    if (location.pathname !== "/pos/invoices") {
      return <Navigate to="/pos/invoices" replace />;
    }
  }

  // Render all nested protected routes
  return <Outlet />;
}
