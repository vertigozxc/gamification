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

export default function ProfileScreen({ targetUsername, meUsername, t, languageId, onClose, onChanged }) {
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
      setError(e?.message || t.arenaLoadError || "Could not load this profile");
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
      setError(e?.message || t.arenaActionError || "Something went wrong");
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
        title={profile?.displayName || (t.arenaProfileTitle || "Profile")}
        subtitle={profile ? "" : (t.arenaLoadingShort || "Loading")}
        onClose={onClose}
        footer={footer}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div className="sb-spinner" />
          </div>
        ) : !profile ? (
          <p style={{ textAlign: "center", color: "#ff6a63", padding: "40px 16px" }}>
            {error || (t.arenaLoadError || "Could not load this profile")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Hero profile={profile} t={t} />
            <StatGrid profile={profile} t={t} languageId={languageId} />
            <CityCard profile={profile} t={t} />
            {error && <p style={{ fontSize: 14, color: "#ff6a63", textAlign: "center" }}>{error}</p>}
          </div>
        )}
      </Screen>

      {confirmRemove && (
        <Alert
          icon="🗑"
          title={(t.arenaConfirmRemoveTitle || "Drop {name}?").replace("{name}", profile?.displayName || "")}
          message={t.arenaConfirmRemoveBody || "They'll disappear from your circle. You can invite them again any time."}
          cancelLabel={t.arenaCancel || "Cancel"}
          confirmLabel={t.arenaRemoveAction || "Drop"}
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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <span className="sb-pill sb-pill-accent">⭐ {t.arenaLvlFull || "Level"} {profile.level}</span>
        {tier.label && (
          <span className="sb-pill">
            {tier.icon} {(t.arenaTierLabels && t.arenaTierLabels[tier.name]) || tier.label}
          </span>
        )}
      </div>
    </div>
  );
}

function StatGrid({ profile, t, languageId }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Stat icon="🔥" label={t.arenaStatStreak || "Current"} value={profile.streak || 0} accent="#ff9500" />
      <Stat icon="🏆" label={t.arenaStatMaxStreak || "Best"} value={profile.maxStreak || 0} accent="#fbbf24" />
      <Stat icon="⚡" label={t.arenaStatWeek || "Week XP"} value={profile.weeklyXp || 0} accent="var(--color-primary)" />
      <Stat icon="🤝" label={t.arenaStatFriends || "Friends"} value={profile.friendCount || 0} />
      <Stat icon="📅" label={t.arenaStatJoined || "Joined"} value={formatDate(profile.createdAt, languageId)} span={2} small />
    </div>
  );
}

function Stat({ icon, label, value, accent, span, small }) {
  return (
    <div className="sb-stat" style={{ gridColumn: span ? `span ${span}` : "auto" }}>
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="sb-caption">{label}</p>
        <p
          style={{
            fontSize: small ? 15 : 20,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: accent || "var(--color-text)",
            lineHeight: 1.1,
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
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
  const sum = levels.reduce((a, n) => a + n, 0);
  return (
    <div className="sb-card" style={{ padding: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <p className="sb-caption" style={{ fontWeight: 600 }}>{t.arenaCity || "City"}</p>
        <p className="sb-caption">{(t.arenaCityStat || "{n} / 25").replace("{n}", String(sum))}</p>
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
      <button type="button" disabled={busy} onClick={onRemove} className="sb-destructive-btn press" style={{ width: "100%", padding: 14 }}>
        {t.arenaDropFriend || "Remove friend"}
      </button>
    );
  }
  if (state === "outgoing_pending") {
    return (
      <button type="button" disabled={busy} onClick={onCancel} className="press" style={{ width: "100%", padding: 14, border: "1px solid var(--card-border-idle)", borderRadius: 12, background: "rgba(120,120,128,0.22)", color: "var(--color-text)", fontSize: 15, fontWeight: 600, fontFamily: "inherit" }}>
        {t.arenaPendingCancel || "Request sent · tap to cancel"}
      </button>
    );
  }
  if (state === "incoming_pending") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" disabled={busy} onClick={onAccept} className="sb-primary-btn press" style={{ padding: 14 }}>
          {t.arenaAccept || "Accept"}
        </button>
        <button type="button" disabled={busy} onClick={onDecline} className="press" style={{ padding: 14, border: "1px solid var(--card-border-idle)", borderRadius: 12, background: "rgba(120,120,128,0.22)", color: "var(--color-text)", fontSize: 15, fontWeight: 600, fontFamily: "inherit" }}>
          {t.arenaDecline || "Decline"}
        </button>
      </div>
    );
  }
  if (state === "declined_by_them") {
    return (
      <button type="button" disabled className="sb-tinted-btn" style={{ width: "100%", padding: 14, opacity: 0.5 }}>
        {t.arenaDeclined || "Request was declined"}
      </button>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={onAdd} className="sb-primary-btn press" style={{ width: "100%", padding: 14 }}>
      ＋ {t.arenaInviteToCircle || "Add friend"}
    </button>
  );
}
