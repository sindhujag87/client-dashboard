import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import PMDashboard from "./pages/PMDashboard";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import NotificationBell from "./components/NotificationBell";

function Shell() {
  const { user, loading, logout } = useAuth();

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <strong>{user.name}</strong> <span style={{ color: "#888" }}>({user.role})</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <NotificationBell />
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      {user.role === "ADMIN" && <AdminDashboard />}
      {user.role === "PM" && <PMDashboard />}
      {user.role === "DEVELOPER" && <DeveloperDashboard />}
    </div>
  );
}

function RequireAuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <SocketProvider>{children}</SocketProvider>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuthRoute>
                <Shell />
              </RequireAuthRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
