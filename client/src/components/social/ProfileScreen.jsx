import { useCallback, useEffect, useState } from "react";
import CityIsometricOverview from "../CityIsometricOverview";
import {
  cancelFriendRequest,
  fetchFriendRelation,
  fetchPublicProfile,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
} from "../../api";
import Avatar from "./Avatar";
import StreakFrame, { getStreakTier } from "./StreakFrame";
import Screen from "./Screen";
import Alert from "./Alert";

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
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ProfileScreen({ targetUsername, meUsername, t, languageId, backLabel, onClose, onChanged }) {
  const [profile, setProfile] = useState(null);
  const [relation, setRelation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [p, r] = await Promise.all([
        fetchPublicProfile(targetUsername),
        meUsername ? fetchFriendRelation(meUsername, targetUsername) : Promise.resolve(null),
      ]);
      setProfile(p?.user || null);
      setRelation(r || null);
    } catch (e) {
      setError(e?.message || t.socialErrorLoad || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [targetUsername, meUsername, t]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  async function act(fn) {
    if (!meUsername) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
      onChanged && onChanged();
    } catch (e) {
      setError(e?.message || t.socialErrorGeneric || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const state = relation?.state;
  const isSelf = state === "self";

  const footer = !loading && profile && !isSelf && meUsername ? (
    <FriendshipAction
      state={state}
      busy={busy}
      t={t}
      onAdd={() => act(() => sendFriendRequest(meUsername, targetUsername))}
      onCancel={() => act(() => cancelFriendRequest(meUsername, targetUsername))}
      onAccept={() => act(() => respondToFriendRequest(meUsername, relation.requestId, "accept"))}
      onDecline={() => act(() => respondToFriendRequest(meUsername, relation.requestId, "decline"))}
      onRemove={() => setConfirmRemove(true)}
    />
  ) : null;

  return (
    <>
      <Screen
        title={profile?.displayName || (t.socialProfileLabel || "Player profile")}
        leftLabel={backLabel || t.back || "Back"}
        onClose={onClose}
        footer={footer}
      >
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div className="spinner" />
          </div>
        ) : !profile ? (
          <p style={{ textAlign: "center", color: "#ff453a", padding: "40px 16px" }}>
            {error || t.socialErrorLoad || "Failed to load profile"}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Hero profile={profile} t={t} />
            <StatGrid profile={profile} t={t} languageId={languageId} />
            <CityCard profile={profile} t={t} />
            {error && <p style={{ fontSize: 14, color: "#ff453a", textAlign: "center" }}>{error}</p>}
          </div>
        )}
      </Screen>
      {confirmRemove && (
        <Alert
          icon="🗑"
          title={t.socialConfirmRemoveFriend || "Remove this friend?"}
          message={t.socialConfirmRemoveFriendDesc || "You can send a new request later."}
          cancelLabel={t.cancel || "Cancel"}
          confirmLabel={t.socialRemove || "Remove"}
          destructive
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            act(() => removeFriend(meUsername, targetUsername));
          }}
        />
      )}
    </>
  );
}

function Hero({ profile, t }) {
  const tier = getStreakTier(profile.streak);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, paddingTop: 6 }}>
      <StreakFrame streak={profile.streak} size={96} ringWidth={5}>
        <Avatar photoUrl={profile.photoUrl} displayName={profile.displayName} size={96} />
      </StreakFrame>
      <h2 className="title" style={{ maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {profile.displayName}
      </h2>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <span className="pill pill-accent">⭐ {t.socialLevelLabelFull || "Level"} {profile.level}</span>
        {tier.label && (
          <span className="pill">
            {tier.icon} {(t.socialTierLabels && t.socialTierLabels[tier.name]) || tier.label}
          </span>
        )}
      </div>
    </div>
  );
}

function StatGrid({ profile, t, languageId }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Stat icon="🔥" label={t.socialStreakLabel || "Current streak"} value={profile.streak || 0} accent="#ff9500" />
      <Stat icon="🏆" label={t.socialMaxStreakLabel || "Best streak"} value={profile.maxStreak || 0} accent="#fbbf24" />
      <Stat icon="⚡" label={t.socialWeeklyXpStatLabel || "XP this week"} value={profile.weeklyXp || 0} accent="var(--color-primary)" />
      <Stat icon="🤝" label={t.socialFriendsCountLabel || "Friends"} value={profile.friendCount || 0} />
      <Stat icon="📅" label={t.socialJoinedLabel || "Joined"} value={formatDate(profile.createdAt, languageId)} span={2} small />
    </div>
  );
}

function Stat({ icon, label, value, accent, span, small }) {
  return (
    <div className="stat" style={{ gridColumn: span ? `span ${span}` : "auto" }}>
      <span className="icon">{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="label">{label}</p>
        <p className="value" style={accent ? { color: accent } : undefined}>
          {small ? <span style={{ fontSize: 15, fontWeight: 600 }}>{value}</span> : value}
        </p>
      </div>
    </div>
  );
}

function CityCard({ profile, t }) {
  const levels = parseDistrictLevels(profile.districtLevels);
  const sum = levels.reduce((acc, n) => acc + n, 0);
  return (
    <div style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 14, padding: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <p className="caption" style={{ fontWeight: 600 }}>{t.socialCityLabel || "City"}</p>
        <p className="caption">{(t.socialCitySum || "Districts: {n}/25").replace("{n}", String(sum))}</p>
      </div>
      <div style={{ aspectRatio: "1 / 1", width: "100%", pointerEvents: "none" }}>
        <CityIsometricOverview levels={levels} selectedIdx={-1} t={t} />
      </div>
    </div>
  );
}

function FriendshipAction({ state, busy, t, onAdd, onCancel, onAccept, onDecline, onRemove }) {
  if (state === "friends") {
    return (
      <button type="button" disabled={busy} onClick={onRemove} className="btn-destructive press" style={{ width: "100%", padding: 14 }}>
        {t.socialRemoveFriend || "Remove friend"}
      </button>
    );
  }
  if (state === "outgoing_pending") {
    return (
      <button type="button" disabled={busy} onClick={onCancel} className="btn-tinted press" style={{ width: "100%", padding: 14 }}>
        {t.socialPending || "Request sent · tap to cancel"}
      </button>
    );
  }
  if (state === "incoming_pending") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" disabled={busy} onClick={onAccept} className="btn-primary press" style={{ padding: 14 }}>
          {t.socialAcceptRequest || "Accept"}
        </button>
        <button type="button" disabled={busy} onClick={onDecline} className="btn-tinted press" style={{ padding: 14 }}>
          {t.socialDeclineRequest || "Decline"}
        </button>
      </div>
    );
  }
  if (state === "declined_by_them") {
    return (
      <button type="button" disabled className="btn-tinted" style={{ width: "100%", padding: 14, opacity: 0.5 }}>
        {t.socialDeclinedByThem || "Request was declined"}
      </button>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={onAdd} className="btn-primary press" style={{ width: "100%", padding: 14 }}>
      ＋ {t.socialAddFriend || "Add friend"}
    </button>
  );
}
