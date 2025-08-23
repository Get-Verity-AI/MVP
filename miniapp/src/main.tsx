import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import FounderNew from "./pages/FounderNew";
import Respond from "./pages/Respond";
import "./index.css";




const router = createBrowserRouter([
  { path: "/founder/new", element: <FounderNew /> },
  { path: "/respond", element: <Respond /> },
  { path: "*", element: <div style={{padding:20}}>Not found. Try /founder/new</div> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
