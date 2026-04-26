import { useCallback, useEffect, useState } from "react";
import { fetchFriends, fetchIncomingFriendRequests, removeFriend, respondToFriendRequest } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import FramedAvatar from "./FramedAvatar";
import Screen from "./Screen";
import Alert from "./Alert";
import { IconFlame, IconBolt, IconCheck, IconClose } from "../icons/Icons";

export default function FriendsListScreen({ authUser, t, onClose, onOpenProfile, onChanged }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

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

  async function handleRespond(id, response) {
    setBusy(true);
    try {
      await respondToFriendRequest(meUid, id, response);
      await refresh();
      onChanged && onChanged();
    } finally { setBusy(false); }
  }

  async function doRemove(username) {
    setBusy(true);
    try {
      await removeFriend(meUid, username);
      await refresh();
      onChanged && onChanged();
    } finally { setBusy(false); setConfirm(null); }
  }

  return (
    <>
      <Screen
        title={t.arenaCircleScreenTitle || "Friends"}
        subtitle={`${friends.length} · ${requests.length} ${(t.arenaRequestsShort || "pending")}`}
        onClose={onClose}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
            <div className="sb-spinner" />
          </div>
        ) : (
          <>
            {requests.length > 0 && (
              <>
                <h3 className="sb-section-title" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)", margin: "4px 4px 8px" }}>
                  📬 {t.arenaRequestsHeader || "Incoming"}
                </h3>
                <div className="sb-list" style={{ marginBottom: 16 }}>
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

            <h3 className="sb-section-title" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)", margin: "4px 4px 8px" }}>
              🤝 {t.arenaFriendsHeader || "Friends"}
            </h3>
            {friends.length === 0 ? (
              <div className="sb-card" style={{ textAlign: "center", padding: "28px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>🌱</div>
                <p className="sb-headline" style={{ marginBottom: 4 }}>{t.arenaFriendsEmptyTitle || "No friends yet"}</p>
                <p className="sb-caption" style={{ maxWidth: 300, margin: "0 auto" }}>
                  {t.arenaFriendsEmptyBody || "Find someone on the leaderboard and send them an invite."}
                </p>
              </div>
            ) : (
              <div className="sb-list">
                {friends.map((f, i) => (
                  <FriendRow
                    key={f.username}
                    friend={f}
                    busy={busy}
                    t={t}
                    onOpenProfile={onOpenProfile}
                    onRemove={() => setConfirm({ username: f.username, displayName: f.displayName || f.username })}
                    isLast={i === friends.length - 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Screen>

      {confirm && (
        <Alert
          icon="🗑"
          title={(t.arenaConfirmRemoveTitle || "Remove {name}?").replace("{name}", confirm.displayName)}
          message={t.arenaConfirmRemoveBody || "They will disappear from your friends list. You can send a new request later."}
          cancelLabel={t.arenaCancel || "Cancel"}
          confirmLabel={t.arenaRemoveAction || "Remove"}
          destructive
          onCancel={() => setConfirm(null)}
          onConfirm={() => doRemove(confirm.username)}
        />
      )}
    </>
  );
}

function RequestRow({ request: r, busy, t, onRespond, onOpenProfile, isLast }) {
  return (
    <div className="sb-list-row" style={{ borderBottom: isLast ? "none" : undefined }}>
      <button
        type="button"
        onClick={() => onOpenProfile(r.from.username)}
        className="press"
        style={{ background: "transparent", border: "none", padding: 0, borderRadius: 10, cursor: "pointer" }}
      >
        <FramedAvatar
          photoUrl={r.from.photoUrl}
          displayName={r.from.displayName}
          size={40}
          ringWidth={2}
          streak={r.from.streak}
          activeCosmetics={r.from.activeCosmetics}
        />
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(r.from.username)}
        className="press"
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "4px 6px",
          borderRadius: 8,
          color: "var(--color-text)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <p className="sb-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {r.from.displayName || r.from.username}
        </p>
        <p className="sb-caption" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>{t.arenaLvlShort || "Lv"} {r.from.level}</span>
          <span>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><IconFlame size={11} /> {r.from.streak}</span>
        </p>
      </button>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond(r.requestId, "accept")}
          className="press"
          style={circleBtn("accept")}
          aria-label={t.arenaAccept || "Accept"}
        >
          <IconCheck size={16} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond(r.requestId, "decline")}
          className="press"
          style={circleBtn("decline")}
          aria-label={t.arenaDecline || "Decline"}
        >
          <IconClose size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function FriendRow({ friend: f, busy, t, onOpenProfile, onRemove, isLast }) {
  return (
    <div className="sb-list-row" style={{ borderBottom: isLast ? "none" : undefined }}>
      <button
        type="button"
        onClick={() => onOpenProfile(f.username)}
        className="press"
        style={{ background: "transparent", border: "none", padding: 0, borderRadius: 10, cursor: "pointer" }}
      >
        <FramedAvatar
          photoUrl={f.photoUrl}
          displayName={f.displayName}
          size={40}
          ringWidth={2}
          streak={f.streak}
          activeCosmetics={f.activeCosmetics}
        />
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(f.username)}
        className="press"
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "4px 6px",
          borderRadius: 8,
          color: "var(--color-text)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <p className="sb-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {f.displayName || f.username}
        </p>
        <p className="sb-caption" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{t.arenaLvlShort || "Lv"} {f.level}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><IconFlame size={11} /> {f.streak}</span>
          {typeof f.weeklyXp === "number" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><IconBolt size={11} /> {f.weeklyXp}</span>
          )}
        </p>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="sb-icon-btn press"
        aria-label={t.arenaRemoveAction || "Remove"}
        style={{ flexShrink: 0 }}
      >
        <IconClose size={14} strokeWidth={2.4} />
      </button>
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
    background: isAccept ? "rgba(48,209,88,0.18)" : "rgba(255,69,58,0.18)",
    color: isAccept ? "#30d158" : "#ff6a63",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
