import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeChallenge,
  fetchChallenge,
  joinChallenge,
  leaveChallenge,
  fetchFriends,
  inviteToChallenge,
  removeChallengeParticipant
} from "../../api";
import Avatar from "./Avatar";
import Screen from "./Screen";
import Alert from "./Alert";
import PullToRefresh from "../PullToRefresh";

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function ChallengeDetailScreen({ challengeId, authUser, t, onClose, onOpenProfile, onChanged }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Local timer state for timed challenges. Not persisted — starts fresh each
  // time the screen mounts. Status: "idle" | "running" | "paused" | "finishing".
  const [timer, setTimer] = useState({ status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 });
  const [tick, setTick] = useState(0);
  const autoCompleteFired = useRef(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const data = await fetchChallenge(challengeId);
      setChallenge(data?.challenge || null);
    } catch (e) {
      setError(e?.message || t.arenaLoadError || "Could not load");
    } finally {
      setLoading(false);
    }
  }, [challengeId, t]);

  useEffect(() => { refresh(); }, [refresh]);

  const [rewardPopup, setRewardPopup] = useState(null);

  async function handleComplete() {
    setBusy(true);
    try {
      const resp = await completeChallenge(challengeId, meUid);
      setTimer({ status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 });
      autoCompleteFired.current = false;
      await refresh();
      onChanged && onChanged();
      // Reward popups driven by the server response shape introduced
      // with the group-progress rework.
      if (resp?.challengeFinished) {
        setRewardPopup({
          kind: "finished",
          xp: Number(resp.finalXpPerUser || 0),
          days: Number(resp.totalDays || resp.groupDaysCompleted || 0)
        });
      } else if (resp?.groupDayComplete) {
        setRewardPopup({
          kind: "dayComplete",
          daysSoFar: Number(resp.groupDaysCompleted || 0),
          total: Number(resp.totalDays || 0)
        });
      }
    } catch (e) {
      setError(e?.message || t.arenaActionError || "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function doLeave() {
    setConfirmLeave(false);
    setBusy(true);
    try {
      await leaveChallenge(challengeId, meUid);
      onChanged && onChanged();
      onClose();
    } catch (e) {
      setError(e?.message || t.arenaActionError || "Could not leave");
      setBusy(false);
    }
  }

  // Creator-only: invite more friends / remove a participant.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friendList, setFriendList] = useState([]);
  const [inviteSelection, setInviteSelection] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null); // participant to remove

  const openInviteSheet = async () => {
    setInviteError("");
    setInviteSelection([]);
    setInviteOpen(true);
    try {
      const resp = await fetchFriends(meUid);
      setFriendList(Array.isArray(resp?.friends) ? resp.friends : []);
    } catch {
      setFriendList([]);
    }
  };

  const submitInvites = async () => {
    if (inviteSelection.length === 0) return;
    setInviteBusy(true);
    setInviteError("");
    try {
      await inviteToChallenge(challengeId, meUid, inviteSelection);
      setInviteOpen(false);
      await refresh();
      onChanged && onChanged();
    } catch (e) {
      setInviteError(e?.message || t.arenaActionError || "Could not invite");
    } finally {
      setInviteBusy(false);
    }
  };

  const doRemoveParticipant = async (username) => {
    setConfirmRemove(null);
    setBusy(true);
    try {
      await removeChallengeParticipant(challengeId, meUid, username);
      await refresh();
      onChanged && onChanged();
    } catch (e) {
      setError(e?.message || t.arenaActionError || "Could not remove");
    } finally {
      setBusy(false);
    }
  };

  const participants = challenge?.participants || [];
  const active = participants.filter((p) => !p.leftAt);
  const me = participants.find((p) => p.user.username === meUid);
  const isParticipant = !!(me && !me.leftAt);
  // Creator of the challenge is treated as accepted even if their
  // acceptedAt stamp somehow goes missing (legacy row, race with an
  // incoming refresh, etc.) — they should never see the Accept/Decline
  // buttons on their own challenge.
  const isCreator = !!(challenge?.creator?.username && challenge.creator.username === meUid);
  const myAccepted = isCreator || !!me?.acceptedAt;
  // `isActive` = "this user is an accepted, still-active participant"
  // (matches the old semantic callers relied on; pending invites aren't
  // active for action-button purposes).
  const isActive = isParticipant && myAccepted;
  // A challenge is "activated" once ≥2 participants have accepted their
  // invites. Server already computes and returns this; fall back to a
  // client recount for safety.
  const acceptedActive = participants.filter((p) => p.acceptedAt && !p.leftAt);
  const isActivated = challenge
    ? (typeof challenge.isActivated === "boolean" ? challenge.isActivated : acceptedActive.length >= 2)
    : false;
  const ended = challenge ? new Date(challenge.endsAt).getTime() <= Date.now() : false;
  const completedToday = me?.lastCompletionDayKey === todayKey();
  const daysLeft = challenge && !ended ? Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000)) : 0;

  // Tick the clock while the timer is running so the UI updates each second.
  useEffect(() => {
    if (timer.status !== "running") return undefined;
    const h = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [timer.status]);

  // Compute live elapsed time. Paused time is excluded.
  const targetMs = Math.max(0, Number(challenge?.timeEstimateMin || 0)) * 60 * 1000;
  const elapsedMs = (() => {
    if (timer.status === "idle" || !timer.startedAt) return 0;
    const now = timer.status === "paused" && timer.pausedAt ? timer.pausedAt : Date.now();
    return Math.max(0, now - timer.startedAt - (timer.totalPausedMs || 0));
  })();
  const timerPct = targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  // Auto-complete when the timer crosses 100% while running.
  useEffect(() => {
    if (!challenge?.needsTimer) return;
    if (completedToday || ended || !isActive) return;
    if (timer.status !== "running") return;
    if (targetMs <= 0 || elapsedMs < targetMs) return;
    if (autoCompleteFired.current || busy) return;
    autoCompleteFired.current = true;
    setTimer((s) => ({ ...s, status: "finishing" }));
    handleComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.status, elapsedMs, targetMs, completedToday, ended, isActive, busy, challenge?.needsTimer]);

  const startTimer = () => {
    autoCompleteFired.current = false;
    setTimer({ status: "running", startedAt: Date.now(), totalPausedMs: 0, pausedAt: 0 });
  };
  const pauseTimer = () => {
    if (timer.status !== "running") return;
    setTimer((s) => ({ ...s, status: "paused", pausedAt: Date.now() }));
  };
  const resumeTimer = () => {
    if (timer.status !== "paused") return;
    setTimer((s) => ({ ...s, status: "running", pausedAt: 0, totalPausedMs: s.totalPausedMs + (Date.now() - s.pausedAt) }));
  };
  const stopTimer = () => {
    autoCompleteFired.current = false;
    setTimer({ status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 });
  };
  // Expose `tick` to keep the eslint exhaustive-deps linter happy about
  // reading `Date.now()` inside elapsedMs (we intentionally re-render via tick).
  void tick;

  async function handleAccept() {
    setBusy(true);
    try {
      await joinChallenge(challengeId, meUid);
      await refresh();
      onChanged && onChanged();
    } catch (e) {
      setError(e?.message || t.arenaActionError || "Could not accept");
    } finally { setBusy(false); }
  }

  // Footer states, in priority order:
  //   ended                       → nothing (archived view)
  //   not a participant           → nothing
  //   left                        → nothing
  //   pending invite              → Accept / Decline
  //   accepted but not activated  → "Waiting for players" disabled state
  //   activated, done today       → Done pill
  //   activated, no timer         → Mark-as-completed button
  //   activated, timed            → nothing here (timer lives on dashboard)
  let footer = null;
  if (!loading && challenge && isParticipant && !ended) {
    if (!myAccepted) {
      footer = (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button type="button" disabled={busy} onClick={handleAccept} className="sb-primary-btn press" style={{ padding: 14 }}>
            {t.arenaAcceptInvite || "Accept invite"}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmLeave(true)} className="press" style={{ padding: 14, border: "1px solid var(--card-border-idle)", borderRadius: 12, background: "rgba(120,120,128,0.22)", color: "var(--color-text)", fontSize: 15, fontWeight: 600, fontFamily: "inherit" }}>
            {t.arenaDeclineInvite || "Decline"}
          </button>
        </div>
      );
    } else if (!isActivated) {
      // Waiting-for-players hint now rides in the hero header, not as a
      // sticky footer strip — keeps the action area free for a future
      // real CTA and de-duplicates the status line.
      footer = null;
    } else if (completedToday) {
      // Per UX: no "Done for today" pill — the hero card and the
      // participant rows already signal today's completion clearly.
      footer = null;
    } else if (!challenge.needsTimer || targetMs <= 0) {
      footer = (
        <button type="button" disabled={busy} onClick={handleComplete} className="sb-primary-btn press" style={{ width: "100%", padding: 14 }}>
          {t.arenaTickOff || "Mark as completed"}
        </button>
      );
    }
  }

  // PTR on the challenge screen's own scroll body. Ignores the global
  // social-screen flag because it's mounted with an explicit target ref.
  const bodyScrollRef = useRef(null);
  const handleScreenRefresh = useCallback(async () => {
    try { await refresh(); } catch { /* non-fatal */ }
  }, [refresh]);

  return (
    <>
      <PullToRefresh target={bodyScrollRef} onRefresh={handleScreenRefresh}>
      <Screen
        title={challenge?.title || (t.arenaPactTitle || "Challenge")}
        subtitle={
          challenge
            ? (ended
                ? (t.arenaPactEndedWord || "ended")
                : (t.arenaDaysLeftLong || "{n} days left").replace("{n}", String(daysLeft)))
            : (t.arenaLoadingShort || "Loading")
        }
        onClose={onClose}
        footer={footer}
        bodyRef={bodyScrollRef}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div className="sb-spinner" />
          </div>
        ) : !challenge ? (
          <p style={{ textAlign: "center", color: "#ff6a63", padding: "40px 16px" }}>{error}</p>
        ) : (
          <Body
            challenge={challenge}
            meUid={meUid}
            me={me}
            active={active}
            ended={ended}
            completedToday={completedToday}
            isActive={isActive}
            isActivated={isActivated}
            isCreator={isCreator}
            t={t}
            error={error}
            showActivity={showActivity}
            onToggleActivity={() => setShowActivity((v) => !v)}
            onOpenProfile={onOpenProfile}
            onLeave={() => setConfirmLeave(true)}
            onInvite={openInviteSheet}
            onRequestRemove={(participant) => setConfirmRemove(participant)}
            busy={busy}
          />
        )}
      </Screen>
      </PullToRefresh>

      {confirmLeave && (
        <Alert
          icon="🚪"
          title={t.arenaConfirmLeaveTitle || "Leave this challenge?"}
          message={t.arenaConfirmLeaveBody || "Your progress here stops. You can come back if the others invite you again."}
          cancelLabel={t.arenaCancel || "Cancel"}
          confirmLabel={t.arenaStepOut || "Leave challenge"}
          destructive
          onCancel={() => setConfirmLeave(false)}
          onConfirm={doLeave}
        />
      )}

      {confirmRemove && (
        <Alert
          icon="🚫"
          title={(t.arenaPactRemoveTitle || "Remove {name}?").replace("{name}", confirmRemove.user?.displayName || confirmRemove.user?.username || "")}
          message={t.arenaPactRemoveBody || "They'll be dropped from the challenge but can be invited back later."}
          cancelLabel={t.arenaCancel || "Cancel"}
          confirmLabel={t.arenaPactRemoveConfirm || "Remove"}
          destructive
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => doRemoveParticipant(confirmRemove.user.username)}
        />
      )}

      {rewardPopup ? (
        <Alert
          icon={rewardPopup.kind === "finished" ? "🏆" : "🪙"}
          title={rewardPopup.kind === "finished"
            ? (t.arenaRewardFinishedTitle || "Challenge complete!")
            : (t.arenaRewardDayTitle || "Daily token earned!")}
          message={rewardPopup.kind === "finished"
            ? ((t.arenaRewardFinishedBody || "You and your crew finished all {days} days. Every participant earned +{xp} XP. Awesome work.")
                .replace("{days}", String(rewardPopup.days))
                .replace("{xp}", String(rewardPopup.xp)))
            : ((t.arenaRewardDayBody || "Everyone completed today — +1 token for each player. Keep it up and finish the challenge to unlock the final XP reward.")
                .replace("{done}", String(rewardPopup.daysSoFar))
                .replace("{total}", String(rewardPopup.total)))}
          confirmLabel={t.arenaRewardConfirm || "Nice!"}
          onConfirm={() => setRewardPopup(null)}
        />
      ) : null}

      {inviteOpen && (
        <InviteFriendsSheet
          friends={friendList}
          existingUserIds={new Set((challenge?.participants || []).filter((p) => !p.leftAt).map((p) => p.user.username))}
          selected={inviteSelection}
          onToggle={(username) => setInviteSelection((prev) => (
            prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
          ))}
          onCancel={() => { if (!inviteBusy) setInviteOpen(false); }}
          onConfirm={submitInvites}
          busy={inviteBusy}
          error={inviteError}
          t={t}
        />
      )}
    </>
  );
}

function InviteFriendsSheet({ friends, existingUserIds, selected, onToggle, onCancel, onConfirm, busy, error, t }) {
  const eligible = (Array.isArray(friends) ? friends : []).filter((f) => !existingUserIds.has(f.username));
  return (
    <div
      className="logout-confirm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}
      style={{ zIndex: 95, background: "rgba(0,0,0,0.72)", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--panel-bg)",
          border: "1px solid var(--card-border-idle)",
          borderRadius: 18,
          padding: "18px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxHeight: "80vh"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 className="cinzel" style={{ color: "var(--color-accent)", margin: 0, fontSize: 16, fontWeight: 700 }}>
            ＋ {t.arenaPactInviteTitle || "Invite friends"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={t.arenaCancel || "Close"}
            className="ui-close-x"
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {eligible.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              {t.arenaPactInviteEmpty || "No friends available to invite."}
            </p>
          ) : (
            eligible.map((f) => {
              const chosen = selected.includes(f.username);
              return (
                <button
                  key={f.username}
                  type="button"
                  onClick={() => onToggle?.(f.username)}
                  className="mobile-pressable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${chosen ? "var(--color-primary)" : "var(--card-border-idle)"}`,
                    background: chosen ? "color-mix(in srgb, var(--color-primary) 14%, transparent)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={32} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--color-text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.displayName || f.username}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      border: `2px solid ${chosen ? "var(--color-primary)" : "rgba(148,163,184,0.35)"}`,
                      background: chosen ? "var(--color-primary)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#0f172a",
                      fontSize: 11,
                      fontWeight: 900
                    }}
                  >
                    {chosen ? "✓" : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {error ? <p style={{ color: "#f87171", fontSize: 12, margin: 0, textAlign: "center" }}>{error}</p> : null}
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || selected.length === 0}
          className="sb-primary-btn press"
          style={{ width: "100%", padding: 12, opacity: (busy || selected.length === 0) ? 0.55 : 1 }}
        >
          {busy
            ? (t.onboardingSaving || "Saving...")
            : selected.length === 0
              ? (t.arenaPactInviteSelectHint || "Pick at least one")
              : (t.arenaPactInviteConfirm || `Invite ${selected.length}`).replace("{n}", String(selected.length))}
        </button>
      </div>
    </div>
  );
}

function Body({ challenge, meUid, me, active, ended, completedToday, isActive, isActivated, isCreator, t, error, showActivity, onToggleActivity, onOpenProfile, onLeave, onInvite, onRequestRemove, busy }) {
  const total = Math.max(1, Number(challenge.durationDays) || 1);
  // Hero ring and % reflect GROUP progress — days where every
  // participant completed, not calendar time. This is the real
  // "how close is the crew to winning" number.
  const groupDays = Math.max(0, Math.min(total, Number(challenge.groupDaysCompleted) || 0));
  const pct = Math.round((groupDays / total) * 100);
  const totalCompletions = (challenge.participants || []).reduce((s, p) => s + (p.completions || 0), 0);
  const todayAward = challenge.lastAwardedDayKey === todayKey();

  const ranked = useMemo(() => {
    const copy = [...(challenge.participants || [])];
    copy.sort((a, b) => {
      if ((b.completions || 0) !== (a.completions || 0)) return (b.completions || 0) - (a.completions || 0);
      return (b.consecutiveDays || 0) - (a.consecutiveDays || 0);
    });
    return copy;
  }, [challenge.participants]);

  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000));
  const top3 = ranked.filter((p) => !p.leftAt).slice(0, 3);
  const rest = ranked.filter((p) => !p.leftAt).slice(3);
  const leftList = ranked.filter((p) => p.leftAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* HERO — circular day progress + chips */}
      <div
        style={{
          position: "relative",
          padding: "18px 16px 20px",
          borderRadius: 18,
          border: "1px solid var(--panel-border)",
          background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--color-primary) 18%, var(--panel-bg)) 0%, var(--panel-bg) 60%)`,
          overflow: "hidden"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <DayRing elapsed={groupDays} total={total} ended={ended} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-muted)",
                  margin: 0,
                  fontWeight: 700
                }}
              >
                {ended ? (t.arenaPactEndedWord || "Ended") : `${daysLeft} ${t.arenaDaysLeftUnit || "days left"}`}
              </p>
              {!ended && !isActivated ? (
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.18)",
                    border: "1px solid rgba(148,163,184,0.35)",
                    color: "var(--color-muted)"
                  }}
                >
                  ⏳ {t.arenaWaitingForPlayersShort || "Waiting for players"}
                </span>
              ) : null}
            </div>
            <h2 className="cinzel" style={{ fontSize: 18, fontWeight: 800, margin: "4px 0 0", color: "var(--color-text)", lineHeight: 1.25 }}>
              {challenge.title}
            </h2>
            <p
              className="cinzel"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-primary)",
                margin: "4px 0 0",
                letterSpacing: "0.04em",
                fontVariantNumeric: "tabular-nums"
              }}
            >
              {`${pct}% ${t.arenaCompletionTotal || "completion"}`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          <HeroChip icon="✓" value={totalCompletions} label={t.arenaTotalDone || "total done"} />
          <HeroChip icon="👥" value={active.length} label={t.arenaPlayers || "players"} />
          <HeroChip
            icon={completedToday ? "✓" : "⚬"}
            value={completedToday ? (t.arenaDoneTodayShort || "done") : (t.arenaNotYet || "not yet")}
            label={t.arenaToday || "today"}
          />
        </div>
      </div>

      {/* MISSION — prominent daily task */}
      <div
        style={{
          padding: 16,
          borderRadius: 18,
          border: `1px solid ${completedToday ? "rgba(48,209,88,0.45)" : "var(--panel-border)"}`,
          background: completedToday
            ? "color-mix(in srgb, #10b981 14%, var(--panel-bg))"
            : "var(--panel-bg)",
          display: "flex",
          gap: 14,
          alignItems: "flex-start"
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 48,
            height: 48,
            borderRadius: 14,
            background: completedToday
              ? "color-mix(in srgb, #10b981 25%, transparent)"
              : "color-mix(in srgb, var(--color-primary) 18%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24
          }}
        >
          {completedToday ? "✓" : "🎯"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: completedToday ? "#6ee7b7" : "var(--color-muted)",
              margin: 0,
              fontWeight: 700
            }}
          >
            {completedToday ? (t.arenaMissionDone || "Done today") : (t.arenaDailyRitual || "Daily mission")}
          </p>
          <p className="sb-headline" style={{ fontSize: 15, margin: "4px 0 0", color: "var(--color-text)", lineHeight: 1.3 }}>
            {challenge.questTitle}
            {challenge.needsTimer && challenge.timeEstimateMin ? (
              <span style={{ color: "var(--color-muted)", fontWeight: 500, fontSize: 13 }}> · ⏱ {challenge.timeEstimateMin} {t.arenaMinAbbrev || "min"}</span>
            ) : null}
          </p>
          {challenge.questDescription && (
            <p className="sb-caption" style={{ marginTop: 6 }}>{challenge.questDescription}</p>
          )}
        </div>
      </div>

      {/* PARTICIPANTS — podium + list */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 4px 12px" }}>
          <h3 className="sb-section-title" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--color-muted)", margin: 0, flex: 1, fontWeight: 700 }}>
            {t.arenaCrew || "Participants"} · {active.length}
          </h3>
          {isCreator && !ended ? (
            <button
              type="button"
              onClick={onInvite}
              disabled={busy}
              className="mobile-pressable cinzel"
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "6px 11px",
                borderRadius: 999,
                border: "1px solid var(--color-primary)",
                background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                color: "var(--color-primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer"
              }}
            >
              ＋ {t.arenaPactInvite || "Invite"}
            </button>
          ) : null}
        </div>

        {[...top3, ...rest].length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...top3, ...rest].map((p, i) => (
              <ParticipantRow
                key={p.id}
                rank={i + 1}
                participant={p}
                meUid={meUid}
                t={t}
                onOpenProfile={onOpenProfile}
                canRemove={isCreator && !ended && p.user.username !== meUid}
                onRemove={() => onRequestRemove?.(p)}
              />
            ))}
          </div>
        ) : null}

        {leftList.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", margin: "0 4px 6px", fontWeight: 700 }}>
              {t.arenaLeftSection || "Left"} · {leftList.length}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {leftList.map((p, i) => (
                <ParticipantRow
                  key={p.id}
                  rank={null}
                  participant={p}
                  meUid={meUid}
                  t={t}
                  onOpenProfile={onOpenProfile}
                  canRemove={false}
                  onRemove={null}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ACTIVITY FEED — kept collapsible */}
      <div className={`chal-activity${showActivity ? " open" : ""}`}>
        <button type="button" onClick={onToggleActivity} className="chal-activity-toggle" aria-expanded={showActivity}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span className="sb-body" style={{ flex: 1, fontWeight: 600 }}>{t.arenaActivity || "Activity"}</span>
          <span className="chal-activity-chev" aria-hidden="true">›</span>
        </button>
        <div className="chal-activity-body" aria-hidden={!showActivity}>
          <div
            className="chal-activity-body-inner"
            style={{
              // Cap activity feed at ~5 rows and scroll inside. Each
              // row lands around 48 px (padding + date line), so 5 × 48
              // + gaps ≈ 260 px feels right.
              maxHeight: 260,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              paddingRight: 2
            }}
          >
            {(challenge.logs || []).length === 0 && (
              <p className="sb-caption" style={{ textAlign: "center", padding: "8px 0" }}>{t.arenaActivityEmpty || "No activity yet."}</p>
            )}
            {(challenge.logs || []).map((log) => (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)"
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-primary)", marginTop: 7, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>{log.user.displayName || log.user.username}</span>{" "}
                  <span style={{ color: "var(--color-muted)" }}>{logVerb(log.type, t)}</span>
                  <div style={{ color: "var(--color-muted)", fontSize: 11, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {formatAbsolute(log.createdAt, t)} · {formatRelative(log.createdAt, t)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <p style={{ color: "#ff6a63", fontSize: 14, textAlign: "center" }}>{error}</p>}

      {isActive && !ended && (
        <button type="button" onClick={onLeave} disabled={busy} className="sb-destructive-btn press" style={{ marginTop: 4 }}>
          {t.arenaStepOut || "Leave challenge"}
        </button>
      )}
    </div>
  );
}

function DayRing({ elapsed, total, ended }) {
  const size = 88;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, total > 0 ? elapsed / total : 0));
  const offset = circumference * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(148,163,184,0.22)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ended ? "#10b981" : "var(--color-primary)"}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: "var(--color-text)"
        }}
      >
        <p className="cinzel" style={{ fontSize: 20, fontWeight: 900, margin: 0, lineHeight: 1, color: ended ? "#6ee7b7" : "var(--color-primary)" }}>
          {elapsed}
        </p>
        <p style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", margin: "2px 0 0", fontWeight: 700 }}>
          of {total}
        </p>
      </div>
    </div>
  );
}

function HeroChip({ icon, value, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--card-border-idle)",
        fontSize: 11,
        color: "var(--color-text)",
        fontWeight: 700
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: "var(--color-muted)", fontWeight: 500, textTransform: "lowercase" }}>{label}</span>
    </span>
  );
}

function Podium({ top3, meUid, t, onOpenProfile, isCreator, ended, onRequestRemove }) {
  // Visual arrangement: 2nd — 1st — 3rd
  const slots = [
    { rank: 2, participant: top3[1], height: 58, emoji: "🥈" },
    { rank: 1, participant: top3[0], height: 78, emoji: "🥇" },
    { rank: 3, participant: top3[2], height: 42, emoji: "🥉" }
  ].filter((s) => s.participant);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        alignItems: "end",
        padding: "12px 8px 14px",
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.04))",
        border: "1px solid var(--panel-border)"
      }}
    >
      {slots.map((slot) => (
        <PodiumSpot
          key={slot.rank}
          rank={slot.rank}
          participant={slot.participant}
          height={slot.height}
          emoji={slot.emoji}
          meUid={meUid}
          t={t}
          onOpenProfile={onOpenProfile}
          canRemove={isCreator && !ended && slot.participant.user.username !== meUid}
          onRemove={() => onRequestRemove?.(slot.participant)}
        />
      ))}
    </div>
  );
}

function PodiumSpot({ rank, participant, height, emoji, meUid, t, onOpenProfile, canRemove, onRemove }) {
  const isMe = participant.user.username === meUid;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative" }}>
      {canRemove ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          aria-label={t.arenaPactRemoveShort || "Remove"}
          className="mobile-pressable"
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 22,
            height: 22,
            borderRadius: 999,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(248,113,113,0.12)",
            color: "#f87171",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2
          }}
        >
          ✕
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
        className="press"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          width: "100%"
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${isMe ? "var(--color-primary)" : "var(--card-border-idle)"}`,
            background: "var(--panel-bg)",
            boxShadow: rank === 1 ? "0 0 14px color-mix(in srgb, var(--color-primary) 35%, transparent)" : "none"
          }}
        >
          <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={52} />
        </div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: isMe ? "var(--color-primary)" : "var(--color-text)",
            margin: 0,
            maxWidth: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {participant.user.displayName || participant.user.username}
        </p>
      </button>
      <div
        style={{
          width: "100%",
          height,
          borderRadius: "10px 10px 4px 4px",
          background: rank === 1
            ? "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 60%, transparent), color-mix(in srgb, var(--color-primary) 25%, transparent))"
            : "rgba(148,163,184,0.18)",
          border: `1px solid ${rank === 1 ? "color-mix(in srgb, var(--color-primary) 55%, transparent)" : "var(--card-border-idle)"}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          padding: "6px 4px"
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
          ✓ {participant.completions || 0}
        </span>
      </div>
    </div>
  );
}

function ParticipantRow({ rank, participant, meUid, t, onOpenProfile, canRemove, onRemove }) {
  const isMe = participant.user.username === meUid;
  const left = !!participant.leftAt;
  const pending = !participant.acceptedAt && !left;
  const medalTint = rank === 1 ? "#facc15" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#f59e0b" : null;
  const doneToday = participant.lastCompletionDayKey === todayKey();
  // Only show the today status badge for accepted + still-active players.
  // Pending invitees and those who left don't have a meaningful "today" state.
  const showTodayBadge = !pending && !left;
  // Reserve right-side space so rows don't jitter as the remove button or
  // today badge comes and goes. Today badge always shows when eligible;
  // remove button shows only for the creator on other players' rows.
  const rightPad = canRemove && showTodayBadge ? 92 : 52;
  const todayLabel = doneToday
    ? (t.arenaParticipantDoneTitle || "Completed today")
    : (t.arenaParticipantMissedTitle || "Not done today");

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        paddingRight: rightPad,
        borderRadius: 12,
        border: `1px solid ${isMe ? "color-mix(in srgb, var(--color-primary) 45%, transparent)" : "var(--card-border-idle)"}`,
        background: isMe ? "color-mix(in srgb, var(--color-primary) 7%, transparent)" : "rgba(255,255,255,0.02)",
        opacity: left ? 0.55 : 1,
        overflow: "hidden"
      }}
    >
      {/* Left-edge rank bar — muted grey for 4+, theme-coloured medal for top 3 */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: medalTint || "rgba(148,163,184,0.28)"
        }}
      />

      <span
        style={{
          minWidth: 26,
          fontSize: 12,
          fontWeight: 800,
          color: medalTint || "var(--color-muted)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "center"
        }}
      >
        {rank != null ? `#${rank}` : "—"}
      </span>

      <button
        type="button"
        onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
        className="press"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          background: "var(--panel-bg)",
          border: "1px solid var(--card-border-idle)",
          padding: 0,
          cursor: "pointer",
          flexShrink: 0
        }}
      >
        <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={36} />
      </button>

      <button
        type="button"
        onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
        className="press"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
          display: "flex",
          flexDirection: "column",
          gap: 3
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: isMe ? "var(--color-primary)" : "var(--color-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: "-0.01em"
            }}
          >
            {participant.user.displayName || participant.user.username}
          </span>
          {pending ? (
            <span
              style={{
                fontSize: 9,
                padding: "1px 7px",
                borderRadius: 999,
                background: "rgba(148,163,184,0.18)",
                color: "var(--color-muted)",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                flexShrink: 0
              }}
            >
              {t.arenaPactPending || "pending"}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--color-muted)", fontWeight: 600, fontVariantNumeric: "tabular-nums", alignItems: "center", flexWrap: "wrap" }}>
          <span title={t.arenaStatCompletionsTooltip || "Completions"}>🏁 {participant.completions || 0}</span>
          <span style={{ color: "var(--card-border-idle)" }}>·</span>
          <span title={t.arenaStatTokensTooltip || "Tokens earned"}>🪙 {participant.tokensEarned || 0}</span>
        </div>
      </button>

      {/* Today status — prominent solid circle: green ✓ when done, red ✕
          when still pending. Using white glyph on solid fill keeps it
          readable across all 3 themes and distinct from the outlined
          remove button that may sit beside it. */}
      {showTodayBadge ? (
        <span
          role="img"
          aria-label={todayLabel}
          title={todayLabel}
          style={{
            position: "absolute",
            top: "50%",
            right: canRemove ? 52 : 12,
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            background: doneToday ? "#10b981" : "#ef4444",
            color: "#ffffff",
            boxShadow: doneToday
              ? "0 2px 8px rgba(16, 185, 129, 0.32)"
              : "0 2px 8px rgba(239, 68, 68, 0.28)",
            pointerEvents: "none"
          }}
        >
          {doneToday ? "✓" : "✕"}
        </span>
      ) : null}

      {/* Remove button is absolutely positioned so showing/hiding it
          never shifts the rest of the row. Always centred vertically in
          the right-side gutter we reserved via paddingRight. Outlined
          style keeps it visually secondary to the solid today badge. */}
      {canRemove ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          aria-label={t.arenaPactRemoveShort || "Remove"}
          className="mobile-pressable"
          style={{
            position: "absolute",
            top: "50%",
            right: 12,
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "1px solid rgba(248,113,113,0.5)",
            background: "rgba(248,113,113,0.12)",
            color: "#f87171",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function ParticipantCard_Legacy({ rank, participant, meUid, t, onOpenProfile, canRemove, onRemove }) {
  const isMe = participant.user.username === meUid;
  const left = !!participant.leftAt;
  const pending = !participant.acceptedAt && !left;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

  return (
    <div
      style={{
        position: "relative",
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${isMe ? "color-mix(in srgb, var(--color-primary) 55%, transparent)" : "var(--card-border-idle)"}`,
        background: isMe
          ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
          : "var(--panel-bg)",
        opacity: left ? 0.55 : 1,
        display: "flex",
        alignItems: "center",
        gap: 12
      }}
    >
      <button
        type="button"
        onClick={() => onOpenProfile && onOpenProfile(participant.user.username)}
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          color: "inherit",
          textAlign: "left",
          padding: 0,
          cursor: "pointer"
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 28,
            textAlign: "center",
            fontSize: rank <= 3 ? 18 : 13,
            fontWeight: 800,
            color: rank <= 3 ? "var(--color-text)" : "var(--color-muted)"
          }}
        >
          {medal}
        </span>
        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)", border: "1px solid var(--card-border-idle)" }}>
          <Avatar photoUrl={participant.user.photoUrl} displayName={participant.user.displayName} size={40} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span
              className="sb-body"
              style={{
                fontWeight: 700,
                color: isMe ? "var(--color-primary)" : "var(--color-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%"
              }}
            >
              {participant.user.displayName || participant.user.username}
            </span>
            {isMe ? (
              <span style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t.arenaYou || "you"}
              </span>
            ) : null}
            {pending ? (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.18)",
                  color: "var(--color-muted)",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase"
                }}
              >
                {t.arenaPactPending || "pending"}
              </span>
            ) : null}
            {left ? (
              <span style={{ fontSize: 10, color: "var(--color-muted)", fontWeight: 600 }}>· {t.arenaStepped || "left"}</span>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <Stat icon="✓" value={participant.completions || 0} label={t.arenaDone || "done"} />
            <Stat icon="🔥" value={participant.consecutiveDays || 0} label={t.arenaStreakShort || "streak"} />
            <Stat icon="🪙" value={participant.tokensEarned || 0} label={t.arenaTokens || "tokens"} />
          </div>
        </div>
      </button>
      {canRemove ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          aria-label={t.arenaPactRemoveShort || "Remove"}
          className="mobile-pressable"
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(248,113,113,0.08)",
            color: "#f87171",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(148,163,184,0.12)",
        fontSize: 11,
        fontWeight: 700,
        color: "var(--color-text)"
      }}
      title={label}
    >
      <span>{icon}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </span>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p className="sb-caption" style={{ fontSize: 11, fontWeight: 600 }}>{label}</p>
      <p className="sb-headline" style={{ marginTop: 2, fontSize: 17 }}>{value}</p>
    </div>
  );
}

function ChallengeTimerPanel({ status, elapsedMs, targetMs, percent, busy, t, onStart, onPause, onResume, onStop }) {
  if (status === "idle") {
    return (
      <button type="button" disabled={busy} onClick={onStart} className="sb-primary-btn press" style={{ width: "100%", padding: 14 }}>
        ⏱ {t.arenaTimerStart || "Start timer"} · {Math.round(targetMs / 60000)} {t.arenaMinAbbrev || "min"}
      </button>
    );
  }

  const running = status === "running";
  const paused = status === "paused";
  const finishing = status === "finishing";
  const fillColor = percent >= 100 ? "#30d158" : "var(--color-primary)";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid var(--panel-border)",
        background: "var(--panel-bg)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: `${percent}%`,
          background: `linear-gradient(90deg, color-mix(in srgb, ${fillColor} 16%, transparent), color-mix(in srgb, ${fillColor} 6%, transparent))`,
          transition: "width 600ms linear",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0, bottom: 0,
          width: `${percent}%`,
          height: 3,
          background: fillColor,
          boxShadow: `0 0 10px ${fillColor}`,
          transition: "width 600ms linear",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 22, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {formatClockMs(elapsedMs)}
            <span className="sb-caption" style={{ marginLeft: 6, fontSize: 13 }}>
              / {formatClockMs(targetMs)}
            </span>
          </p>
          <p className="sb-caption" style={{ marginTop: 2 }}>
            {finishing ? (t.arenaTimerCompleting || "Finishing…") : `${percent}% · ${t.arenaTimerTargetHint || "Finish at 100% to claim today."}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {running && (
            <button type="button" disabled={busy || finishing} onClick={onPause} className="press" style={timerSecondaryBtn}>
              {t.arenaTimerPause || "Pause"}
            </button>
          )}
          {paused && (
            <button type="button" disabled={busy || finishing} onClick={onResume} className="press" style={timerPrimaryBtn}>
              {t.arenaTimerResume || "Resume"}
            </button>
          )}
          <button type="button" disabled={busy || finishing} onClick={onStop} className="press" style={timerStopBtn}>
            {t.arenaTimerStop || "Stop"}
          </button>
        </div>
      </div>
    </div>
  );
}

const timerPrimaryBtn = {
  padding: "10px 14px",
  minWidth: 72,
  borderRadius: 10,
  background: "var(--color-primary)",
  border: "none",
  color: "#1b1410",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};
const timerSecondaryBtn = {
  padding: "10px 14px",
  minWidth: 72,
  borderRadius: 10,
  background: "rgba(120,120,128,0.22)",
  border: "1px solid var(--panel-border)",
  color: "var(--color-text)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};
const timerStopBtn = {
  padding: "10px 14px",
  minWidth: 68,
  borderRadius: 10,
  background: "rgba(255,59,48,0.16)",
  border: "1px solid rgba(255,59,48,0.4)",
  color: "#ff6a63",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  touchAction: "manipulation",
};

function formatClockMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function logVerb(type, t) {
  if (type === "created") return t.arenaLogCreated || "started the challenge";
  if (type === "joined") return t.arenaLogJoined || "joined";
  if (type === "left") return t.arenaLogLeft || "left";
  if (type === "completed") return t.arenaLogCompleted || "completed today's task";
  return type;
}

function formatAbsolute(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${date} ${time}`;
  } catch {
    return "";
  }
}

function formatRelative(value, t) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.arenaJustNow || "just now";
  if (m < 60) return `${m} ${t.arenaMinAbbrev || "min"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t.arenaHourAbbrev || "h"}`;
  const d = Math.floor(h / 24);
  return `${d} ${t.arenaDayAbbrev || "d"}`;
}
