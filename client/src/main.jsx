import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AdminPanel from "./admin/AdminPanel.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { installGlobalEventLogger } from "./eventLogger.js";
import "./styles.css";

const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

installGlobalEventLogger({ platform: isAdminRoute ? "admin" : "web" });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdminRoute ? (
      <AdminPanel />
    ) : (
      <ThemeProvider>
        <App />
      </ThemeProvider>
    )}
  </React.StrictMode>
);
