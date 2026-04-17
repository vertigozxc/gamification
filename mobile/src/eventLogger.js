// Mobile-side event logger. Forwards native RN errors to server ingest endpoint.
import { Platform } from "react-native";

const API_BASE = "http://192.168.70.243:4000";

async function sendEvent(evt) {
  try {
    await fetch(`${API_BASE}/api/events/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: `mobile-${Platform.OS}`,
        events: [evt]
      })
    });
  } catch {
    // drop
  }
}

export function logMobileEvent(type, data = {}) {
  sendEvent({
    type: String(type || "unknown").slice(0, 120),
    level: String(data.level || "info").slice(0, 40),
    message: typeof data.message === "string" ? data.message.slice(0, 2000) : "",
    stack: typeof data.stack === "string" ? data.stack.slice(0, 4000) : "",
    meta: data.meta || null
  });
}

let installed = false;

export function installMobileEventLogger() {
  if (installed) return;
  installed = true;

  if (typeof ErrorUtils !== "undefined" && ErrorUtils.setGlobalHandler) {
    const previous = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logMobileEvent("native_error", {
        level: isFatal ? "fatal" : "error",
        message: error?.message || String(error),
        stack: error?.stack || "",
        meta: { isFatal }
      });
      if (typeof previous === "function") previous(error, isFatal);
    });
  }

  if (typeof global !== "undefined" && typeof global.addEventListener === "function") {
    try {
      global.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason;
        logMobileEvent("native_unhandled_rejection", {
          level: "error",
          message: reason?.message || String(reason),
          stack: reason?.stack || ""
        });
      });
    } catch {
      // ignore
    }
  }

  logMobileEvent("mobile_app_start", { meta: { os: Platform.OS, version: Platform.Version } });
}
