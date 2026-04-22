import { useCallback, useEffect, useState } from "react";
import { fetchFriends, fetchIncomingFriendRequests, removeFriend, respondToFriendRequest } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import Alert from "./Alert";

export default function FriendsTab({ authUser, t, onOpenProfile, onSwitchToWeekly }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null); // {username, displayName}

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
    } catch { /* swallow */ } finally { setBusy(false); }
  }

  async function doRemove(username) {
    setBusy(true);
    try {
      await removeFriend(meUid, username);
      await refresh();
    } catch { /* swallow */ } finally { setBusy(false); setConfirmRemove(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {requests.length > 0 && (
        <>
          <h3 className="section-header">
            📬 {t.socialIncomingRequestsTitle || "Incoming requests"} ({requests.length})
          </h3>
          <div className="list">
            {requests.map((r) => (
              <RequestRow key={r.requestId} request={r} busy={busy} t={t} onRespond={handleRespond} onOpenProfile={onOpenProfile} />
            ))}
          </div>
        </>
      )}

      <h3 className="section-header">
        🤝 {t.socialFriendsListTitle || "My friends"} ({friends.length})
      </h3>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
          <div className="spinner" />
        </div>
      ) : friends.length === 0 ? (
        <EmptyFriends t={t} onDiscover={onSwitchToWeekly} />
      ) : (
        <div className="list">
          {friends.map((f) => (
            <FriendRow
              key={f.username}
              friend={f}
              busy={busy}
              t={t}
              onOpenProfile={onOpenProfile}
              onRemoveRequest={() => setConfirmRemove({ username: f.username, displayName: f.displayName || f.username })}
            />
          ))}
        </div>
      )}

      {confirmRemove && (
        <Alert
          icon="🗑"
          title={t.socialConfirmRemoveFriendTitle || "Remove from friends?"}
          message={(t.socialConfirmRemoveFriendDesc || "{name} will no longer see you on the board. You can send a new request later.").replace("{name}", confirmRemove.displayName)}
          cancelLabel={t.cancel || "Cancel"}
          confirmLabel={t.socialRemove || "Remove"}
          destructive
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => doRemove(confirmRemove.username)}
        />
      )}
    </div>
  );
}

function RequestRow({ request: r, busy, t, onRespond, onOpenProfile }) {
  return (
    <div className="list-row">
      <button type="button" onClick={() => onOpenProfile(r.from.username)} className="press" style={{ background: "transparent", border: "none", padding: 0, borderRadius: 10 }}>
        <StreakFrame streak={r.from.streak} size={40} ringWidth={2}>
          <Avatar photoUrl={r.from.photoUrl} displayName={r.from.displayName} size={40} />
        </StreakFrame>
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(r.from.username)}
        className="press"
        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: "4px 6px", borderRadius: 8, color: "var(--color-text)", fontFamily: "inherit" }}
      >
        <p className="body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {r.from.displayName || r.from.username}
        </p>
        <p className="caption">{t.socialLevelLabel || "Lv"} {r.from.level} · 🔥 {r.from.streak}</p>
      </button>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond(r.requestId, "accept")}
          className="press"
          style={circleBtn("accept")}
          aria-label={t.socialAcceptRequest || "Accept"}
        >
          ✓
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond(r.requestId, "decline")}
          className="press"
          style={circleBtn("decline")}
          aria-label={t.socialDeclineRequest || "Decline"}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function FriendRow({ friend: f, busy, t, onOpenProfile, onRemoveRequest }) {
  return (
    <div className="list-row">
      <button type="button" onClick={() => onOpenProfile(f.username)} className="press" style={{ background: "transparent", border: "none", padding: 0, borderRadius: 10 }}>
        <StreakFrame streak={f.streak} size={40} ringWidth={2}>
          <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={40} />
        </StreakFrame>
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(f.username)}
        className="press"
        style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: "4px 6px", borderRadius: 8, color: "var(--color-text)", fontFamily: "inherit" }}
      >
        <p className="body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {f.displayName || f.username}
        </p>
        <p className="caption" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{t.socialLevelLabel || "Lv"} {f.level}</span>
          <span>🔥 {f.streak}</span>
          {typeof f.weeklyXp === "number" && <span>⚡ {f.weeklyXp}/{t.socialWeekShort || "wk"}</span>}
        </p>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRemoveRequest}
        className="icon-btn press"
        aria-label={t.socialRemoveFriend || "Remove friend"}
        style={{ flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}

function EmptyFriends({ t, onDiscover }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 20px 32px", background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14 }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
      <p className="headline" style={{ marginBottom: 4 }}>
        {t.socialFriendsEmptyTitle || "Your circle is empty."}
      </p>
      <p className="subhead" style={{ lineHeight: 1.4, maxWidth: 300, margin: "0 auto 16px" }}>
        {t.socialFriendsEmpty || "Find players on the weekly leaderboard or search by nickname — then tap Add friend."}
      </p>
      {onDiscover && (
        <button type="button" onClick={onDiscover} className="btn-tinted press">
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
    justifyContent: "center",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
