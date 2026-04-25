import PropTypes from "prop-types";
import { useRef, useState, useLayoutEffect, useCallback, useMemo, useEffect } from "react";
import { useTheme } from "../ThemeContext";
import { QuestItem } from "./QuestItem";
import { useAutoAnimate } from "@formkit/auto-animate/react";

function EmptySlotCard({ label, cta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="qb-empty-slot mobile-pressable"
      style={{
        borderStyle: "dashed",
        borderWidth: 2,
        borderColor: "color-mix(in srgb, var(--color-primary) 45%, transparent)",
        borderRadius: 14,
        background: "rgba(2, 6, 23, 0.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "18px 12px",
        minHeight: 90,
        cursor: "pointer",
        transition: "background 160ms ease, border-color 160ms ease, transform 120ms ease, box-shadow 160ms ease"
      }}
      aria-label={cta || "Pick"}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>✨</span>
      <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-primary)", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>
        + {cta}
      </span>
    </button>
  );
}

// ─── Challenge timer helpers ──────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function defaultTimer() {
  return { status: "idle", startedAt: 0, totalPausedMs: 0, pausedAt: 0 };
}

function readTimer(key) {
  if (typeof window === "undefined") return defaultTimer();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultTimer();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultTimer();
    return {
      status: ["running", "paused", "finishing", "idle"].includes(parsed.status) ? parsed.status : "idle",
      startedAt: Number(parsed.startedAt) || 0,
      totalPausedMs: Number(parsed.totalPausedMs) || 0,
      pausedAt: Number(parsed.pausedAt) || 0,
    };
  } catch {
    return defaultTimer();
  }
}

function writeTimer(key, state) {
  if (typeof window === "undefined") return;
  try {
    if (!state || state.status === "idle") { window.localStorage.removeItem(key); return; }
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch { /* quota / private mode */ }
}

function clearTimer(key) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function formatClockMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// ─── ChallengeTimerInline ─────────────────────────────────────────────────────

function ChallengeTimerInline({ challengeId, targetMinutes, busy, t, onComplete }) {
  const targetMs = Math.max(0, Number(targetMinutes) || 0) * 60 * 1000;
  const storageKey = `challenge-timer:${challengeId}`;
  const [timerState, setTimerState] = useState(() => readTimer(storageKey));
  const [, setTick] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => { writeTimer(storageKey, timerState); }, [storageKey, timerState]);
  useEffect(() => { setTimerState(readTimer(storageKey)); }, [storageKey]);
  useEffect(() => {
    if (timerState.status !== "running") return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timerState.status]);

  const elapsedMs = (() => {
    const s = timerState;
    if (s.status === "idle" || !s.startedAt) return 0;
    const anchor = s.status === "paused" && s.pausedAt ? s.pausedAt : Date.now();
    return Math.max(0, anchor - s.startedAt - (s.totalPausedMs || 0));
  })();
  const pct = targetMs > 0 ? Math.min(100, Math.round((elapsedMs / targetMs) * 100)) : 0;

  useEffect(() => {
    if (timerState.status !== "running") return;
    if (targetMs <= 0 || elapsedMs < targetMs) return;
    if (firedRef.current || busy) return;
    firedRef.current = true;
    setTimerState((s) => ({ ...s, status: "finishing" }));
    Promise.resolve(onComplete()).finally(() => {
      firedRef.current = false;
      clearTimer(storageKey);
      setTimerState(defaultTimer());
    });
  }, [timerState.status, elapsedMs, targetMs, busy, onComplete, storageKey]);

  const start = () => { firedRef.current = false; setTimerState({ status: "running", startedAt: Date.now(), totalPausedMs: 0, pausedAt: 0 }); };
  const pause = () => { if (timerState.status !== "running") return; setTimerState((s) => ({ ...s, status: "paused", pausedAt: Date.now() })); };
  const resume = () => {
    if (timerState.status !== "paused") return;
    setTimerState((s) => ({ ...s, status: "running", totalPausedMs: (s.totalPausedMs || 0) + Math.max(0, Date.now() - (s.pausedAt || Date.now())), pausedAt: 0 }));
  };
  const stop = () => { firedRef.current = false; clearTimer(storageKey); setTimerState(defaultTimer()); };

  if (timerState.status === "idle") {
    return (
      <button type="button" disabled={busy} onClick={start} className="sb-tinted-btn mobile-pressable"
        style={{ alignSelf: "flex-start", padding: "8px 16px", fontSize: 13 }}>
        ⏱ {t.arenaTimerStart || "Start timer"}
      </button>
    );
  }

  const running = timerState.status === "running";
  const paused = timerState.status === "paused";
  const finishing = timerState.status === "finishing";
  const fillColor = pct >= 100 ? "#30d158" : "var(--color-primary)";

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 10, border: "1px solid var(--panel-border)", background: "rgba(2,6,23,0.35)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${fillColor} 18%, transparent), transparent)`, transition: "width 600ms linear", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${pct}%`, background: fillColor, boxShadow: `0 0 10px ${fillColor}`, transition: "width 600ms linear", pointerEvents: "none" }} />
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <p style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 18, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {formatClockMs(elapsedMs)}
          <span style={{ marginLeft: 6, fontSize: 12, color: "var(--color-muted)" }}>/ {formatClockMs(targetMs)}</span>
        </p>
        <p style={{ marginTop: 2, fontSize: 11, color: "var(--color-muted)" }}>{finishing ? (t.arenaTimerCompleting || "Finishing…") : `${pct}%`}</p>
      </div>
      <div style={{ display: "flex", gap: 6, position: "relative", zIndex: 1 }}>
        {running && <button type="button" disabled={busy || finishing} onClick={pause} className="mobile-pressable" style={miniSecondary}>{t.arenaTimerPause || "Pause"}</button>}
        {paused && <button type="button" disabled={busy || finishing} onClick={resume} className="mobile-pressable" style={miniPrimary}>{t.arenaTimerResume || "Resume"}</button>}
        <button type="button" disabled={busy || finishing} onClick={stop} className="mobile-pressable" style={miniStop}>{t.arenaTimerStop || "Stop"}</button>
      </div>
    </div>
  );
}

const miniPrimary = { padding: "7px 12px", minWidth: 62, borderRadius: 8, background: "var(--color-primary)", border: "none", color: "#1b1410", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", touchAction: "manipulation" };
const miniSecondary = { padding: "7px 12px", minWidth: 62, borderRadius: 8, background: "rgba(120,120,128,0.22)", border: "1px solid var(--panel-border)", color: "var(--color-text)", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", touchAction: "manipulation" };
const miniStop = { padding: "7px 12px", minWidth: 56, borderRadius: 8, background: "rgba(255,59,48,0.16)", border: "1px solid rgba(255,59,48,0.4)", color: "#ff6a63", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", touchAction: "manipulation" };

// ─── ChallengeItem ────────────────────────────────────────────────────────────

function ChallengeItem({ challenge, meUid, t, busy, optimisticDone, onComplete, onAccept, onDecline }) {
  const tKey = todayKey();
  const completedToday = optimisticDone || challenge.myLastCompletionDayKey === tKey;
  const isCreator = !!(challenge.creator?.username && challenge.creator.username === meUid);
  const myAccepted = isCreator || !!challenge.myAcceptedAt;
  const isActivated = typeof challenge.isActivated === "boolean"
    ? challenge.isActivated
    : (challenge.participants || []).filter((p) => p.acceptedAt && !p.leftAt).length >= 2;
  const pending = !myAccepted;
  const waiting = myAccepted && !isActivated;
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / 86400000));

  // Long-press to complete (active, no timer, not done)
  const canLongPress = !pending && !waiting && !completedToday && !challenge.needsTimer && !busy;
  const [pressing, setPressing] = useState(false);
  const pressTimer = useRef(null);
  const pressOrigin = useRef(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const hintTimer = useRef(null);

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const cancelPressing = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    pressOrigin.current = null;
    setPressing(false);
  }, []);

  const handlePointerDown = useCallback((e) => {
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressing(true), 110);
    if (!canLongPress) return;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      if ("vibrate" in navigator) navigator.vibrate(100);
      longPressTriggered.current = true;
      setShowTapHint(false);
      onComplete();
    }, 500);
  }, [canLongPress, onComplete]);

  const handlePointerMove = useCallback((e) => {
    const origin = pressOrigin.current;
    if (!origin) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (dx * dx + dy * dy > 36) {
      cancelPressing();
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
  }, [cancelPressing]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    cancelPressing();
  }, [cancelPressing]);

  const handleClick = useCallback(() => {
    if (!canLongPress) return;
    if (longPressTriggered.current) { longPressTriggered.current = false; return; }
    setShowTapHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowTapHint(false), 1400);
  }, [canLongPress]);

  const daysLeftLabel = (t.challengeDaysLeft || "{n}d left").replace("{n}", String(daysLeft));

  return (
    <div
      className={`qb-quest-item qb-chal-item${pressing ? " qb-quest-pressing" : ""}${completedToday ? " qb-quest-done" : ""}${pending ? " qb-quest-pending" : ""}`}
      style={{ position: "relative" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => { if (canLongPress) e.preventDefault(); }}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3 pointer-events-none">
        <div className={`qb-check${completedToday ? " qb-check-done" : ""}`}>
          {completedToday ? "✓" : ""}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap pr-12">
            <span className="qb-cat">{t.challengeCategory || "CHALLENGE"}</span>
            {pending ? (
              <span className="qb-xp">✉ {t.arenaPendingBadge || "Pending"}</span>
            ) : waiting ? (
              <span className="qb-xp">⏳ {t.arenaWaitingBadge || "Waiting"}</span>
            ) : (
              <span className="qb-xp">{daysLeftLabel}</span>
            )}
          </div>
          <h4 className="cinzel font-bold leading-snug text-[14px]" style={{ color: "var(--color-text)" }}>
            {challenge.title}
          </h4>
          <p className="text-[13px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: "var(--color-muted)" }}>
            🎯 {challenge.questTitle}
            {challenge.needsTimer && challenge.timeEstimateMin ? ` · ⏱ ${challenge.timeEstimateMin} ${t.arenaMinAbbrev || "min"}` : ""}
          </p>
        </div>
      </div>

      {/* Action area */}
      {pending ? (
        <div className="mt-2.5 pl-9 grid grid-cols-2 gap-2 pointer-events-auto">
          <button type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); onAccept(); }}
            className="sb-primary-btn mobile-pressable" style={{ padding: "10px", fontSize: 13 }}>
            {t.arenaAcceptInvite || "Accept invite"}
          </button>
          <button type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); onDecline(); }}
            className="mobile-pressable"
            style={{ padding: 10, border: "1px solid var(--card-border-idle)", borderRadius: 10, background: "rgba(120,120,128,0.22)", color: "var(--color-text)", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
            {t.arenaDeclineInvite || "Decline"}
          </button>
        </div>
      ) : waiting ? null
        : completedToday ? null
        : challenge.needsTimer && challenge.timeEstimateMin ? (
          <div className="mt-2.5 pl-9 pointer-events-auto">
            <ChallengeTimerInline
              challengeId={challenge.id}
              targetMinutes={challenge.timeEstimateMin}
              busy={busy}
              t={t}
              onComplete={onComplete}
            />
          </div>
        ) : null}

      {showTapHint && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, zIndex: 3, borderRadius: 10, background: "rgba(2,6,23,0.92)", border: "1px solid rgba(103,232,249,0.55)", color: "#cffafe", fontSize: 12, fontWeight: 600, textAlign: "center", padding: "8px 10px", boxShadow: "0 6px 18px rgba(0,0,0,0.35)" }}>
          {t.questCompleteGestureHint}
        </div>
      )}
    </div>
  );
}

// ─── QuestBoard ───────────────────────────────────────────────────────────────

function QuestBoard({
  pinnedQuests,
  otherQuests,
  pinnedQuestProgressById,
  dailyQuestFreshDayKey = "",
  dailyQuestFreshStorageId = "",
  canRerollRandom,
  onRerollRandom,
  rerollButtonLabel,
  rerollButtonTitle,
  completedIds,
  pendingQuestIds = [],
  questRenderCount,
  onCompleteQuest,
  resetTimer,
  postTimerRow = null,
  rerollingQuestId = null,
  rerollingPinned = false,
  compact = false,
  renderQuestTimer = null,
  renderQuestMechanic = null,
  emptyPinnedSlotCount = 0,
  emptyOtherSlotCount = 0,
  onOpenHabitPicker = null,
  onRequestRandomReroll = null,
  maxDailyQuests = 6,
  // Challenge props
  challenges = [],
  meUid = "",
  busyChallengeId = null,
  optimisticDoneChallenges = null,
  onCompleteChallenge = null,
  onAcceptChallenge = null,
  onDeclineChallenge = null,
}) {
  const { t } = useTheme();
  const pinnedSlotTotal = pinnedQuests.length + Math.max(0, Number(emptyPinnedSlotCount) || 0);
  const otherSlotTotal = otherQuests.length + Math.max(0, Number(emptyOtherSlotCount) || 0);
  const hasPinned = pinnedSlotTotal > 0;
  const hasOther = otherSlotTotal > 0;
  const hasChallenges = challenges.length > 0;

  const tabs = [];
  if (hasPinned) tabs.push("habits");
  if (hasOther) tabs.push("daily");
  if (hasChallenges) tabs.push("challenges");

  const [activeQTab, setActiveQTab] = useState(tabs[0] || "habits");
  const [showFreshDailyBadge, setShowFreshDailyBadge] = useState(false);

  const [pinnedListRef] = useAutoAnimate();
  const [otherListRef] = useAutoAnimate();
  const [fallbackListRef] = useAutoAnimate();
  const pendingSet = useMemo(() => new Set(Array.isArray(pendingQuestIds) ? pendingQuestIds : []), [pendingQuestIds]);
  const dailySeenStorageKey = dailyQuestFreshStorageId ? `life_rpg_daily_quests_seen_${dailyQuestFreshStorageId}` : "";

  const markDailyTabSeen = useCallback(() => {
    if (!dailyQuestFreshDayKey || !dailySeenStorageKey || typeof window === "undefined") {
      setShowFreshDailyBadge(false);
      return;
    }
    try { window.localStorage.setItem(dailySeenStorageKey, dailyQuestFreshDayKey); } catch { /* ignore */ }
    setShowFreshDailyBadge(false);
  }, [dailyQuestFreshDayKey, dailySeenStorageKey]);

  const sortQuests = useCallback((quests) => {
    return [...quests].sort((a, b) => {
      const aDone = completedIds.includes(a.id);
      const bDone = completedIds.includes(b.id);
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  }, [completedIds]);

  const sortedPinnedQuests = useMemo(() => sortQuests(pinnedQuests), [pinnedQuests, sortQuests]);
  const sortedOtherQuests = useMemo(() => sortQuests(otherQuests), [otherQuests, sortQuests]);

  useLayoutEffect(() => {
    if (!hasOther || !dailyQuestFreshDayKey || !dailySeenStorageKey || typeof window === "undefined") {
      setShowFreshDailyBadge(false);
      return;
    }
    try {
      const lastSeenDayKey = window.localStorage.getItem(dailySeenStorageKey) || "";
      setShowFreshDailyBadge(lastSeenDayKey !== dailyQuestFreshDayKey);
    } catch {
      setShowFreshDailyBadge(false);
    }
  }, [hasOther, dailyQuestFreshDayKey, dailySeenStorageKey]);

  useLayoutEffect(() => {
    if (activeQTab === "daily" && showFreshDailyBadge) markDailyTabSeen();
  }, [activeQTab, showFreshDailyBadge, markDailyTabSeen]);

  // Switch to challenges tab if it appears while another tab is active
  useLayoutEffect(() => {
    if (!tabs.includes(activeQTab)) setActiveQTab(tabs[0] || "habits");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.join(",")]);

  const totalQuestCap = Math.max(1, Number(maxDailyQuests) || 6);
  const completedTodayCount = Math.min(totalQuestCap, completedIds.length);
  const pinnedDone = pinnedQuests.filter((q) => completedIds.includes(q.id)).length;
  const otherDone = otherQuests.filter((q) => completedIds.includes(q.id)).length;

  // Challenge badge counts
  const tKey = todayKey();
  const optimisticSet = optimisticDoneChallenges instanceof Set ? optimisticDoneChallenges : new Set();
  const accepted = challenges.filter((c) => {
    const isCreator = !!(c.creator?.username && c.creator.username === meUid);
    return isCreator || !!c.myAcceptedAt;
  });
  const challengeDoneToday = accepted.filter((c) => c.myLastCompletionDayKey === tKey || optimisticSet.has(c.id)).length;
  const challengePendingCount = challenges.length - accepted.length;

  // Tab-bar grid template:
  //  - 2 tabs (no Challenges): 1fr / 1fr — equal split, both labels visible.
  //  - 3 tabs: active = 2fr, inactive = 1fr — collapses inactive labels to
  //    just the icon to fit Challenges + Habits + Quests on mobile.
  // Animated via CSS transition on grid-template-columns.
  const isEqualLayout = tabs.length <= 2;
  const gridTemplateColumns = isEqualLayout
    ? tabs.map(() => "1fr").join(" ")
    : tabs.map((tab) => (tab === activeQTab ? "2fr" : "1fr")).join(" ");

  return (
    <div className={`relative ${compact ? "" : "lg:col-span-2"}`}>
      {/* Timer row */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2" style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>
          <span>⏰</span>
          <span className="cinzel">{t.dailyResetLabel}</span>
          <span className="font-mono font-bold" style={{ color: "var(--color-primary)" }}>{resetTimer}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="cinzel text-[11px]" style={{ color: "var(--color-muted)" }}>{completedTodayCount}/{totalQuestCap}</span>
        </div>
      </div>

      {postTimerRow ? <div className="mb-3">{postTimerRow}</div> : null}

      {/* Tab bar — expanding-active variant (Tab B).
          Active tab = 3fr, inactive = 1fr. Label is hidden on inactive
          tabs via max-width collapse; grid-template-columns transitions
          smoothly between states. */}
      {tabs.length > 1 && (
        <div
          className={`qb-tab-bar qb-tab-bar-expand mb-4${isEqualLayout ? " qb-tab-bar-equal" : ""}`}
          style={{ gridTemplateColumns }}
        >
          {hasPinned && (
            <button type="button" data-qtab="habits" data-tour="qb-tab-habits"
              className={`qb-tab-btn ${activeQTab === "habits" ? "qb-tab-active" : ""}`}
              onClick={() => setActiveQTab("habits")}>
              <span className="qb-tab-icon" aria-hidden="true">📌</span>
              <span className="qb-tab-label">{t.pinnedSection}</span>
              <span className="qb-tab-count">{pinnedDone}/{pinnedSlotTotal}</span>
            </button>
          )}

          {hasOther && (
            <button type="button" data-qtab="daily" data-tour="qb-tab-daily"
              className={`qb-tab-btn ${activeQTab === "daily" ? "qb-tab-active" : ""}`}
              onClick={() => { setActiveQTab("daily"); if (showFreshDailyBadge) markDailyTabSeen(); }}>
              <span className="qb-tab-icon" aria-hidden="true">🎲</span>
              <span className="qb-tab-label">{t.otherSection}</span>
              <span className="qb-tab-count">{otherDone}/{otherSlotTotal}</span>
              {showFreshDailyBadge ? (
                <span className="qb-tab-fresh" aria-label={t.dailyQuestFreshBadge || "NEW"}>
                  <span className="qb-tab-fresh__spark">✦</span>
                  <span className="qb-tab-fresh__label">{t.dailyQuestFreshBadge || "NEW"}</span>
                </span>
              ) : null}
            </button>
          )}

          {hasChallenges && (
            <button type="button" data-qtab="challenges"
              className={`qb-tab-btn ${activeQTab === "challenges" ? "qb-tab-active" : ""}`}
              onClick={() => setActiveQTab("challenges")}>
              <span className="qb-tab-icon" aria-hidden="true">⚔️</span>
              <span className="qb-tab-label">{t.challengesTab || "Challenges"}</span>
              {challengePendingCount > 0 ? (
                <span className="qb-tab-count qb-tab-count-alert">{challengePendingCount}</span>
              ) : null}
            </button>
          )}
        </div>
      )}

      {/* Tab content */}
      <div data-tour="daily-panel" className="qb-tab-content">

        {/* Habits tab */}
        {activeQTab === "habits" && hasPinned && (
          <div className="qb-panel-enter">
            <div ref={pinnedListRef} className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-3"}`}>
              {sortedPinnedQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const isPending = pendingSet.has(quest.id);
                const pinnedProgress = pinnedQuestProgressById?.[quest.id] || { daysCompleted: 0, totalDays: 21 };
                const progressPercent = Math.max(0, Math.min(100, (pinnedProgress.daysCompleted / pinnedProgress.totalDays) * 100));
                const timerNode = renderQuestTimer && quest.needsTimer && !isDone ? renderQuestTimer(quest) : null;
                const mechanicNode = !timerNode && renderQuestMechanic && !isDone ? renderQuestMechanic(quest) : null;
                return (
                  <QuestItem key={`pinned-${quest.id}`} quest={{ ...quest, isPending }} index={index}
                    isDone={isDone} questRenderCount={questRenderCount} compact={compact} t={t}
                    onCompleteQuest={onCompleteQuest} isLongTapOnly={true} isRerolling={rerollingPinned}
                    timerActive={Boolean(timerNode)} mechanicActive={Boolean(mechanicNode)}>
                    <div className="mt-2.5 pl-9 pointer-events-none">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] cinzel tracking-wider uppercase" style={{ color: "var(--color-primary)" }}>{t.progressLabel || "Progress"}</span>
                        <span className="cinzel text-xs font-bold" style={{ color: "var(--color-text)" }}>{pinnedProgress.daysCompleted}/{pinnedProgress.totalDays}</span>
                      </div>
                      <div className="qb-progress-track">
                        <div className="qb-progress-fill" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                    {timerNode ? <div className="pointer-events-auto">{timerNode}</div> : null}
                    {mechanicNode}
                  </QuestItem>
                );
              })}
              {emptyPinnedSlotCount > 0 && onOpenHabitPicker
                ? Array.from({ length: emptyPinnedSlotCount }).map((_, idx) => (
                    <EmptySlotCard key={`empty-pinned-${idx}`}
                      label={t.emptyHabitSlotLabel || "New habit unlocked"}
                      cta={t.emptyHabitSlotCta || "Pick a habit"}
                      onClick={onOpenHabitPicker} />
                  ))
                : null}
            </div>
          </div>
        )}

        {/* Quests tab */}
        {activeQTab === "daily" && hasOther && (
          <div className="qb-panel-enter flex flex-col">
            <div ref={otherListRef} className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-3"}`}>
              {sortedOtherQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const isPending = pendingSet.has(quest.id);
                const timerNode = renderQuestTimer && quest.needsTimer && !isDone ? renderQuestTimer(quest) : null;
                const mechanicNode = !timerNode && renderQuestMechanic && !isDone ? renderQuestMechanic(quest) : null;
                return (
                  <QuestItem key={quest.id} quest={{ ...quest, isPending }} index={index}
                    isDone={isDone} questRenderCount={questRenderCount} compact={compact} t={t}
                    onCompleteQuest={onCompleteQuest} isLongTapOnly={true}
                    isRerolling={quest.id === rerollingQuestId}
                    timerActive={Boolean(timerNode)} mechanicActive={Boolean(mechanicNode)}>
                    {timerNode ? <div className="pointer-events-auto">{timerNode}</div> : null}
                    {mechanicNode}
                  </QuestItem>
                );
              })}
              {emptyOtherSlotCount > 0
                ? Array.from({ length: emptyOtherSlotCount }).map((_, idx) => (
                    <EmptySlotCard key={`empty-other-${idx}`}
                      label={t.emptyQuestSlotLabel || "New quest unlocked"}
                      cta={t.emptyQuestSlotCta || "Roll a quest"}
                      onClick={onRequestRandomReroll || onRerollRandom} />
                  ))
                : null}
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={onRerollRandom} disabled={!canRerollRandom}
                className="mobile-pressable qb-reroll-btn" title={rerollButtonTitle}>
                <span>🎲</span> {rerollButtonLabel}
              </button>
            </div>
          </div>
        )}

        {/* Challenges tab */}
        {activeQTab === "challenges" && hasChallenges && (
          <div className="qb-panel-enter flex flex-col gap-3">
            {challenges.map((c) => (
              <ChallengeItem key={c.id} challenge={c} meUid={meUid} t={t}
                busy={busyChallengeId === c.id}
                optimisticDone={optimisticSet.has(c.id)}
                onComplete={() => onCompleteChallenge?.(c.id)}
                onAccept={() => onAcceptChallenge?.(c.id)}
                onDecline={() => onDeclineChallenge?.(c.id)} />
            ))}
          </div>
        )}

        {/* Fallback: only daily quests, no tabs */}
        {tabs.length <= 1 && !hasPinned && hasOther && (
          <div className="qb-panel-enter flex flex-col">
            <div className="mb-3">
              <h3 className="cinzel text-sm font-bold tracking-wider" style={{ color: "var(--pinned-heading)" }}>{t.otherSection}</h3>
            </div>
            <div ref={fallbackListRef} className={`grid grid-cols-1 ${compact ? "gap-3" : "md:grid-cols-2 gap-3"}`}>
              {sortedOtherQuests.map((quest, index) => {
                const isDone = completedIds.includes(quest.id);
                const isPending = pendingSet.has(quest.id);
                const timerNode = renderQuestTimer && quest.needsTimer && !isDone ? renderQuestTimer(quest) : null;
                const mechanicNode = !timerNode && renderQuestMechanic && !isDone ? renderQuestMechanic(quest) : null;
                return (
                  <QuestItem key={quest.id} quest={{ ...quest, isPending }} index={index}
                    isDone={isDone} questRenderCount={questRenderCount} compact={compact} t={t}
                    onCompleteQuest={onCompleteQuest} isLongTapOnly={true}
                    isRerolling={quest.id === rerollingQuestId}
                    timerActive={Boolean(timerNode)} mechanicActive={Boolean(mechanicNode)}>
                    {timerNode ? <div className="pointer-events-auto">{timerNode}</div> : null}
                    {mechanicNode}
                  </QuestItem>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={onRerollRandom} disabled={!canRerollRandom}
                className="mobile-pressable qb-reroll-btn" title={rerollButtonTitle}>
                <span>🎲</span> {rerollButtonLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

QuestBoard.propTypes = {
  pinnedQuests: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number.isRequired })).isRequired,
  otherQuests: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number.isRequired })).isRequired,
  pinnedQuestProgressById: PropTypes.object,
  dailyQuestFreshDayKey: PropTypes.string,
  dailyQuestFreshStorageId: PropTypes.string,
  canRerollRandom: PropTypes.bool.isRequired,
  onRerollRandom: PropTypes.func.isRequired,
  rerollButtonLabel: PropTypes.string.isRequired,
  rerollButtonTitle: PropTypes.string.isRequired,
  completedIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  pendingQuestIds: PropTypes.arrayOf(PropTypes.number),
  questRenderCount: PropTypes.number.isRequired,
  onCompleteQuest: PropTypes.func.isRequired,
  resetTimer: PropTypes.string.isRequired,
  compact: PropTypes.bool,
  challenges: PropTypes.array,
  meUid: PropTypes.string,
  busyChallengeId: PropTypes.string,
  optimisticDoneChallenges: PropTypes.instanceOf(Set),
  onCompleteChallenge: PropTypes.func,
  onAcceptChallenge: PropTypes.func,
  onDeclineChallenge: PropTypes.func,
};

export default QuestBoard;
