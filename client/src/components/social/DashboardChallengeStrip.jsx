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
    } catch { /* silent */ } finally { setBusyId(null); }
  }

  if (!loaded || active.length === 0) return null;

  const visible = active.slice(0, 2);
  const extra = active.length - visible.length;
  const tKey = todayKey();

  return (
    <div
      className="social-block"
      style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
    >
      <button
        type="button"
        onClick={() => onOpenSocial && onOpenSocial()}
        className="press"
        style={{ background: "transparent", border: "none", padding: "4px 6px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, color: "var(--color-text)" }}
      >
        <span style={{ fontSize: 16 }}>⚔️</span>
        <span className="caption" style={{ fontWeight: 600, flex: 1, textAlign: "left" }}>
          {t.socialDashboardStripTitle || "Group challenges"} · {active.length}
        </span>
        <span style={{ color: "var(--color-muted)", fontSize: 16 }}>›</span>
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((c) => {
          const completedToday = c.myLastCompletionDayKey === tKey;
          const total = Math.max(1, Number(c.durationDays) || 1);
          const elapsed = Math.min(total, Math.max(0, Math.floor((Date.now() - new Date(c.startedAt).getTime()) / 86400000)));
          return (
            <div
              key={c.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(120,120,128,0.12)" }}
            >
              <button
                type="button"
                onClick={() => onOpenSocial && onOpenSocial(c.id)}
                className="press"
                style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: "4px 6px", borderRadius: 8, color: "var(--color-text)", fontFamily: "inherit" }}
              >
                <p className="body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                  {c.title}
                </p>
                <p className="caption" style={{ display: "flex", gap: 8, marginTop: 1 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🎯 {c.questTitle}</span>
                  <span style={{ flexShrink: 0 }}>🔥 {c.myConsecutiveDays || 0}</span>
                  <span style={{ flexShrink: 0 }}>· {elapsed}/{total}{t.dayAbbrev || "d"}</span>
                </p>
              </button>

              {completedToday ? (
                <span className="pill pill-success" style={{ flexShrink: 0 }}>
                  ✓ {t.socialDoneToday || "Done"}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => handleComplete(c.id)}
                  className="btn-tinted press"
                  style={{ flexShrink: 0, padding: "5px 10px", fontSize: 13 }}
                >
                  {busyId === c.id ? "…" : (t.socialMarkDoneShort || "Mark")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {extra > 0 && (
        <button
          type="button"
          onClick={() => onOpenSocial && onOpenSocial()}
          className="btn-ghost press"
          style={{ alignSelf: "center", padding: "4px 8px", fontSize: 13 }}
        >
          {(t.socialDashboardStripMore || "+{n} more").replace("{n}", String(extra))}
        </button>
      )}
    </div>
  );
}
