import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { installGlobalEventLogger } from "./eventLogger.js";
import "./styles.css";

const AdminPanel = lazy(() => import("./admin/AdminPanel.jsx"));

const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

installGlobalEventLogger({ platform: isAdminRoute ? "admin" : "web" });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={null}>
        <AdminPanel />
      </Suspense>
    ) : (
      <ThemeProvider>
        <App />
      </ThemeProvider>
    )}
  </React.StrictMode>
);
