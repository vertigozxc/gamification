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
import { haptic, useIosNav } from "./iosNav";

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

export default function PublicProfileScreen({ targetUsername, meUsername, t, languageId, onRemoved }) {
  const nav = useIosNav();
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

  useEffect(() => { setLoading(true); refresh(); /* eslint-disable-next-line */ }, [targetUsername, meUsername]);

  async function act(fn, { popOnSuccess = false, hapticKind = "light" } = {}) {
    if (!meUsername) return;
    setBusy(true);
    haptic(hapticKind);
    try {
      await fn();
      if (popOnSuccess) {
        onRemoved && onRemoved();
        nav.pop();
      } else {
        await refresh();
      }
    } catch (e) {
      haptic("warning");
      setError(e?.message || t.socialErrorGeneric || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const state = relation?.state;
  const isSelf = state === "self";

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
        <div className="ios-spinner" />
      </div>
    );
  }
  if (!profile) {
    return (
      <p style={{ textAlign: "center", color: "#ff453a", padding: "40px 16px" }}>
        {error || t.socialErrorLoad || "Failed to load profile"}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
      <Hero profile={profile} t={t} />
      <StatGrid profile={profile} t={t} languageId={languageId} />
      <CityCard profile={profile} t={t} />
      {error && <p style={{ fontSize: 14, color: "#ff453a", textAlign: "center" }}>{error}</p>}
      {!isSelf && meUsername && (
        <div style={{ paddingTop: 6 }}>
          <FriendshipAction
            state={state}
            relation={relation}
            busy={busy}
            t={t}
            onAdd={() => act(() => sendFriendRequest(meUsername, targetUsername), { hapticKind: "success" })}
            onCancel={() => act(() => cancelFriendRequest(meUsername, targetUsername))}
            onAccept={() => act(() => respondToFriendRequest(meUsername, relation.requestId, "accept"), { hapticKind: "success" })}
            onDecline={() => act(() => respondToFriendRequest(meUsername, relation.requestId, "decline"))}
            onRemove={() => act(() => removeFriend(meUsername, targetUsername), { hapticKind: "warning" })}
          />
        </div>
      )}
    </div>
  );
}

function Hero({ profile, t }) {
  const tier = getStreakTier(profile.streak);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, paddingTop: 6 }}>
      <StreakFrame streak={profile.streak} size={96} ringWidth={5}>
        <Avatar photoUrl={profile.photoUrl} displayName={profile.displayName} size={96} />
      </StreakFrame>
      <h2 className="ios-title" style={{ maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {profile.displayName}
      </h2>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <span className="ios-pill ios-pill-accent">⭐ {t.socialLevelLabelFull || "Level"} {profile.level}</span>
        {tier.label && (
          <span className="ios-pill">
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
    <div className="ios-stat" style={{ gridColumn: span ? `span ${span}` : "auto" }}>
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
        <p className="ios-caption" style={{ fontWeight: 600 }}>{t.socialCityLabel || "City"}</p>
        <p className="ios-caption">{(t.socialCitySum || "Districts: {n}/25").replace("{n}", String(sum))}</p>
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
      <button type="button" disabled={busy} onClick={onRemove} className="ios-btn-destructive ios-tap" style={{ width: "100%", padding: "12px" }}>
        {t.socialRemoveFriend || "Remove friend"}
      </button>
    );
  }
  if (state === "outgoing_pending") {
    return (
      <button type="button" disabled={busy} onClick={onCancel} className="ios-tap" style={{ width: "100%", padding: 12, border: "none", borderRadius: 12, background: "rgba(120,120,128,0.22)", color: "var(--color-text)", fontSize: 15, fontWeight: 600 }}>
        {t.socialPending || "Request sent · tap to cancel"}
      </button>
    );
  }
  if (state === "incoming_pending") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" disabled={busy} onClick={onAccept} className="ios-tap" style={{ padding: 12, border: "none", borderRadius: 12, background: "rgba(48,209,88,0.2)", color: "#30d158", fontSize: 15, fontWeight: 600 }}>
          {t.socialAcceptRequest || "Accept"}
        </button>
        <button type="button" disabled={busy} onClick={onDecline} className="ios-tap" style={{ padding: 12, border: "none", borderRadius: 12, background: "rgba(120,120,128,0.2)", color: "var(--color-text)", fontSize: 15, fontWeight: 600 }}>
          {t.socialDeclineRequest || "Decline"}
        </button>
      </div>
    );
  }
  if (state === "declined_by_them") {
    return (
      <button type="button" disabled className="ios-btn-tinted" style={{ width: "100%", padding: 12, opacity: 0.5 }}>
        {t.socialDeclinedByThem || "Request was declined"}
      </button>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={onAdd} className="ios-btn-primary ios-tap" style={{ width: "100%", padding: "14px" }}>
      ＋ {t.socialAddFriend || "Add friend"}
    </button>
  );
}
