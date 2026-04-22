import { useCallback, useEffect, useState } from "react";
import { completeChallenge, fetchUserChallenges } from "../../api";
import "./ios.css";

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function DashboardChallengeStrip({ authUser, t, onOpenSocial }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [active, setActive] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState(null);

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
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("social:refresh-challenges", h);
    return () => window.removeEventListener("social:refresh-challenges", h);
  }, [refresh]);

  async function handleComplete(id) {
    setBusyId(id);
    try {
      await completeChallenge(id, meUid);
      await refresh();
    } catch { /* silent */ } finally { setBusyId(null); }
  }

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
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>⚔️</span>
        <span className="sb-body" style={{ fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>
          {t.arenaDashStripTitle || "Your pacts"}
        </span>
        <span className="sb-pill sb-pill-accent" style={{ flexShrink: 0 }}>
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
              <div key={c.id} className="sb-list-row" style={{ padding: "10px 14px" }}>
                <button
                  type="button"
                  onClick={() => onOpenSocial && onOpenSocial(c.id)}
                  className="press"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                    background: "transparent",
                    border: "none",
                    color: "var(--color-text)",
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    className="sb-body"
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
                </button>
                {completedToday ? (
                  <span className="sb-pill sb-pill-success" style={{ flexShrink: 0 }}>
                    ✓ {t.arenaDashDone || "done"}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => handleComplete(c.id)}
                    className="sb-tinted-btn press"
                    style={{ flexShrink: 0, padding: "6px 12px", fontSize: 13 }}
                  >
                    {busyId === c.id ? "…" : (t.arenaDashTick || "Tick")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
