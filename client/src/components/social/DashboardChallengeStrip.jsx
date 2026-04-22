import { useCallback, useEffect, useState } from "react";
import { fetchUserChallenges } from "../../api";
import "./ios.css";

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Minimal collapsed strip. Header shows "{title} N/M" where N = challenges
 * the user has completed today and M = total active challenges. Tap the
 * header to expand and reveal per-challenge rows (title + done/not-done
 * pill). Tap a row to open the challenge detail screen.
 */
export default function DashboardChallengeStrip({ authUser, t, onOpenSocial }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [active, setActive] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    if (!meUid) return;
    try {
      const data = await fetchUserChallenges(meUid);
      const now = Date.now();
      setActive((data?.challenges || []).filter((c) => new Date(c.endsAt).getTime() > now));
    } catch {
      setActive([]);
    } finally {
      setLoaded(true);
    }
  }, [meUid]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh whenever the social side signals a change (create, complete,
  // leave). Keeps the strip consistent without needing to remount.
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("social:refresh-challenges", handler);
    return () => window.removeEventListener("social:refresh-challenges", handler);
  }, [refresh]);

  if (!loaded || active.length === 0) return null;

  const tKey = todayKey();
  const doneToday = active.filter((c) => c.myLastCompletionDayKey === tKey).length;

  return (
    <div
      className="social-block"
      style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14, overflow: "hidden" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="press"
        aria-expanded={expanded}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          color: "var(--color-text)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>⚔️</span>
        <span className="body" style={{ fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>
          {t.socialDashboardStripTitle || "Group challenges"}
        </span>
        <span className="pill pill-accent" style={{ flexShrink: 0 }}>
          {doneToday}/{active.length}
        </span>
        <span
          aria-hidden="true"
          style={{
            color: "var(--color-muted)",
            fontSize: 18,
            display: "inline-block",
            transition: "transform 220ms cubic-bezier(0.32,0.72,0,1)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
            marginLeft: 2,
          }}
        >
          ›
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--panel-border)" }}>
          {active.map((c) => {
            const completedToday = c.myLastCompletionDayKey === tKey;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenSocial && onOpenSocial(c.id)}
                className="list-row press"
                style={{ fontFamily: "inherit" }}
              >
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                  <span
                    className="body"
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {c.title}
                  </span>
                </span>
                {completedToday ? (
                  <span className="pill pill-success" style={{ flexShrink: 0 }}>
                    ✓ {t.socialDoneToday || "Done"}
                  </span>
                ) : (
                  <span
                    className="pill"
                    style={{ flexShrink: 0, background: "rgba(120,120,128,0.12)", color: "var(--color-muted)" }}
                  >
                    · {t.socialNotDoneToday || "Not done"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
