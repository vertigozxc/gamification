import { useEffect, useState } from "react";
import CityIsometricOverview from "../CityIsometricOverview";
import {
  cancelFriendRequest,
  fetchFriendRelation,
  fetchPublicProfile,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest
} from "../../api";
import Avatar from "./Avatar";
import StreakFrame, { getStreakTier } from "./StreakFrame";

function parseDistrictLevels(str) {
  return String(str || "0,0,0,0,0")
    .split(",")
    .map((v) => Math.max(0, Math.min(5, Math.floor(Number(v) || 0))))
    .concat([0, 0, 0, 0, 0])
    .slice(0, 5);
}

function formatDate(value, languageId) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "—";
  }
}

export default function PublicProfileModal({ targetUsername, meUsername, t, languageId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [relation, setRelation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const [p, r] = await Promise.all([
        fetchPublicProfile(targetUsername),
        meUsername ? fetchFriendRelation(meUsername, targetUsername) : Promise.resolve(null)
      ]);
      setProfile(p?.user || null);
      setRelation(r || null);
    } catch (e) {
      setError(e?.message || t.socialErrorLoad || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUsername, meUsername]);

  async function act(fn) {
    if (!meUsername) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e?.message || t.socialErrorGeneric || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const state = relation?.state;
  const isSelf = state === "self";

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.2rem 0.2rem 0.4rem",
            flexShrink: 0
          }}
        >
          <div style={{ width: 30 }} />
          <span style={{ fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
            {t.socialProfileLabel || "Player profile"}
          </span>
          <button type="button" onClick={onClose} aria-label={t.close || "Close"} style={closeBtnStyle}>✕</button>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--color-muted)", padding: "2rem 0" }}>
            {t.socialLoading || "Loading…"}
          </p>
        ) : !profile ? (
          <p style={{ textAlign: "center", color: "var(--color-danger,#f87171)", padding: "2rem 0" }}>
            {error || t.socialErrorLoad || "Failed to load profile"}
          </p>
        ) : (
          <>
            {/* scrollable body */}
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.85rem", paddingBottom: "0.3rem" }}>
              <Hero profile={profile} t={t} />
              <StatGrid profile={profile} t={t} languageId={languageId} />
              <CityCard profile={profile} t={t} />
              {error && (
                <p style={{ fontSize: "0.8rem", color: "var(--color-danger,#f87171)", textAlign: "center" }}>{error}</p>
              )}
            </div>

            {/* Sticky action bar */}
            {!isSelf && meUsername && (
              <div
                style={{
                  flexShrink: 0,
                  paddingTop: "0.65rem",
                  borderTop: "1px solid var(--panel-border)",
                  marginTop: "0.2rem"
                }}
              >
                <FriendshipAction
                  state={state}
                  relation={relation}
                  busy={busy}
                  t={t}
                  onAdd={() => act(() => sendFriendRequest(meUsername, targetUsername))}
                  onCancel={() => act(() => cancelFriendRequest(meUsername, targetUsername))}
                  onAccept={() => act(() => respondToFriendRequest(meUsername, relation.requestId, "accept"))}
                  onDecline={() => act(() => respondToFriendRequest(meUsername, relation.requestId, "decline"))}
                  onRemove={() => act(() => removeFriend(meUsername, targetUsername))}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Hero({ profile, t }) {
  const tier = getStreakTier(profile.streak);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "0.5rem",
        padding: "0.25rem 0.35rem 0.45rem"
      }}
    >
      <StreakFrame streak={profile.streak} size={96} ringWidth={5}>
        <Avatar photoUrl={profile.photoUrl} displayName={profile.displayName} size={96} />
      </StreakFrame>
      <h2
        className="cinzel"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "var(--color-text)",
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {profile.displayName}
      </h2>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Pill
          icon="⭐"
          text={`${t.socialLevelLabelFull || "Level"} ${profile.level}`}
          accent="var(--color-primary)"
        />
        {tier.label && (
          <Pill
            icon={tier.icon}
            text={(t.socialTierLabels && t.socialTierLabels[tier.name]) || tier.label}
            accent={tier.name === "gold" ? "#fbbf24" : tier.name === "diamond" ? "#c4b5fd" : tier.name === "silver" ? "#d1d5db" : "#d97706"}
          />
        )}
      </div>
    </div>
  );
}

function StatGrid({ profile, t, languageId }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.45rem"
      }}
    >
      <BigStat icon="🔥" label={t.socialStreakLabel || "Current streak"} value={profile.streak || 0} accent="#f97316" />
      <BigStat icon="🏆" label={t.socialMaxStreakLabel || "Best streak"} value={profile.maxStreak || 0} accent="#fbbf24" />
      <BigStat icon="⚡" label={t.socialWeeklyXpStatLabel || "XP this week"} value={profile.weeklyXp || 0} accent="var(--color-primary)" />
      <BigStat icon="🤝" label={t.socialFriendsCountLabel || "Friends"} value={profile.friendCount || 0} accent="var(--color-text)" />
      <BigStat
        icon="📅"
        label={t.socialJoinedLabel || "Joined"}
        value={formatDate(profile.createdAt, languageId)}
        accent="var(--color-text)"
        small
        span={2}
      />
    </div>
  );
}

function BigStat({ icon, label, value, accent, small, span }) {
  return (
    <div
      style={{
        gridColumn: span ? `span ${span}` : "auto",
        padding: "0.75rem 0.8rem",
        background: "rgba(0,0,0,0.22)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.65rem",
        display: "flex",
        alignItems: "center",
        gap: "0.6rem"
      }}
    >
      <span style={{ fontSize: "1.2rem" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
          {label}
        </p>
        <p
          style={{
            fontSize: small ? "0.82rem" : "1.15rem",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            color: accent,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function CityCard({ profile, t }) {
  const levels = parseDistrictLevels(profile.districtLevels);
  const sum = levels.reduce((acc, n) => acc + n, 0);
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.25)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.7rem",
        padding: "0.55rem",
        overflow: "hidden"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
        <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
          {t.socialCityLabel || "City"}
        </p>
        <p style={{ fontSize: "0.66rem", color: "var(--color-muted)", fontWeight: 600 }}>
          {(t.socialCitySum || "Districts: {n}/25").replace("{n}", String(sum))}
        </p>
      </div>
      <div style={{ aspectRatio: "1 / 1", width: "100%", pointerEvents: "none" }}>
        <CityIsometricOverview levels={levels} selectedIdx={-1} t={t} />
      </div>
    </div>
  );
}

function Pill({ icon, text, accent }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.22rem 0.6rem",
        borderRadius: 999,
        background: "rgba(0,0,0,0.28)",
        border: "1px solid var(--panel-border)",
        fontSize: "0.72rem",
        fontWeight: 700,
        color: accent,
        whiteSpace: "nowrap"
      }}
    >
      <span style={{ fontSize: "0.85rem" }}>{icon}</span>
      {text}
    </span>
  );
}

function FriendshipAction({ state, busy, t, onAdd, onCancel, onAccept, onDecline, onRemove }) {
  const base = {
    width: "100%",
    padding: "0.75rem",
    borderRadius: "0.6rem",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "0.82rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: busy ? "wait" : "pointer",
    border: "1px solid var(--panel-border)",
    color: "var(--color-text)"
  };

  if (state === "friends") {
    return (
      <button type="button" disabled={busy} onClick={onRemove} style={{ ...base, background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.5)" }}>
        {t.socialRemoveFriend || "Remove friend"}
      </button>
    );
  }
  if (state === "outgoing_pending") {
    return (
      <button type="button" disabled={busy} onClick={onCancel} style={{ ...base, opacity: 0.75, background: "rgba(255,255,255,0.05)" }}>
        {t.socialPending || "Request sent · tap to cancel"}
      </button>
    );
  }
  if (state === "incoming_pending") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <button type="button" disabled={busy} onClick={onAccept} style={{ ...base, background: "rgba(34,197,94,0.22)", borderColor: "rgba(34,197,94,0.55)" }}>
          {t.socialAcceptRequest || "Accept"}
        </button>
        <button type="button" disabled={busy} onClick={onDecline} style={{ ...base, background: "rgba(0,0,0,0.3)" }}>
          {t.socialDeclineRequest || "Decline"}
        </button>
      </div>
    );
  }
  if (state === "declined_by_them") {
    return (
      <button type="button" disabled style={{ ...base, opacity: 0.5, cursor: "not-allowed" }}>
        {t.socialDeclinedByThem || "Request was declined"}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onAdd}
      style={{
        ...base,
        background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.28), rgba(var(--color-primary-rgb,251,191,36),0.15))",
        borderColor: "rgba(var(--color-primary-rgb,251,191,36),0.6)"
      }}
    >
      ＋ {t.socialAddFriend || "Add friend"}
    </button>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(0,0,0,0.72)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: "1rem 0.75rem"
};

const sheetStyle = {
  width: "100%",
  maxWidth: 520,
  margin: "auto",
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--border-radius-panel)",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  maxHeight: "calc(100svh - 2rem)",
  minHeight: 0
};

const closeBtnStyle = {
  background: "rgba(0,0,0,0.3)",
  color: "var(--color-text)",
  border: "1px solid var(--panel-border)",
  borderRadius: 999,
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};
