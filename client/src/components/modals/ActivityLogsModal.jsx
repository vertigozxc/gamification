import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";
import { fetchActivityFeed } from "../../api";
import { fuzzyMatch } from "../../utils/fuzzySearch";
import { IconClose } from "../icons/Icons";
import InputWithClear from "../InputWithClear";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";

// Activity Logs — full-screen sheet that lists every meaningful action
// the user has taken plus relevant server events (achievement unlocks
// and claims, friend changes, challenges, native Event rows). Driven
// by GET /api/users/:username/activity which synthesizes the feed
// from the existing tables; no audit table is required for V1.
//
// Search is substring + fuzzy across `title` and the human-readable
// label of the row's `kind`. Server returns up to 200 items; client
// filters in memory.
function ActivityLogsModal({ open, username, onClose }) {
  const { t, languageId } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const swipeBind = useEdgeSwipeBack(onClose);

  useEffect(() => {
    if (!open || !username) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    setQuery("");
    fetchActivityFeed(username, { limit: 200 })
      .then((resp) => {
        if (cancelled) return;
        setItems(Array.isArray(resp?.items) ? resp.items : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message || (t.activityLoadFailed || "Failed to load activity.")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, username, t]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const enriched = useMemo(() => items.map((item) => ({
    ...item,
    label: kindLabel(item.kind, t),
    icon: kindIcon(item.kind),
    timeText: formatRelative(item.at, languageId, t),
    dateText: formatAbsolute(item.at, languageId)
  })), [items, t, languageId]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return enriched;
    return enriched.filter((it) => {
      const haystack = `${it.label} ${it.title || ""} ${it.subtitle || ""}`;
      return fuzzyMatch(q, haystack);
    });
  }, [enriched, query]);

  if (!open) return null;

  return createPortal(
    <div
      className="logout-confirm-overlay"
      style={{ zIndex: 95, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.78)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      {...swipeBind}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          background: "var(--panel-bg, #0f172a)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)"
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t.activityLogsTitle || "Activity Logs"}
      >
        <div style={{ flexShrink: 0, padding: "14px 16px 12px", borderBottom: "1px solid var(--card-border-idle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2
                className="cinzel"
                style={{
                  color: "var(--color-primary)",
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                📊 {t.activityLogsTitle || "Activity Logs"}
              </h2>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {t.activityLogsHelp || "Everything you've done — completions, achievements, friends, challenges."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeLabel || "Close"}
              className="ui-close-x"
            >
              <IconClose size={16} strokeWidth={2.4} />
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <InputWithClear
              value={query}
              onChange={setQuery}
              placeholder={t.activityLogsSearchPlaceholder || "Search activity…"}
              clearAriaLabel={t.clearLabel || "Clear"}
              inputStyle={{
                padding: "10px 14px",
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--card-border-idle)",
                borderRadius: 12,
                color: "var(--color-text)",
                fontSize: 14
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "10px 16px 18px" }}>
          {error ? (
            <p style={{ textAlign: "center", color: "#fca5a5", margin: "32px 0", fontSize: 13 }}>{error}</p>
          ) : !loading && filtered.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--color-muted)", margin: "32px 0", fontSize: 13 }}>
              {query
                ? (t.activityLogsEmptyQuery || "No matches.")
                : (t.activityLogsEmpty || "No activity yet.")}
            </p>
          ) : (
            // Table-style list: each row is a single line with a small
            // icon, an inline LABEL · title, and the relative time on
            // the right. No per-row card background — rows are
            // separated by a thin divider, so the screen reads as a
            // dense table instead of a stack of fat section blocks.
            // Subtitle (when present) sits on a tight second line in
            // muted text and only adds ~14 px of height to that row.
            <div className="activity-log-table" role="list">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  role="listitem"
                  className="activity-log-row"
                >
                  <span aria-hidden="true" className="activity-log-icon">
                    {item.icon}
                  </span>
                  <div className="activity-log-body">
                    <div className="activity-log-line">
                      <span className="activity-log-label cinzel">{item.label}</span>
                      <span className="activity-log-sep" aria-hidden="true">·</span>
                      <span className="activity-log-title">{item.title}</span>
                    </div>
                    {item.subtitle ? (
                      <span className="activity-log-subtitle">{item.subtitle}</span>
                    ) : null}
                  </div>
                  <span
                    className="activity-log-time"
                    title={item.dateText}
                  >
                    {item.timeText}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Initial-load spinner — same pattern as ReferralsModal so
            both full-screen sheets share one loading look. Shown only
            on the very first fetch (no `data` cached yet) so a later
            in-place refetch doesn't flash the screen. */}
        {open && loading && items.length === 0 ? (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--card-bg, #0f172a) 96%, transparent)",
              backdropFilter: "blur(2px)"
            }}
          >
            <div className="ref-spinner" />
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function kindLabel(kind, t) {
  const map = {
    quest_completed: t.activityKindQuestCompleted || "Quest done",
    achievement_unlocked: t.activityKindAchUnlocked || "Achievement unlocked",
    achievement_claimed: t.activityKindAchClaimed || "Reward claimed",
    friend_added: t.activityKindFriendAdded || "Friend added",
    challenge_joined: t.activityKindChallengeJoined || "Challenge joined",
    challenge_created: t.activityKindChallengeCreated || "Challenge created"
  };
  return map[kind] || (kind || "").replace(/_/g, " ");
}

function kindIcon(kind) {
  const map = {
    quest_completed: "✅",
    achievement_unlocked: "🏆",
    achievement_claimed: "🪙",
    friend_added: "🤝",
    challenge_joined: "⚔️",
    challenge_created: "🚩",
    admin_force_logout_pending: "🔐"
  };
  return map[kind] || "•";
}

function formatRelative(value, languageId, t) {
  if (!value) return "";
  const now = Date.now();
  const ms = now - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t.activityJustNow || "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return (t.activityMinutesAgo || "{n} min ago").replace("{n}", String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return (t.activityHoursAgo || "{n}h ago").replace("{n}", String(hr));
  const d = Math.floor(hr / 24);
  if (d < 7) return (t.activityDaysAgo || "{n}d ago").replace("{n}", String(d));
  return formatAbsolute(value, languageId);
}

function formatAbsolute(value, languageId) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "";
  }
}

export default ActivityLogsModal;
