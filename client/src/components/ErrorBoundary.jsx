import { Component } from "react";
import { useTheme } from "../ThemeContext";
import { IconWarning } from "./icons/Icons";

// Resilient direct ship of a single event to /api/events/ingest. Two
// retries with a 1s gap; if both fail, stash the payload in localStorage
// so the next app boot can flush it. Beats eventLogger.flushEvents for
// boundary errors because we send synchronously from componentDidCatch
// — no waiting on the 5s batch timer.
async function shipErrorEvent(payload) {
  const configured = String(import.meta.env?.VITE_API_BASE_URL || "").trim();
  let apiBase = configured;
  if (!apiBase && typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "localhost";
    apiBase = `${protocol}//${host}:4000`;
  }
  if (!apiBase) return false;

  const body = JSON.stringify(payload);
  const post = () => fetch(`${apiBase}/api/events/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await post();
      if (res && res.ok) return true;
    } catch {
      // ignore — retry below
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
  }

  // Both attempts failed — stash for next session boot to flush.
  try {
    const raw = localStorage.getItem("rpg_pending_errors");
    const stash = raw ? JSON.parse(raw) : [];
    if (Array.isArray(stash)) {
      stash.push(payload);
      localStorage.setItem("rpg_pending_errors", JSON.stringify(stash.slice(-20)));
    } else {
      localStorage.setItem("rpg_pending_errors", JSON.stringify([payload]));
    }
  } catch {
    // Storage quota / private mode — give up silently.
  }
  return false;
}

// Sliding-window crash counter. Returns the number of crashes (incl. the
// new one) that have happened in the last 5 minutes, persisted in
// localStorage so it survives reloads. Used by the boundary to switch
// from the friendly "Try again" popup to the harder "Reset app" stuck-
// mode popup once the user is clearly hitting the same bug repeatedly.
const CRASH_LOG_KEY = "rpg_crash_log";
const CRASH_WINDOW_MS = 5 * 60 * 1000;
const STUCK_THRESHOLD = 3;

function recordCrashAndCount() {
  if (typeof window === "undefined") return 1;
  const now = Date.now();
  let log = [];
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        log = parsed.filter((ts) => typeof ts === "number" && now - ts < CRASH_WINDOW_MS);
      }
    }
  } catch {
    // ignore — start fresh
  }
  log.push(now);
  try {
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(log.slice(-20)));
  } catch {
    // storage quota / private mode — don't block the popup
  }
  return log.length;
}

// Cache-busting hard navigation. Some iOS WKWebViews keep a stale JS
// bundle on a plain reload(); appending `?_=<ts>` produces a fresh URL
// the cache layer hasn't seen, forcing a clean fetch of index.html
// (which then loads the new hashed JS chunks). One-shot recovery flag
// is also written so App's initial-state reader lands on Dashboard
// after the reload, not back on the crashing tab.
function recoverReload() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("rpg_recover_to", "dashboard");
    // Also clear the persisted mobile-tab so the native shell doesn't
    // re-issue the broken tab on remount.
    localStorage.setItem("life_rpg_mobile_tab", "dashboard");
  } catch {
    // ignore
  }
  const path = window.location.pathname || "/";
  window.location.href = `${path}?_=${Date.now()}`;
}

// Last-resort: blow away every rpg_*/life_rpg_* localStorage key, then
// recover-reload. Auth (Firebase IndexedDB) is NOT cleared — we don't
// want to log the user out as part of error recovery. Theme/language/
// last-tab/crash-log all reset to defaults.
function nukeLocalAppState() {
  if (typeof window === "undefined") return;
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("rpg_") || k.startsWith("life_rpg_"))) {
        drop.push(k);
      }
    }
    drop.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore one bad key */ }
    });
  } catch {
    // ignore
  }
}

class ErrorBoundaryClass extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, crashStreak: 0 };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleResetApp = this.handleResetApp.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const crashStreak = recordCrashAndCount();
    this.setState({ crashStreak });

    // Ship synchronously — don't rely on window.error which iOS WKWebView
    // can swallow for React render errors. This is the whole point of the
    // boundary: catch it ourselves and post directly.
    const payload = {
      events: [{
        type: "react_error_boundary",
        level: "error",
        platform: "web",
        message: String(error?.message || "Unknown render error").slice(0, 2000),
        stack: String(error?.stack || "").slice(0, 4000),
        url: typeof window !== "undefined" ? String(window.location?.href || "").slice(0, 500) : "",
        userAgent: typeof navigator !== "undefined" ? String(navigator.userAgent || "").slice(0, 400) : "",
        meta: {
          componentStack: String(errorInfo?.componentStack || "").slice(0, 2000),
          crashStreak
        }
      }]
    };
    shipErrorEvent(payload);
  }

  handleRetry() {
    this.setState({ hasError: false, error: null });
  }

  handleReload() {
    recoverReload();
  }

  handleResetApp() {
    nukeLocalAppState();
    recoverReload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { t } = this.props;
    const isStuck = this.state.crashStreak >= STUCK_THRESHOLD;

    // Two popup variants: friendly "Try again" for the first couple of
    // crashes, harder "Reset app" when the user has clearly hit the same
    // bug 3+ times in 5 minutes (sliding window). The stuck variant
    // hides Try again — the whole point is to push toward a clean
    // reset, not let the user keep retrying the same crashing path.
    const title = isStuck
      ? ((t && t.errorBoundaryStuckTitle) || "Looks like something's stuck")
      : ((t && t.errorBoundaryTitle) || "Something went wrong");
    const body = isStuck
      ? ((t && t.errorBoundaryStuckBody) || "We're seeing the same error again and again. Try a clean reset of local data, or come back later.")
      : ((t && t.errorBoundaryBody) || "We've been notified and are looking into it. Try again, or reload the app.");
    const retryCta = (t && t.errorBoundaryRetryCta) || "Try again";
    const reloadCta = (t && t.errorBoundaryReloadCta) || "Reload";
    const resetCta = (t && t.errorBoundaryResetCta) || "Reset app";

    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-boundary-title"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          background: "rgba(5, 10, 20, 0.78)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          animation: "fadeIn 0.25s ease-out"
        }}
      >
        <div
          className="mobile-card"
          style={{
            maxWidth: 420,
            width: "100%",
            padding: "28px 24px",
            borderRadius: 24,
            border: `1.5px solid color-mix(in srgb, #ef4444 ${isStuck ? "75" : "55"}%, transparent)`,
            background: `linear-gradient(160deg, var(--panel-bg), color-mix(in srgb, #7f1d1d ${isStuck ? "22" : "14"}%, var(--panel-bg)))`,
            boxShadow: `0 0 60px color-mix(in srgb, #ef4444 ${isStuck ? "32" : "22"}%, transparent), inset 0 0 30px color-mix(in srgb, #ef4444 ${isStuck ? "12" : "8"}%, transparent)`,
            textAlign: "center",
            animation: "slideInUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)"
          }}
        >
          {/* Warning glyph in a soft red halo — slightly more saturated in stuck mode */}
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 14px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `color-mix(in srgb, #ef4444 ${isStuck ? "26" : "18"}%, transparent)`,
              border: `1.5px solid color-mix(in srgb, #ef4444 ${isStuck ? "70" : "50"}%, transparent)`,
              color: isStuck ? "#fecaca" : "#fca5a5"
            }}
          >
            <IconWarning size={32} />
          </div>

          <h2
            id="error-boundary-title"
            className="cinzel"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "#fee2e2",
              margin: 0,
              lineHeight: 1.2
            }}
          >
            {title}
          </h2>

          <p
            style={{
              fontSize: 14,
              color: "var(--color-text)",
              opacity: 0.85,
              margin: "12px 0 22px",
              lineHeight: 1.55
            }}
          >
            {body}
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {isStuck ? (
              // Stuck mode: prominent Reset CTA (red gradient) + subtle Reload.
              // No Try again — same bug would just re-throw.
              <button
                type="button"
                onClick={this.handleResetApp}
                className="mobile-pressable cinzel"
                style={{
                  flex: "1 1 130px",
                  padding: "12px 18px",
                  borderRadius: 14,
                  border: "1.5px solid color-mix(in srgb, #ef4444 70%, transparent)",
                  background: "linear-gradient(135deg, #dc2626, #ef4444)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 6px 18px color-mix(in srgb, #ef4444 38%, transparent)"
                }}
              >
                {resetCta}
              </button>
            ) : (
              <button
                type="button"
                onClick={this.handleRetry}
                className="mobile-pressable cinzel"
                style={{
                  flex: "1 1 130px",
                  padding: "12px 18px",
                  borderRadius: 14,
                  border: "1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
                  background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                  color: "#0b1120",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 6px 18px color-mix(in srgb, var(--color-primary) 30%, transparent)"
                }}
              >
                {retryCta}
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="mobile-pressable cinzel"
              style={{
                flex: "1 1 130px",
                padding: "12px 18px",
                borderRadius: 14,
                border: "1.5px solid var(--card-border-idle)",
                background: "color-mix(in srgb, var(--card-bg) 70%, transparent)",
                color: "var(--color-text)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer"
              }}
            >
              {reloadCta}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Functional wrapper so we can pull `t` from the theme context — the
// class component itself can't use hooks but we want it to render a
// localised popup. Falls back to English defaults if t is unavailable
// (e.g. ThemeProvider hasn't mounted yet at error time).
export default function ErrorBoundary({ children }) {
  let t;
  try {
    ({ t } = useTheme());
  } catch {
    t = null;
  }
  return <ErrorBoundaryClass t={t}>{children}</ErrorBoundaryClass>;
}

// Boot-time flush of any errors that were stashed in localStorage
// when a previous session lost network mid-ship. Call once from
// main.jsx after mount.
export function flushStashedErrors() {
  if (typeof window === "undefined") return;
  let stash;
  try {
    const raw = localStorage.getItem("rpg_pending_errors");
    if (!raw) return;
    stash = JSON.parse(raw);
  } catch {
    try { localStorage.removeItem("rpg_pending_errors"); } catch { /* ignore */ }
    return;
  }
  if (!Array.isArray(stash) || stash.length === 0) {
    try { localStorage.removeItem("rpg_pending_errors"); } catch { /* ignore */ }
    return;
  }

  // Each stashed payload is already shaped as { events: [...] }; merge
  // their event arrays into one POST so we don't fire N requests for N
  // queued errors.
  const allEvents = [];
  for (const payload of stash) {
    if (payload && Array.isArray(payload.events)) {
      allEvents.push(...payload.events);
    }
  }
  if (allEvents.length === 0) {
    try { localStorage.removeItem("rpg_pending_errors"); } catch { /* ignore */ }
    return;
  }

  shipErrorEvent({ events: allEvents.slice(0, 50) }).then((ok) => {
    if (ok) {
      try { localStorage.removeItem("rpg_pending_errors"); } catch { /* ignore */ }
    }
    // If still failing, leave the stash for the next boot to retry.
  });
}
