// Mobile-side event logger. Forwards native RN errors/events to server ingest endpoint.
import { AppState, Platform } from "react-native";
import { getApiBaseUrl } from "./config/env";

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

let apiBase = "";
let context = { userId: "", username: "" };
let queue = [];
let flushTimer = null;
let installed = false;

function ensureApiBase() {
  if (!apiBase) {
    try {
      apiBase = getApiBaseUrl();
    } catch {
      apiBase = "";
    }
  }
  return apiBase;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

async function flushEvents() {
  if (queue.length === 0) return;
  const base = ensureApiBase();
  if (!base) return;

  const batch = queue.splice(0, 50);
  try {
    await fetch(`${base}/api/events/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: context.userId,
        username: context.username,
        platform: `mobile-${Platform.OS}`,
        events: batch
      })
    });
  } catch {
    // drop on failure
  }
}

export function setMobileEventContext(next = {}) {
  context = {
    userId: String(next.userId || "").slice(0, 200),
    username: String(next.username || "").slice(0, 200)
  };
}

export function logMobileEvent(type, data = {}) {
  const evt = {
    type: String(type || "unknown").slice(0, 120),
    level: String(data.level || "info").slice(0, 40),
    message: typeof data.message === "string" ? data.message.slice(0, 2000) : "",
    stack: typeof data.stack === "string" ? data.stack.slice(0, 4000) : "",
    meta: data.meta || null
  };
  queue.push(evt);
  if (queue.length >= BATCH_SIZE) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

export function installMobileEventLogger() {
  if (installed) return;
  installed = true;
  ensureApiBase();

  if (typeof ErrorUtils !== "undefined" && ErrorUtils.setGlobalHandler) {
    const previous = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logMobileEvent("native_error", {
        level: isFatal ? "fatal" : "error",
        message: error?.message || String(error),
        stack: error?.stack || "",
        meta: { isFatal }
      });
      // Best-effort flush before app potentially crashes.
      flushEvents();
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

  try {
    AppState.addEventListener("change", (next) => {
      logMobileEvent("mobile_app_state", { meta: { state: next } });
      if (next !== "active") flushEvents();
    });
  } catch {
    // ignore
  }

  logMobileEvent("mobile_app_start", {
    meta: {
      os: Platform.OS,
      version: Platform.Version,
      apiBase: ensureApiBase()
    }
  });
}
