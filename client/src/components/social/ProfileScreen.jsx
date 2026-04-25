import { useCallback, useEffect, useState } from "react";
import CityIsometricOverview, { DISTRICTS } from "../CityIsometricOverview";
import CityMapHint from "../CityMapHint";
import DistrictView from "../DistrictView";
import InteractiveMapWrapper from "../InteractiveMapWrapper";
import {
  cancelFriendRequest,
  fetchFriendRelation,
  fetchPublicProfile,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  fetchAchievements,
} from "../../api";
import Avatar from "./Avatar";
import { IconStar, IconFlame, IconTarget, IconBolt, IconUsers, IconCalendar } from "../icons/Icons";
import StreakFrame, { getStreakTier } from "./StreakFrame";
import Screen from "./Screen";
import Alert from "./Alert";
import AchievementsSection from "../achievements/AchievementsSection";

const DISTRICT_MAX_LEVEL = 5;

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
  const [achievements, setAchievements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      // Hold the spinner until ALL three resolve (profile + relation +
      // achievements) so the screen paints fully populated — no flash of
      // achievement skeleton appearing after the hero/stats.
      const [p, r, a] = await Promise.all([
        fetchPublicProfile(targetUsername),
        meUsername ? fetchFriendRelation(meUsername, targetUsername) : Promise.resolve(null),
        fetchAchievements(targetUsername).catch(() => null),
      ]);
      setProfile(p?.user || null);
      setRelation(r || null);
      setAchievements(a || null);
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

  const friendshipAction = !loading && profile && !isSelf && meUsername ? (
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

  // When we're already friends with this profile, the "Remove friend"
  // action lives INSIDE the scroll, right under the stats grid (above the
  // city card) — per UX request. The sticky screen footer only hosts the
  // All friendship actions now live in one place — directly under the
  // stat grid (whose last row is the "Joined" date). The sticky footer
  // is no longer used for friend CTAs so the user always finds the same
  // button in the same spot regardless of relation state.
  const inlineAction = friendshipAction;

  return (
    <>
      <Screen
        title={profile?.displayName || (t.arenaProfileTitle || "Profile")}
        subtitle={profile ? "" : (t.arenaLoadingShort || "Loading")}
        onClose={onClose}
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
            {inlineAction}
            <AchievementsSection username={targetUsername} t={t} languageId={languageId} prefetched={achievements} />
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
      {profile.handle ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "var(--color-muted)",
            marginTop: -4
          }}
        >
          @{profile.handle}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <span className="sb-pill sb-pill-accent" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconStar size={12} /> {t.arenaLvlFull || "Level"} {profile.level}
        </span>
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
  const totalXp = Number(profile.totalXp) || 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Stat IconComp={IconFlame} label={t.arenaStatStreak || "Current"} value={profile.streak || 0} accent="#ff9500" />
      <Stat IconComp={IconTarget} label={t.arenaStatTotalXp || "Total XP"} value={formatNumber(totalXp)} accent="#fbbf24" />
      <Stat IconComp={IconBolt} label={t.arenaStatWeek || "Week XP"} value={profile.weeklyXp || 0} accent="var(--color-primary)" />
      <Stat IconComp={IconUsers} label={t.arenaStatFriends || "Friends"} value={profile.friendCount || 0} />
      <Stat IconComp={IconCalendar} label={t.arenaStatJoined || "Joined"} value={formatDate(profile.createdAt, languageId)} span={2} small />
    </div>
  );
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

function Stat({ IconComp, label, value, accent, span, small }) {
  return (
    <div className="sb-stat" style={{ gridColumn: span ? `span ${span}` : "auto" }}>
      <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, color: accent || "var(--color-primary)" }}>
        {IconComp ? <IconComp size={20} /> : null}
      </span>
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
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const handleDistrictClick = useCallback((idx) => {
    const entry = DISTRICTS[idx];
    if (!entry || entry.locked) return;
    setSelectedIdx(idx);
  }, []);
  const handleClose = useCallback(() => setSelectedIdx(-1), []);

  const district = selectedIdx >= 0 ? DISTRICTS[selectedIdx] : null;
  const districtLevel = selectedIdx >= 0
    ? Math.max(0, Math.min(DISTRICT_MAX_LEVEL, Math.floor(Number(levels[selectedIdx]) || 0)))
    : 0;
  const districtName = district
    ? (t?.[`district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`] || district.id)
    : "";

  return (
    <div className="sb-card" style={{ padding: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <p className="sb-caption" style={{ fontWeight: 600 }}>{t.arenaCity || "City"}</p>
        <p className="sb-caption">{(t.arenaCityStat || "{n} / 25").replace("{n}", String(sum))}</p>
      </div>
      <div style={{ position: "relative", aspectRatio: "1 / 1", width: "100%", borderRadius: 12, overflow: "hidden", background: "var(--panel-bg)" }}>
        {district ? (
          <>
            <InteractiveMapWrapper background="var(--panel-bg)" initialScale={1.0}>
              <DistrictView districtId={district.id} level={districtLevel} />
            </InteractiveMapWrapper>
            <div
              style={{
                position: "absolute",
                top: 8, left: 0, right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px",
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                aria-label="Back"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.55)",
                  background: "rgba(15,23,42,0.78)",
                  backdropFilter: "blur(6px)",
                  color: "#f8fafc",
                  cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
                  pointerEvents: "auto",
                }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <div
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.72)",
                  border: "1px solid rgba(148,163,184,0.35)",
                  color: "#f8fafc",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  backdropFilter: "blur(6px)",
                }}
              >
                {districtName} · {t.districtLevelLabel || "Level"} {districtLevel}/{DISTRICT_MAX_LEVEL}
              </div>
            </div>
          </>
        ) : (
          <>
            <InteractiveMapWrapper background="var(--panel-bg)" initialScale={1.0}>
              <CityIsometricOverview levels={levels} selectedIdx={-1} onDistrictClick={handleDistrictClick} t={t} />
            </InteractiveMapWrapper>
            <CityMapHint />
          </>
        )}
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
