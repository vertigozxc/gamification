import { useCallback, useEffect, useState } from "react";
import { fetchFriends, fetchIncomingFriendRequests, respondToFriendRequest, removeFriend } from "../../api";
import StreakFrame from "./StreakFrame";
import Avatar from "./Avatar";

export default function FriendsTab({ authUser, t, onOpenProfile }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!meUid) return;
    try {
      const [fRes, rRes] = await Promise.all([fetchFriends(meUid), fetchIncomingFriendRequests(meUid)]);
      setFriends(fRes?.friends || []);
      setRequests(rRes?.requests || []);
    } catch {
      setFriends([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [meUid]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleRespond(requestId, response) {
    setBusy(true);
    try {
      await respondToFriendRequest(meUid, requestId, response);
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(theirUsername) {
    if (!window.confirm(t.socialConfirmRemoveFriend || "Remove this friend?")) return;
    setBusy(true);
    try {
      await removeFriend(meUid, theirUsername);
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* Incoming requests */}
      {requests.length > 0 && (
        <section>
          <SectionHeading icon="📬" title={`${t.socialIncomingRequestsTitle || "Incoming requests"} · ${requests.length}`} />
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {requests.map((r) => (
              <li
                key={r.requestId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.55rem 0.7rem",
                  borderRadius: "0.65rem",
                  background: "rgba(var(--color-primary-rgb,251,191,36),0.08)",
                  border: "1px solid rgba(var(--color-primary-rgb,251,191,36),0.3)"
                }}
              >
                <button type="button" onClick={() => onOpenProfile(r.from.username)} style={buttonResetStyle}>
                  <StreakFrame streak={r.from.streak} size={36} ringWidth={2}>
                    <Avatar photoUrl={r.from.photoUrl} displayName={r.from.displayName} size={36} />
                  </StreakFrame>
                </button>
                <button type="button" onClick={() => onOpenProfile(r.from.username)} style={{ ...buttonResetStyle, flex: 1, minWidth: 0, textAlign: "left" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.from.displayName || r.from.username}
                  </p>
                  <p style={{ fontSize: "0.66rem", color: "var(--color-muted)" }}>
                    {t.socialLevelLabel || "Lv"} {r.from.level} · 🔥 {r.from.streak}
                  </p>
                </button>
                <button type="button" disabled={busy} onClick={() => handleRespond(r.requestId, "accept")} style={actionBtn("accept")}>
                  {t.socialAcceptRequest || "Accept"}
                </button>
                <button type="button" disabled={busy} onClick={() => handleRespond(r.requestId, "decline")} style={actionBtn("decline")}>
                  {t.socialDeclineRequest || "Decline"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Friends list */}
      <section>
        <SectionHeading icon="🤝" title={`${t.socialFriendsListTitle || "My friends"} · ${friends.length}`} />
        {loading ? (
          <p style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
        ) : friends.length === 0 ? (
          <p style={{ textAlign: "center", padding: "1.5rem 0.75rem", color: "var(--color-muted)" }}>
            {t.socialFriendsEmpty || "No friends yet. Find players on the weekly leaderboard or search by nickname."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {friends.map((f) => (
              <li
                key={f.username}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.55rem 0.7rem",
                  borderRadius: "0.65rem",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid var(--panel-border)"
                }}
              >
                <button type="button" onClick={() => onOpenProfile(f.username)} style={buttonResetStyle}>
                  <StreakFrame streak={f.streak} size={36} ringWidth={2}>
                    <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={36} />
                  </StreakFrame>
                </button>
                <button type="button" onClick={() => onOpenProfile(f.username)} style={{ ...buttonResetStyle, flex: 1, minWidth: 0, textAlign: "left" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.86rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.displayName || f.username}
                  </p>
                  <p style={{ fontSize: "0.66rem", color: "var(--color-muted)", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    <span>{t.socialLevelLabel || "Lv"} {f.level}</span>
                    <span>🔥 {f.streak}</span>
                    <span>· {t.socialWeekXpLabel || "XP"}/{t.socialWeekShort || "wk"}: {f.weeklyXp || 0}</span>
                  </p>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(f.username)}
                  aria-label={t.socialRemoveFriend || "Remove friend"}
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    color: "var(--color-text)",
                    borderRadius: "0.45rem",
                    padding: "0.35rem 0.55rem",
                    fontSize: "0.75rem",
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const buttonResetStyle = { background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--color-text)" };

function actionBtn(kind) {
  return {
    padding: "0.38rem 0.55rem",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderRadius: "0.45rem",
    cursor: "pointer",
    border: kind === "accept" ? "1px solid rgba(34,197,94,0.55)" : "1px solid var(--panel-border)",
    background: kind === "accept" ? "rgba(34,197,94,0.2)" : "rgba(0,0,0,0.25)",
    color: "var(--color-text)"
  };
}

function SectionHeading({ icon, title }) {
  return (
    <h3
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.45rem",
        fontSize: "0.68rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--color-primary-dim)",
        fontWeight: 700,
        margin: "0 0 0.45rem 0.25rem"
      }}
    >
      <span>{icon}</span>
      <span>{title}</span>
    </h3>
  );
}
