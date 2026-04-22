import { useCallback, useEffect, useState } from "react";
import { completeChallenge, fetchUserChallenges } from "../../api";

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Minimal inline strip on the dashboard: up to 2 active challenges with
// a quick "mark done" button when the user hasn't ticked it off today yet.
// Renders nothing when the user has no active challenges.
export default function DashboardChallengeStrip({ authUser, t, onOpenSocial }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [active, setActive] = useState([]);
  const [loaded, setLoaded] = useState(false);
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

  async function handleComplete(id) {
    setBusyId(id);
    try {
      await completeChallenge(id, meUid);
      await refresh();
    } catch {
      // silent — social tab surfaces errors properly
    } finally {
      setBusyId(null);
    }
  }

  if (!loaded || active.length === 0) return null;

  const visible = active.slice(0, 2);
  const extra = active.length - visible.length;
  const tKey = todayKey();

  return (
    <div
      style={{
        padding: "0.7rem 0.75rem",
        background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.1), rgba(0,0,0,0.22))",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.7rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      }}
    >
      <button
        type="button"
        onClick={() => onOpenSocial && onOpenSocial()}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.45rem",
          color: "var(--color-text)"
        }}
      >
        <span style={{ fontSize: "0.9rem" }}>⚔️</span>
        <span style={{ fontSize: "0.64rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700, flex: 1, textAlign: "left" }}>
          {t.socialDashboardStripTitle || "Group challenges"} · {active.length}
        </span>
        <span style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>›</span>
      </button>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {visible.map((c) => {
          const completedToday = c.myLastCompletionDayKey === tKey;
          const total = Math.max(1, Number(c.durationDays) || 1);
          const elapsed = Math.min(
            total,
            Math.max(0, Math.floor((Date.now() - new Date(c.startedAt).getTime()) / 86400000))
          );
          return (
            <li
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.45rem 0.55rem",
                borderRadius: "0.5rem",
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--panel-border)"
              }}
            >
              <button
                type="button"
                onClick={() => onOpenSocial && onOpenSocial(c.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--color-text)"
                }}
              >
                <p style={{ fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.title}
                </p>
                <p style={{ fontSize: "0.64rem", color: "var(--color-muted)", display: "flex", gap: "0.5rem", marginTop: 1 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🎯 {c.questTitle}</span>
                  <span style={{ flexShrink: 0 }}>🔥 {c.myConsecutiveDays || 0}</span>
                  <span style={{ flexShrink: 0 }}>· {elapsed}/{total}{t.dayAbbrev || "d"}</span>
                </p>
              </button>

              {completedToday ? (
                <span
                  style={{
                    flexShrink: 0,
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "#22c55e",
                    background: "rgba(34,197,94,0.14)",
                    border: "1px solid rgba(34,197,94,0.45)",
                    borderRadius: 999,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase"
                  }}
                >
                  ✓ {t.socialDoneToday || "Done"}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => handleComplete(c.id)}
                  style={{
                    flexShrink: 0,
                    padding: "0.35rem 0.65rem",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    background: "rgba(var(--color-primary-rgb,251,191,36),0.22)",
                    border: "1px solid rgba(var(--color-primary-rgb,251,191,36),0.55)",
                    borderRadius: "0.4rem",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap"
                  }}
                >
                  {busyId === c.id ? "…" : (t.socialMarkDoneShort || "Mark")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {extra > 0 && (
        <button
          type="button"
          onClick={() => onOpenSocial && onOpenSocial()}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: "0.66rem",
            color: "var(--color-muted)",
            textAlign: "center",
            fontWeight: 600
          }}
        >
          {(t.socialDashboardStripMore || "+{n} more").replace("{n}", String(extra))}
        </button>
      )}
    </div>
  );
}
