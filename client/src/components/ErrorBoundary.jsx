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

class ErrorBoundaryClass extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
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
          componentStack: String(errorInfo?.componentStack || "").slice(0, 2000)
        }
      }]
    };
    shipErrorEvent(payload);
  }

  handleRetry() {
    this.setState({ hasError: false, error: null });
  }

  handleReload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { t } = this.props;
    const title = (t && t.errorBoundaryTitle) || "Something went wrong";
    const body = (t && t.errorBoundaryBody) || "We've been notified and are looking into it. Try again, or reload the app.";
    const retryCta = (t && t.errorBoundaryRetryCta) || "Try again";
    const reloadCta = (t && t.errorBoundaryReloadCta) || "Reload";

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
            border: "1.5px solid color-mix(in srgb, #ef4444 55%, transparent)",
            background: "linear-gradient(160deg, var(--panel-bg), color-mix(in srgb, #7f1d1d 14%, var(--panel-bg)))",
            boxShadow: "0 0 60px color-mix(in srgb, #ef4444 22%, transparent), inset 0 0 30px color-mix(in srgb, #ef4444 8%, transparent)",
            textAlign: "center",
            animation: "slideInUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)"
          }}
        >
          {/* Warning glyph in a soft red halo */}
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 14px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, #ef4444 18%, transparent)",
              border: "1.5px solid color-mix(in srgb, #ef4444 50%, transparent)",
              color: "#fca5a5"
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
