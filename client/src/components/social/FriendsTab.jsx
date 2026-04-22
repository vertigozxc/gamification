import { useCallback, useEffect, useState } from "react";
import { fetchFriends, fetchIncomingFriendRequests, removeFriend, respondToFriendRequest } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";

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
    try {
      await respondToFriendRequest(meUid, requestId, response);
      await refresh();
    } catch {
      // swallow
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(username) {
    if (!window.confirm(t.socialConfirmRemoveFriend || "Remove this friend?")) return;
    setBusy(true);
    try {
      await removeFriend(meUid, username);
      await refresh();
    } catch {
      // swallow
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {requests.length > 0 && (
        <RequestsSection
          requests={requests}
          busy={busy}
          t={t}
          onRespond={handleRespond}
          onOpenProfile={onOpenProfile}
        />
      )}

      <FriendsSection
        friends={friends}
        loading={loading}
        busy={busy}
        t={t}
        onOpenProfile={onOpenProfile}
        onRemove={handleRemove}
        onDiscover={onSwitchToWeekly}
      />
    </div>
  );
}

function RequestsSection({ requests, busy, t, onRespond, onOpenProfile }) {
  return (
    <section
      style={{
        padding: "0.8rem",
        borderRadius: "0.75rem",
        background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.16), rgba(var(--color-primary-rgb,251,191,36),0.04))",
        border: "1px solid rgba(var(--color-primary-rgb,251,191,36),0.45)"
      }}
    >
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.68rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--color-primary)",
          fontWeight: 700,
          margin: "0 0 0.6rem 0.05rem"
        }}
      >
        <span>📬</span>
        <span>{t.socialIncomingRequestsTitle || "Incoming requests"} · {requests.length}</span>
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {requests.map((r) => (
          <li
            key={r.requestId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.55rem 0.65rem",
              borderRadius: "0.55rem",
              background: "rgba(0,0,0,0.28)",
              border: "1px solid var(--panel-border)"
            }}
          >
            <button type="button" onClick={() => onOpenProfile(r.from.username)} style={btnReset}>
              <StreakFrame streak={r.from.streak} size={36} ringWidth={2}>
                <Avatar photoUrl={r.from.photoUrl} displayName={r.from.displayName} size={36} />
              </StreakFrame>
            </button>
            <button type="button" onClick={() => onOpenProfile(r.from.username)} style={{ ...btnReset, flex: 1, minWidth: 0, textAlign: "left" }}>
              <p style={{ fontWeight: 600, fontSize: "0.86rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.from.displayName || r.from.username}
              </p>
              <p style={{ fontSize: "0.66rem", color: "var(--color-muted)" }}>
                {t.socialLevelLabel || "Lv"} {r.from.level} · 🔥 {r.from.streak}
              </p>
            </button>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <button type="button" disabled={busy} onClick={() => onRespond(r.requestId, "accept")} style={actionBtn("accept")}>
                ✓
              </button>
              <button type="button" disabled={busy} onClick={() => onRespond(r.requestId, "decline")} style={actionBtn("decline")}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FriendsSection({ friends, loading, busy, t, onOpenProfile, onRemove, onDiscover }) {
  return (
    <section>
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.68rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--color-primary-dim)",
          fontWeight: 700,
          margin: "0.15rem 0 0.5rem 0.1rem"
        }}
      >
        <span>🤝</span>
        <span>{t.socialFriendsListTitle || "My friends"} · {friends.length}</span>
      </h3>

      {loading ? (
        <p style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
      ) : friends.length === 0 ? (
        <EmptyFriends t={t} onDiscover={onDiscover} />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {friends.map((f) => (
            <FriendRow key={f.username} friend={f} busy={busy} t={t} onOpenProfile={onOpenProfile} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FriendRow({ friend, busy, t, onOpenProfile, onRemove }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.55rem 0.65rem",
        borderRadius: "0.65rem",
        background: "rgba(0,0,0,0.22)",
        border: "1px solid var(--panel-border)"
      }}
    >
      <button type="button" onClick={() => onOpenProfile(friend.username)} style={btnReset}>
        <StreakFrame streak={friend.streak} size={38} ringWidth={2}>
          <Avatar photoUrl={friend.photoUrl} displayName={friend.displayName} size={38} />
        </StreakFrame>
      </button>
      <button
        type="button"
        onClick={() => onOpenProfile(friend.username)}
        style={{ ...btnReset, flex: 1, minWidth: 0, textAlign: "left" }}
      >
        <p style={{ fontWeight: 600, fontSize: "0.86rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {friend.displayName || friend.username}
        </p>
        <p style={{ fontSize: "0.64rem", color: "var(--color-muted)", display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: 1 }}>
          <span>{t.socialLevelLabel || "Lv"} {friend.level}</span>
          <span>🔥 {friend.streak}</span>
          {typeof friend.weeklyXp === "number" && <span>⚡ {friend.weeklyXp}/{t.socialWeekShort || "wk"}</span>}
        </p>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRemove(friend.username)}
        aria-label={t.socialRemoveFriend || "Remove friend"}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid var(--panel-border)",
          color: "var(--color-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.85rem"
        }}
      >
        ✕
      </button>
    </li>
  );
}

function EmptyFriends({ t, onDiscover }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "1.75rem 1rem 2rem",
        background: "rgba(0,0,0,0.18)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.75rem"
      }}
    >
      <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>🌱</div>
      <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text)", marginBottom: "0.3rem" }}>
        {t.socialFriendsEmptyTitle || "Your circle is empty."}
      </p>
      <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", lineHeight: 1.4, maxWidth: 280, margin: "0 auto 0.85rem" }}>
        {t.socialFriendsEmpty || "Find players on the weekly leaderboard or search by nickname — then tap Add friend."}
      </p>
      {onDiscover && (
        <button
          type="button"
          onClick={onDiscover}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(var(--color-primary-rgb,251,191,36),0.18)",
            border: "1px solid rgba(var(--color-primary-rgb,251,191,36),0.5)",
            color: "var(--color-text)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer"
          }}
        >
          🔍 {t.socialDiscoverPlayers || "Discover players"}
        </button>
      )}
    </div>
  );
}

const btnReset = { background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--color-text)" };

function actionBtn(kind) {
  return {
    width: 34,
    height: 34,
    borderRadius: "50%",
    fontSize: "0.9rem",
    fontWeight: 700,
    cursor: "pointer",
    border: kind === "accept" ? "1px solid rgba(34,197,94,0.55)" : "1px solid var(--panel-border)",
    background: kind === "accept" ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.12)",
    color: kind === "accept" ? "#22c55e" : "#f87171",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };
}
