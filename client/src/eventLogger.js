// Lightweight client-side event logger.
// Batches events and flushes them to /api/events/ingest.

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

let apiBase = "";
let platform = "web";
let context = { userId: "", username: "", email: "" };
let abVariants = {};
let queue = [];
let flushTimer = null;
let installed = false;

function resolveDefaultApiBase() {
  if (typeof window === "undefined") return "";
  const configured = String(import.meta.env?.VITE_API_BASE_URL || "").trim();
  const protocol = window.location.protocol || "http:";
  const host = window.location.hostname || "localhost";

  if (configured) {
    try {
      const parsed = new URL(configured);
      if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && host !== "localhost" && host !== "127.0.0.1") {
        parsed.hostname = host;
        return parsed.toString().replace(/\/$/, "");
      }
      return configured;
    } catch {
      // fall through
    }
  }
  return `${protocol}//${host}:4000`;
}

function detectPlatform(defaultPlatform) {
  if (typeof window === "undefined") return defaultPlatform;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") === "1") return "mobile-web";
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined" && /ReactNative/i.test(navigator.userAgent || "")) {
    return "mobile-web";
  }
  return defaultPlatform;
}

export function configureEventLogger(options = {}) {
  if (options.apiBase) apiBase = options.apiBase;
  if (options.platform) platform = options.platform;
  if (!apiBase) apiBase = resolveDefaultApiBase();
}

export function setEventContext(nextContext = {}) {
  context = {
    userId: String(nextContext.userId || "").slice(0, 200),
    username: String(nextContext.username || "").slice(0, 200),
    email: String(nextContext.email || "").slice(0, 200)
  };
}

export function setExperimentVariants(map = {}) {
  abVariants = {};
  for (const [k, v] of Object.entries(map || {})) {
    if (k && v != null) abVariants[String(k).slice(0, 60)] = String(v).slice(0, 60);
  }
}

export function getExperimentVariants() {
  return { ...abVariants };
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
  if (!apiBase) apiBase = resolveDefaultApiBase();
  if (!apiBase) return;

  const batch = queue.splice(0, 50);
  try {
    await fetch(`${apiBase}/api/events/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: context.userId,
        username: context.username,
        platform,
        events: batch
      }),
      keepalive: true
    });
  } catch {
    // Drop on failure — do not re-queue to avoid loops.
  }
}

// Allowlist of event levels that are actually worth shipping to the
// admin dashboard. Anything below "warn" (info, debug, analytics,
// …) is dropped at the client BEFORE it touches the batch queue so
// we don't burn CPU, bandwidth, or server cycles on non-actionable
// telemetry. To add a new admin-visible event, pass `level: "warn"`
// or higher.
const ADMIN_LEVELS = new Set(["warn", "warning", "error", "critical", "problem"]);

export function logEvent(type, data = {}) {
  if (typeof window === "undefined") return;

  const level = String(data.level || "info").toLowerCase();
  if (!ADMIN_LEVELS.has(level)) {
    return; // filtered out — info / debug / analytics never leave the client
  }

  if (!apiBase) apiBase = resolveDefaultApiBase();

  let meta;
  if (data.meta && typeof data.meta === "object" && !Array.isArray(data.meta)) {
    meta = { ...data.meta };
  } else if (data.meta != null) {
    meta = { value: data.meta };
  } else {
    meta = {};
  }
  if (Object.keys(abVariants).length > 0 && !meta.ab) {
    meta.ab = { ...abVariants };
  }

  const evt = {
    type: String(type || "unknown").slice(0, 120),
    level: String(data.level || "info").slice(0, 40),
    userId: data.userId || context.userId,
    username: data.username || context.username,
    platform,
    message: typeof data.message === "string" ? data.message.slice(0, 2000) : "",
    stack: typeof data.stack === "string" ? data.stack.slice(0, 4000) : "",
    url: typeof window !== "undefined" ? String(window.location?.href || "").slice(0, 500) : "",
    userAgent: typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 400) : "",
    meta: (() => {
      const merged = { ...meta };
      if (context.email && !merged.actorEmail) merged.actorEmail = context.email;
      return Object.keys(merged).length > 0 ? merged : null;
    })()
  };

  queue.push(evt);

  if (queue.length >= BATCH_SIZE) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

export function logError(type, error, extra = {}) {
  const message = error?.message || (typeof error === "string" ? error : "Unknown error");
  const stack = error?.stack || "";
  logEvent(type, { level: "error", message, stack, meta: extra });
}

export function installGlobalEventLogger({ platform: plat = "web", apiBase: base } = {}) {
  if (installed) return;
  installed = true;
  configureEventLogger({ platform: detectPlatform(plat), apiBase: base });

  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    logError("window_error", event?.error || { message: event?.message }, {
      filename: event?.filename,
      line: event?.lineno,
      col: event?.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    logError("unhandled_rejection", reason instanceof Error ? reason : { message: String(reason) });
  });

  if (typeof document !== "undefined") {
    // Flush any pending error/warn events when the tab goes to the
    // background — but don't LOG the visibility change itself; it's
    // analytics-level noise that the allowlist drops anyway.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushEvents();
      }
    });
  }

  window.addEventListener("beforeunload", () => {
    if (queue.length > 0 && apiBase && navigator?.sendBeacon) {
      try {
        const blob = new Blob([
          JSON.stringify({
            userId: context.userId,
            username: context.username,
            platform,
            events: queue.splice(0, 50)
          })
        ], { type: "application/json" });
        navigator.sendBeacon(`${apiBase}/api/events/ingest`, blob);
      } catch {
        // ignore
      }
    }
  });

  logEvent("client_session_start", {
    meta: {
      ts: Date.now(),
      screen: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
      lang: typeof navigator !== "undefined" ? navigator.language : ""
    }
  });
}
