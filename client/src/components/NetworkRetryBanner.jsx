import { useEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";

// Global toast that fades in when the api.js request() helper enters its
// retry loop for any GET, and fades out on the "api-retry-end" event or
// 6s of silence. Kept intentionally quiet — a small pill at the top of
// the screen rather than a blocking overlay — so the app keeps
// responding; the preloader is reserved for the initial-data-load path.
export default function NetworkRetryBanner() {
  const { t } = useTheme();
  const [state, setState] = useState("idle"); // idle | reconnecting | ok | failed
  const hideTimerRef = useRef(null);

  useEffect(() => {
    function clearHideTimer() {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }

    function onStart() {
      clearHideTimer();
      setState("reconnecting");
      // Safety auto-hide: if the request silently resolves without firing
      // an end event (shouldn't happen, but defensive), the banner still
      // dismisses after 10s so it never gets stuck.
      hideTimerRef.current = setTimeout(() => setState("idle"), 10_000);
    }

    function onEnd(event) {
      clearHideTimer();
      const ok = Boolean(event?.detail?.ok);
      setState(ok ? "ok" : "failed");
      hideTimerRef.current = setTimeout(() => setState("idle"), ok ? 1400 : 2400);
    }

    window.addEventListener("api-retry-start", onStart);
    window.addEventListener("api-retry-end", onEnd);
    return () => {
      window.removeEventListener("api-retry-start", onStart);
      window.removeEventListener("api-retry-end", onEnd);
      clearHideTimer();
    };
  }, []);

  if (state === "idle") return null;

  const label = state === "reconnecting"
    ? (t.networkRetrying || "Reconnecting...")
    : state === "ok"
      ? (t.networkRestored || "Back online")
      : (t.networkFailed || "Connection lost — retrying soon");

  const bg = state === "ok"
    ? "color-mix(in srgb, #10b981 22%, transparent)"
    : state === "failed"
      ? "color-mix(in srgb, #f87171 22%, transparent)"
      : "color-mix(in srgb, var(--color-primary) 22%, transparent)";

  const border = state === "ok"
    ? "rgba(16,185,129,0.55)"
    : state === "failed"
      ? "rgba(248,113,113,0.55)"
      : "color-mix(in srgb, var(--color-primary) 55%, transparent)";

  const fg = state === "ok"
    ? "#6ee7b7"
    : state === "failed"
      ? "#fca5a5"
      : "var(--color-text)";

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        padding: "8px 14px",
        borderRadius: 999,
        background: bg,
        backdropFilter: "blur(12px)",
        border: `1px solid ${border}`,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        maxWidth: "calc(100vw - 24px)",
        whiteSpace: "nowrap",
        pointerEvents: "none"
      }}
    >
      {state === "reconnecting" ? (
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,0.25)",
            borderTopColor: "var(--color-primary)",
            animation: "spin 0.8s linear infinite",
            display: "inline-block"
          }}
        />
      ) : (
        <span aria-hidden style={{ fontSize: 13 }}>
          {state === "ok" ? "✓" : "⚠"}
        </span>
      )}
      <span>{label}</span>
    </div>
  );
}
