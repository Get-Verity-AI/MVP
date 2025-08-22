import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import FounderWizard from "./pages/FounderWizard";
import Respond from "./pages/Respond";
import "./index.css";

const router = createBrowserRouter([
  { path: "/founder/new", element: <FounderWizard /> },
  { path: "/respond", element: <Respond /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
