import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { installGlobalEventLogger } from "./eventLogger.js";
import ErrorBoundary, { flushStashedErrors } from "./components/ErrorBoundary.jsx";
import "./styles.css";

const AdminPanel = lazy(() => import("./admin/AdminPanel.jsx"));

const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

installGlobalEventLogger({ platform: isAdminRoute ? "admin" : "web" });

// Drain any errors that the previous session couldn't ship live (network
// dropped mid-flight). The boundary stashes them in localStorage on
// final failure; this fires once on boot.
flushStashedErrors();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={null}>
        <AdminPanel />
      </Suspense>
    ) : (
      <ThemeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeProvider>
    )}
  </React.StrictMode>
);
