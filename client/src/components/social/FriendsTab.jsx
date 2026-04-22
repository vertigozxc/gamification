import { useCallback, useEffect, useState } from "react";
import { fetchFriends, fetchIncomingFriendRequests, removeFriend, respondToFriendRequest } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import { haptic, useSwipeAction } from "./iosNav";

export default function FriendsTab({ authUser, t, onOpenProfile, onSwitchToWeekly }) {
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
    haptic(response === "accept" ? "success" : "light");
    try {
      await respondToFriendRequest(meUid, requestId, response);
      await refresh();
    } catch { haptic("warning"); } finally { setBusy(false); }
  }

  async function handleRemove(username, { skipConfirm = false } = {}) {
    if (!skipConfirm && !window.confirm(t.socialConfirmRemoveFriend || "Remove this friend?")) return;
    setBusy(true);
    haptic("warning");
    try {
      await removeFriend(meUid, username);
      await refresh();
    } catch { /* swallow */ } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {requests.length > 0 && (
        <>
          <h3 className="ios-section-header">
            📬 {t.socialIncomingRequestsTitle || "Incoming requests"} ({requests.length})
          </h3>
          <div className="ios-list">
            {requests.map((r, i) => (
              <RequestRow
                key={r.requestId}
                request={r}
                busy={busy}
                t={t}
                onRespond={handleRespond}
                onOpenProfile={onOpenProfile}
                isLast={i === requests.length - 1}
              />
            ))}
          </div>
        </>
      )}

      <h3 className="ios-section-header">
        🤝 {t.socialFriendsListTitle || "My friends"} ({friends.length})
      </h3>

      {loading ? (
        <p style={{ textAlign: "center", padding: "24px 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
      ) : friends.length === 0 ? (
        <EmptyFriends t={t} onDiscover={onSwitchToWeekly} />
      ) : (
        <div className="ios-list">
          {friends.map((f, i) => (
            <FriendRow
              key={f.username}
              friend={f}
              busy={busy}
              t={t}
              onOpenProfile={onOpenProfile}
              onRemove={handleRemove}
              isLast={i === friends.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({ request: r, busy, t, onRespond, onOpenProfile, isLast }) {
  return (
    <div
      className="ios-list-row"
      style={{ borderBottom: isLast ? "none" : undefined }}
    >
      <button
        type="button"
        onClick={() => onOpenProfile(r.from.username)}
        className="ios-tap"
        style={{ background: "transparent", border: "none", padding: 0 }}
      >
        <StreakFrame streak={r.from.streak} size={40} ringWidth={2}>
          <Avatar photoUrl={r.from.photoUrl} displayName={r.from.displayName} size={40} />
        </StreakFrame>
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(r.from.username)}
        className="ios-tap"
        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: 0, color: "var(--color-text)" }}
      >
        <p className="ios-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {r.from.displayName || r.from.username}
        </p>
        <p className="ios-caption">{t.socialLevelLabel || "Lv"} {r.from.level} · 🔥 {r.from.streak}</p>
      </button>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond(r.requestId, "accept")}
          className="ios-tap"
          style={circleBtn("accept")}
          aria-label={t.socialAcceptRequest || "Accept"}
        >
          ✓
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond(r.requestId, "decline")}
          className="ios-tap"
          style={circleBtn("decline")}
          aria-label={t.socialDeclineRequest || "Decline"}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function FriendRow({ friend: f, busy, t, onOpenProfile, onRemove, isLast }) {
  const { rowProps, offset, revealed, close } = useSwipeAction({
    actionWidth: 92,
    onCommit: () => onRemove(f.username, { skipConfirm: true })
  });

  return (
    <div className="swipe-row" style={{ borderBottom: isLast ? "none" : "1px solid var(--panel-border)" }}>
      <div className="swipe-row-bg" style={{ width: 92 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => { close(); onRemove(f.username); }}
          className="swipe-row-action ios-tap"
          style={{ width: "100%" }}
          aria-label={t.socialRemoveFriend || "Remove"}
        >
          {t.socialRemove || "Remove"}
        </button>
      </div>
      <div
        className="swipe-row-content ios-list-row"
        {...rowProps}
        style={{ transform: `translateX(${-offset}px)` }}
      >
        <button
          type="button"
          onClick={() => { if (revealed) { close(); return; } onOpenProfile(f.username); }}
          className="ios-tap"
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          <StreakFrame streak={f.streak} size={40} ringWidth={2}>
            <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={40} />
          </StreakFrame>
        </button>
        <button
          type="button"
          onClick={() => { if (revealed) { close(); return; } onOpenProfile(f.username); }}
          className="ios-tap"
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: 0, color: "var(--color-text)" }}
        >
          <p className="ios-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
            {f.displayName || f.username}
          </p>
          <p className="ios-caption" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{t.socialLevelLabel || "Lv"} {f.level}</span>
            <span>🔥 {f.streak}</span>
            {typeof f.weeklyXp === "number" && <span>⚡ {f.weeklyXp}/{t.socialWeekShort || "wk"}</span>}
          </p>
        </button>
      </div>
    </div>
  );
}

function EmptyFriends({ t, onDiscover }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 20px 32px", background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14 }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
      <p className="ios-headline" style={{ marginBottom: 4 }}>
        {t.socialFriendsEmptyTitle || "Your circle is empty."}
      </p>
      <p className="ios-subhead" style={{ lineHeight: 1.4, maxWidth: 300, margin: "0 auto 16px" }}>
        {t.socialFriendsEmpty || "Find players on the weekly leaderboard or search by nickname — then tap Add friend."}
      </p>
      {onDiscover && (
        <button type="button" onClick={onDiscover} className="ios-btn-tinted ios-tap">
          🔍 {t.socialDiscoverPlayers || "Discover players"}
        </button>
      )}
    </div>
  );
}

function circleBtn(kind) {
  const isAccept = kind === "accept";
  return {
    width: 34,
    height: 34,
    borderRadius: "50%",
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    background: isAccept ? "rgba(48,209,88,0.18)" : "rgba(255,59,48,0.14)",
    color: isAccept ? "#30d158" : "#ff453a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };
}
