import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import FounderNew from "./pages/FounderNew";
import Respond from "./pages/Respond";
import FounderDashboard from "./pages/FounderDashboard";
import "./index.css";

const router = createBrowserRouter([
  { path: "/founder/new", element: <FounderNew /> },
  { path: "/founder/dashboard", element: <FounderDashboard /> },
  { path: "/respond", element: <Respond /> },
  {
    path: "*",
    element: (
      <div style={{ padding: 20 }}>
        Not found. Try <a href="/founder/new">/founder/new</a> or{" "}
        <a href="/founder/dashboard">/founder/dashboard</a>
      </div>
    ),
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
