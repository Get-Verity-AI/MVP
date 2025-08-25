// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAuth from "./auth/RequireAuth";
import ErrorBoundary from "./ErrorBoundary";


import FounderSignup from "./pages/FounderSignup";
import FounderSignin from "./pages/FounderSignin";
import FounderDashboard from "./pages/FounderDashboard";
import FounderNew from "./pages/FounderNew";
import FounderSession from "./pages/FounderSession";
import FounderShare from "./pages/FounderShare";
import Respond from "./pages/Respond";
import FounderIntro from "./pages/FounderIntro"; // add this import


import "./index.css";

// Wrap a group of routes so all /founder/* require auth
function ProtectedGroup() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <React.StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/signup" element={<FounderSignup />} />
            <Route path="/signin" element={<FounderSignin />} />
            <Route path="/respond" element={<Respond />} />

            {/* Everything under /founder/* is protected */}
            <Route path="/founder" element={<ProtectedGroup />}>
            <Route path="intro" element={<FounderIntro />} />   
              <Route path="dashboard" element={<FounderDashboard />} />
              <Route path="new" element={<FounderNew />} />
              <Route path="session" element={<FounderSession />} />
              <Route path="share" element={<FounderShare />} />
            </Route>

            {/* Old/capitalized links → redirect */}
            <Route path="/FounderSignin" element={<Navigate to="/signin" replace />} />
            <Route path="/FounderSignup" element={<Navigate to="/signup" replace />} />
            <Route path="/FounderDashboard" element={<Navigate to="/founder/dashboard" replace />} />
            <Route path="/Respond" element={<Navigate to="/respond" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </React.StrictMode>
  </ErrorBoundary>
);
