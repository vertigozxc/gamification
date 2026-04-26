import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { auth, googleProvider, firebaseInitError } from "./firebaseAuth";
import {
  upsertProfile,
  updateTheme,
  fetchLeaderboard,
  fetchGameState,
  fetchAllQuests,
  completeOnboarding,
  completeQuest as completeQuestOnServer,
  tickQuestCounter,
  submitQuestNote,
  resetDaily,
  resetHard,
  freezeStreak,
  buyExtraReroll,
  buyXpBoost,
  replacePinnedQuests,
  rerollPinned,
  fetchProfileStats,
  deleteProfile,
  addPinnedQuest,
  updatePreferredLanguage,
  completeOnboardingTour,
  resetOnboardingTour
} from "./api";
import useGameplayActions from "./hooks/useGameplayActions";
import useAuthSession from "./hooks/useAuthSession";
import useOnboardingPinned from "./hooks/useOnboardingPinned";
import useTimers from "./hooks/useTimers";
import useQuestTimers from "./hooks/useQuestTimers";
import { useTheme } from "./ThemeContext";
import {
  saveKey,
  characterNameKey,
  portraitKey,
  notesKey,
  MOBILE_TAB_STORAGE_KEY,
  normalizeMobileTab,
  getMobileTabTitle,
  normalizeQuest,
  normalizePinnedQuestProgress,
  compressImage,
  getTimestamp,
  createDefaultState,
  loadState,
  saveState,
  getMsUntilNextUtcMidnight
} from "./utils/gameHelpers";
import PortalPreloader from "./components/PortalPreloader";
import NetworkRetryBanner from "./components/NetworkRetryBanner";
import PullToRefresh from "./components/PullToRefresh";
import {
  evictCommunityCache,
  resetCity,
  dismissStreakBurnNotice,
  buyCosmetic,
  swapSilverToGold,
  buyPinnedRerollCoupon,
  activateCoupon,
  activateCosmetic
} from "./api";
import { parseCouponInventory, pickOldestCoupon, parseActiveCosmetics } from "./data/coupons";
import { IconTimer, IconSilver } from "./components/icons/Icons";

const FreezeSuccessModal = lazy(() => import("./components/modals/FreezeSuccessModal"));
const ResidentialAutoGrantModal = lazy(() => import("./components/modals/ResidentialAutoGrantModal"));
const QuizModal = lazy(() => import("./components/modals/QuizModal"));
const TierUnlockModal = lazy(() => import("./components/modals/TierUnlockModal"));
const ActivityLogsModal = lazy(() => import("./components/modals/ActivityLogsModal"));
const StreakBurnedDialog = lazy(() => import("./components/modals/StreakBurnedDialog"));
const RerollConfirmModal = lazy(() => import("./components/modals/RerollConfirmModal"));
const LogoutConfirmModal = lazy(() => import("./components/modals/LogoutConfirmModal"));
const NotesModal = lazy(() => import("./components/modals/NotesModal"));
const OnboardingModal = lazy(() => import("./components/modals/OnboardingModal"));
const PinnedReplacementModal = lazy(() => import("./components/modals/PinnedReplacementModal"));
const LoginScreen = lazy(() => import("./components/LoginScreen"));
const LevelUpPopup = lazy(() => import("./components/LevelUpPopup"));
const HabitMilestonePopup = lazy(() => import("./components/HabitMilestonePopup"));
const ThemePickerModal = lazy(() => import("./components/ThemePickerModal"));
const LanguagePickerModal = lazy(() => import("./components/LanguagePickerModal"));
const FloatingTexts = lazy(() => import("./components/FloatingTexts"));
const AppHeader = lazy(() => import("./components/AppHeader"));
const DesktopLayout = lazy(() => import("./components/DesktopLayout"));
const DevTestPanel = lazy(() => import("./components/DevTestPanel"));
const AboutAppModal = lazy(() => import("./components/modals/AboutAppModal"));
const ReferralsModal = lazy(() => import("./components/modals/ReferralsModal"));

// Full-screen spinner shown by Suspense while a lazy modal chunk is
// still downloading. Sits at z-index 86 (above the in-modal sheet at
// 85) so the user sees a continuous loading state from tap to fully
// loaded — no flash of the underlying tab content.
function ModalLazyFallback() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 86,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--card-bg, #0f172a)"
      }}
    >
      <div className="ref-spinner" />
    </div>
  );
}
// Eagerly imported — these render inline on the dashboard quest cards.
// Lazy-loading them caused a visible 1-3s flicker where timer/counter
// quests rendered without their UI (Suspense fallback was null), making
// timer quests look like simple instant-complete tasks until the chunk
// arrived. The chunk is tiny (~5KB raw / ~1.9KB gzipped each), so the
// extra round-trip costs more than it saves.
import QuestTimerControls from "./components/QuestTimerControls";
import QuestCounterInline from "./components/QuestCounterInline";
const QuestNoteModal = lazy(() => import("./components/modals/QuestNoteModal"));
const NotesHistoryModal = lazy(() => import("./components/modals/NotesHistoryModal"));
const QuestCompletePopup = lazy(() => import("./components/QuestCompletePopup"));
const SingleHabitPickerModal = lazy(() => import("./components/modals/SingleHabitPickerModal"));
const AnimatedOnboardingTour = lazy(() => import("./components/tour/AnimatedOnboardingTour"));
const CityTab = lazy(() => import("./components/tabs/CityTab"));
const DashboardTab = lazy(() => import("./components/tabs/DashboardTab"));
const LeaderboardTab = lazy(() => import("./components/tabs/LeaderboardTab"));
const StoreTab = lazy(() => import("./components/tabs/StoreTab"));
const ProfileTab = lazy(() => import("./components/tabs/ProfileTab"));

const FREE_PINNED_REROLL_INTERVAL_MS = 21 * 24 * 60 * 60 * 1000;

  function getUsername(authUser) {
    if (!authUser) return null;
    return authUser.uid || null;
  }

  function App() {
    const {
      authUser,
      authLoading,
      authError,
      handleGoogleLogin,
      handleLogout
    } = useAuthSession({ auth, googleProvider, firebaseInitError });
    const username = getUsername(authUser);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      if (authUser || authLoading) {
        return;
      }

      let authMode = "";
      let autostart = "";
      let authNonce = "";
      try {
        const params = new URLSearchParams(window.location.search);
        authMode = String(params.get("authMode") || "");
        autostart = String(params.get("autostart") || "");
        authNonce = String(params.get("authNonce") || "");
      } catch {
        return;
      }

      if (authMode !== "external" || autostart !== "1") {
        return;
      }

      const markerKey = `life_rpg_app_external_autostart:${authNonce || "default"}`;
      try {
        if (window.sessionStorage.getItem(markerKey) === "1") {
          return;
        }
        window.sessionStorage.setItem(markerKey, "1");
      } catch {
        // ignore marker failures, still try once
      }

      handleGoogleLogin();
    }, [authUser, authLoading, handleGoogleLogin]);
  const {
    t,
    tf,
    themeId,
    setThemeId,
    languageId,
    setLanguageId,
    languageIds,
    getThemeMeta,
    getLanguageMeta,
    translateQuest,
    translateCategory
  } = useTheme();
  const defaultCharacterName = t.defaultCharacterName;
  const [state, setState] = useState(createDefaultState);
  const [characterName, setCharacterName] = useState(defaultCharacterName);
  const [editingName, setEditingName] = useState(false);

  const handleQuestCompleteWrapper = (quest, event) => {
    completeQuest(quest, event);
  };

  const [nameDraft, setNameDraft] = useState(defaultCharacterName);
  const [portraitData, setPortraitData] = useState("");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quests, setQuests] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [initialDataResolved, setInitialDataResolved] = useState(false);
  const [dataLoadError, setDataLoadError] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRerollConfirm, setShowRerollConfirm] = useState(false);
  const [showFreezeSuccess, setShowFreezeSuccess] = useState(false);
  // Surfaces auto-granted Residential perks delivered by the server's
  // lazy /api/game-state response (when 30-day or 365-day cycles
  // elapsed during the user's absence). { freeze, vacation } | null.
  const [residentialAutoGrant, setResidentialAutoGrant] = useState(null);
  // Server-detected tier crossing — see TierUnlockModal. Null when no
  // pending unlock; populated with the diff payload from the most
  // recent quest completion that crossed a level/streak threshold.
  const [tierUnlock, setTierUnlock] = useState(null);
  const surfacePendingGrants = (response) => {
    const pg = response?.pendingGrants;
    if (pg && (Number(pg.freeze) > 0 || Number(pg.vacation) > 0)) {
      setResidentialAutoGrant({
        freeze: Number(pg.freeze) || 0,
        vacation: Number(pg.vacation) || 0
      });
    }
  };
  // ISO timestamp when the user's streak burned out, or null if no notice
  // is pending. Server sets it via cron / /api/reset-daily; we surface it
  // once via a modal and clear it through /api/streak/dismiss-burn-notice.
  const [streakBurnedNoticeAt, setStreakBurnedNoticeAt] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showActivityLogs, setShowActivityLogs] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  // Bumping this key forces AchievementsSection to refetch even if it's
  // already mounted and expanded. Driven by events that may unlock new
  // achievements server-side without going through a full game-state
  // refresh — e.g. quiz pass (scholar), language change (polyglot).
  const [achievementsRefreshKey, setAchievementsRefreshKey] = useState(0);
  const bumpAchievements = () => setAchievementsRefreshKey((v) => v + 1);
  const [questCompletePopup, setQuestCompletePopup] = useState(null);
  const [deleteProfileOpen, setDeleteProfileOpen] = useState(false);
  // These are also referenced in the mobile-shell-state useEffect dependency
  // array above, so they must be declared before that effect runs — hence
  // grouped with the other overlay-state flags instead of next to the
  // handler functions where they're used.
  const [timerLimitPopup, setTimerLimitPopup] = useState(false);
  const [singleHabitPickerOpen, setSingleHabitPickerOpen] = useState(false);
  const [showNotesHistory, setShowNotesHistory] = useState(false);
  const [cityResetConfirmOpen, setCityResetConfirmOpen] = useState(false);
  const [cityResetBusy, setCityResetBusy] = useState(false);
  // The pinned coupon id we'll consume when the user confirms the
  // city-reset modal. Set when an inventory tap on a city_reset
  // coupon opens the confirm modal; cleared on close. Distinct from
  // cityResetBusy (which is the in-flight network flag) so we can
  // tell "modal opened from inventory" apart from "modal opened from
  // somewhere else".
  const [cityResetCouponId, setCityResetCouponId] = useState(null);
  const [singleHabitPickerSaving, setSingleHabitPickerSaving] = useState(false);
  const [singleHabitPickerError, setSingleHabitPickerError] = useState("");
  const [profileStats, setProfileStats] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const isEmbeddedApp = typeof window !== "undefined" && (() => {
    try {
      return new URLSearchParams(window.location.search).get("embed") === "1";
    } catch {
      return false;
    }
  })();
  const [cityFullscreen, setCityFullscreen] = useState(false);
  const [mobileTab, setMobileTab] = useState(() => {
    if (typeof window === "undefined") {
      return "dashboard";
    }

    // One-shot crash-recovery override. ErrorBoundary writes
    // `rpg_recover_to` before reloading so the freshly-booted app
    // doesn't immediately re-mount the tab that just crashed. The
    // flag is consumed (removed) on the way out so a normal reload
    // later doesn't keep forcing the user to Dashboard.
    try {
      const recover = localStorage.getItem("rpg_recover_to");
      if (recover) {
        localStorage.removeItem("rpg_recover_to");
        return recover;
      }
    } catch {
      // ignore — fall through to default
    }

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("embed") !== "1") {
        return "dashboard";
      }
      return "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [privateNotes, setPrivateNotes] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showHabitMilestone, setShowHabitMilestone] = useState(false);
  const [habitMilestoneTitle, setHabitMilestoneTitle] = useState("");
  const [habitMilestoneSilver, setHabitMilestoneSilver] = useState(20);
  const [showCity, setShowCity] = useState(true);
  const [overrideStage, setOverrideStage] = useState(null);
  const questRenderCountRef = useRef(0);
  const portraitUploadRef = useRef(null);
  const levelDisplayRef = useRef(null);
  const uidRef = useRef(null);
  const dayMarkerRef = useRef(new Date().toDateString());
  const previousMobileTabRef = useRef("dashboard");
  const tabPrefetchDoneForUidRef = useRef("");
  const normalizeLocalizedQuest = (quest) => normalizeQuest(quest, translateQuest, translateCategory);

  const { resetTimer } = useTimers(serverOffsetMs);
  const {
    sessionsByQuestId: timerSessionsByQuestId,
    getElapsedMs: getTimerElapsedMs,
    start: startQuestTimerAction,
    pause: pauseQuestTimerAction,
    resume: resumeQuestTimerAction,
    stop: stopQuestTimerAction
  } = useQuestTimers({
    username,
    initialSessions: state.activeTimers || [],
    serverOffsetMs
  });

  function handleCityRewardClaimed(result) {
    const user = result?.user;
    if (!user || typeof user !== "object") return;
    setState((prev) => ({
      ...prev,
      lvl: Number.isFinite(Number(user.level)) ? Number(user.level) : prev.lvl,
      xp: Number.isFinite(Number(user.xp)) ? Number(user.xp) : prev.xp,
      xpNext: Number.isFinite(Number(user.xpNext)) ? Number(user.xpNext) : prev.xpNext,
      silver: Number.isFinite(Number(user.silver)) ? Number(user.silver) : prev.silver
    }));
    // Tour signal: any reward type (XP / silver / freeze) flips the
    // flag. The spin-wheel onboarding step's condition gate watches
    // this so NEXT only enables after the user actually claimed.
    setSpinTourClaimed(true);
  }

  function applyServerTimeSync(payload) {
    if (!payload || typeof payload !== "object") return;
    const serverNowMs = Number(payload.serverNowMs);

    if (Number.isFinite(serverNowMs)) {
      setServerOffsetMs(serverNowMs - Date.now());
    }
  }

  const {
    showPinnedReplaceModal,
    setShowPinnedReplaceModal,
    replacePinnedQuestIds,
    replacePinnedSearch,
    setReplacePinnedSearch,
    replacePinnedSaving,
    replacePinnedError,
    showOnboarding,
    showTour,
    setShowTour,
    wizardStep,
    setWizardStep,
    onboardingName,
    setOnboardingName,
    onboardingReferralCode,
    setOnboardingReferralCode,
    onboardingQuestIds,
    onboardingQuestSearch,
    setOnboardingQuestSearch,
    onboardingError,
    onboardingSaving,
    filteredOnboardingQuests,
    filteredReplacePinnedQuests,
    allEligibleQuestOptions,
    resetOnLogout,
    toggleOnboardingQuest,
    toggleReplacePinnedQuest,
    openPinnedReplacementModal,
    pinnedReplacementOpening,
    handleBuyPinnedReplacement,
    handleCompleteOnboarding,
    handleSkipOnboarding,
    seedAllQuestOptions,
    applyServerBootstrap,
    customQuests,
    customSaving,
    customError,
    setCustomError,
    handleCreateCustomQuest,
    handleUpdateCustomQuest,
    handleDeleteCustomQuest
  } = useOnboardingPinned({
    authUser,
    username,
    state,
    setState,
    setQuests,
    setCharacterName,
    setNameDraft,
    portraitData,
    setPortraitData,
    fetchLeaderboard,
    setLeaderboard,
    completeOnboarding,
    replacePinnedQuests,
    onServerTimeSync: applyServerTimeSync,
    normalizeQuest: normalizeLocalizedQuest,
    getTimestamp,
    portraitKey
  });

  // ── Animated onboarding tour ───────────────────────────────────────
  // Finish flow: call /tour/complete (with or without the +1 level
  // bonus depending on whether the user tapped Skip or walked through),
  // apply the returned user state so the badge updates instantly, then
  // close the tour.
  const finalizeTour = async ({ awardLevel }) => {
    // Hard tear-down: drop the tour open flag AND every piece of
    // tour-only state in the same tick. Without these resets a
    // mid-tour Skip could leave forcedHabitsTab pinning the habit
    // tab or tourStepId blocking lockBegin checks elsewhere — the
    // result on screen is "looks closed but some UI is still inert".
    setShowTour(false);
    setForcedHabitsTab(null);
    setTourStepId(null);
    // Land the user on the dashboard after the tour completes, no
    // matter which tab the last step ended on.
    startTransition(() => setMobileTab("dashboard"));
    const uname = authUser?.uid || username;
    if (!uname) return;
    try {
      const result = await completeOnboardingTour(uname, { awardLevel });
      const u = result?.user;
      if (u && result?.awarded) {
        setState((prev) => ({
          ...prev,
          lvl: u.level ?? prev.lvl,
          xp: u.xp ?? prev.xp,
          xpNext: u.xpNext ?? prev.xpNext,
          user: { ...prev.user, level: u.level ?? prev.user?.level, xp: u.xp ?? prev.user?.xp, xpNext: u.xpNext ?? prev.user?.xpNext }
        }));
      }
    } catch {
      // Non-fatal — the tour already closed on the client, next login
      // will just reopen the server flag (or the user can replay it
      // from Settings).
    }
  };

  const [tourStepId, setTourStepId] = useState(null);
  const [forcedHabitsTab, setForcedHabitsTab] = useState(null);
  // Tour signal: flipped to true inside handleCityRewardClaimed when
  // the user actually presses "Claim daily reward" inside the spin
  // modal. The spin-wheel onboarding step uses this as its
  // condition-gate satisfier so NEXT only becomes tappable after the
  // claim — without a claim, the bubble is stuck on this step.
  const [spinTourClaimed, setSpinTourClaimed] = useState(false);

  const handleRestartTour = async () => {
    const uname = authUser?.uid || username;
    try {
      if (uname) await resetOnboardingTour(uname);
    } catch { /* non-fatal */ }
    startTransition(() => setMobileTab("dashboard"));
    setShowTour(true);
  };

  const tourSteps = useMemo(() => {
    const pinnedLimit = Number(state?.questSlots?.pinned) || 2;
    const list = [];
    list.push({
      id: "welcome",
      kind: "welcome",
      title: t.tourWelcomeTitle || "Welcome aboard!",
      text: t.tourWelcomeText || "Quick 2-minute tour of the main areas. Finish it to claim a +1 level bonus."
    });
    // Setup-family tour steps stay in the array even after the modal
    // closes — they just mark themselves hidden so the tour auto-skips
    // them. This keeps stepIndex stable through the showOnboarding
    // transition so the main tour actually continues onto the
    // Dashboard / City / Store tabs instead of falling off.
    const hideSetup = !showOnboarding;
    list.push({
      id: "setup-name",
      hidden: hideSetup,
      target: '[data-tour="setup-name"]',
      title: t.tourSetupNameTitle || "Pick your name",
      text: t.tourSetupNameText || "Type a nickname — other players will see it on the leaderboard.",
      gate: "condition",
      isSatisfied: () => onboardingName.trim().length >= 1,
      autoAdvance: false,
      onEnter: () => setWizardStep(0),
      // Pin the bubble below the input so the keyboard doesn't shove
      // everything around when the user taps the field. Scroll the
      // target to the TOP of the viewport so the bubble below it
      // never covers it.
      bubblePlacement: "bottom",
      scrollBlock: "start",
      scroll: true
    });
    list.push({
      id: "setup-handle",
      hidden: hideSetup,
      target: '[data-tour="setup-handle"]',
      title: t.tourSetupHandleTitle || "Your @username",
      text: t.tourSetupHandleText || "Unique player identifier for friends to find you.",
      gate: "next",
      onEnter: () => setWizardStep(0),
      bubblePlacement: "bottom",
      scrollBlock: "start",
      scroll: true
    });
    list.push({
      // NEW step: friend's referral-code input. Sits between
      // @username and Continue so it shares the same wizardStep=0
      // page. The input is OPTIONAL — the user can paste a code or
      // just tap Next. Server treats empty as "no referral".
      id: "setup-friends-code",
      hidden: hideSetup,
      target: '[data-tour="setup-referral"]',
      title: t.tourSetupFriendsCodeTitle || "Have a friend's code?",
      text: t.tourSetupFriendsCodeText || "Paste it here to grant +50 silver to both of you when you reach level 5. Skip if you don't have one.",
      gate: "next",
      onEnter: () => setWizardStep(0),
      bubblePlacement: "bottom",
      scrollBlock: "start",
      scroll: true
    });
    list.push({
      id: "setup-continue",
      hidden: hideSetup,
      target: '[data-tour="setup-continue"]',
      title: t.tourSetupContinueTitle || "Nice — next up",
      text: t.tourSetupContinueText || "Tap Continue to move on to picking your daily habits.",
      gate: "condition",
      isSatisfied: () => wizardStep === 1,
      autoAdvance: true,
      // User advances by tapping the real Continue button, not a tour
      // Next button.
      hideNext: true,
      onEnter: () => setWizardStep(0),
      bubblePlacement: "top",
      scroll: true
    });
    // New habits tour flow matching the slide-bar design:
    // Single habits step: user picks `pinnedLimit` (default 2) habits
    // from the Presets tab and the tour auto-advances the moment the
    // selection count crosses the threshold. The previous flow walked
    // the user through a separate "Custom" tab tour step, but it was
    // mostly noise — the Custom tab is still reachable via the slide
    // bar and the Custom tab is visible inside the spotlight, so the
    // walkthrough step was redundant. fillBottom keeps the spotlight
    // anchored to the slide bar's top edge so it doesn't resize as
    // the user picks habits.
    list.push({
      id: "habits-browse",
      hidden: hideSetup,
      // Spotlight covers the WHOLE habits picker — slide bar at top,
      // category filter, search, and the habit list — so the user can
      // freely tap habits, switch tabs, search, etc. Anything the user
      // needs to interact with on this screen is inside the cutout.
      target: '[data-tour="habits-picker"]',
      title: t.tourHabitsBrowseTitle || "Pick your habits",
      // Short copy on purpose — bubble sits at the bottom of the
      // viewport INSIDE the cutout, so we want it as compact as
      // possible to leave room for the habit cards above.
      text: t.tourHabitsBrowseText || "Pick 2 habits to build daily. Use the Custom tab to add your own.",
      // Manual Next: user picks 2 habits and taps Next themselves.
      // Previously autoAdvance:true jumped the user to the next step
      // the moment the second pick landed — felt yanky if they
      // wanted to read the third blurb or swap a pick.
      gate: "condition",
      isSatisfied: () => Array.isArray(onboardingQuestIds) && onboardingQuestIds.length >= pinnedLimit,
      autoAdvance: false,
      hideNext: false,
      onEnter: () => { setWizardStep(1); setForcedHabitsTab("presets"); },
      // fillBottom + bubblePlacement:"bottom" => spotlight extends
      // from the picker's top edge to the viewport bottom, and the
      // bubble lives INSIDE that cutout near the bottom edge. Keeps
      // the slide-bar (Presets/Custom) and the first few habits
      // unobstructed; the user can scroll the inner habit list past
      // the bubble if they want a habit at the bottom of the list.
      bubblePlacement: "bottom",
      fillBottom: true,
      scroll: false
    });
    list.push({
      id: "setup-begin",
      hidden: hideSetup,
      target: '[data-tour="setup-begin"]',
      title: t.tourSetupBeginTitle || "Ready for your adventure?",
      text: t.tourSetupBeginText || "Tap Start Adventure — we're heading into the game.",
      gate: "condition",
      isSatisfied: () => !showOnboarding,
      autoAdvance: true,
      // User advances by tapping the real Start Adventure button.
      hideNext: true,
      onEnter: () => setWizardStep(1),
      scroll: true
    });
    // Main tour, post-setup. The tour drives every tab transition
    // itself via onEnter; the user never has to tap a tab manually.
    // DASHBOARD: quest-board overview → daily-board overview.
    // The "tap the Daily tab" step was removed — the daily-board
    // step targets the standalone Daily Board card on the Dashboard,
    // not the QuestBoard's daily content, so the tap was unnecessary.
    list.push({
      id: "quest-board",
      target: '[data-tour="quest-board"]',
      title: t.tourQuestBoardTitle || "Your quest board",
      text: t.tourQuestBoardText || "This is where you close habits every day.",
      gate: "next",
      hideBack: true,
      // Block taps inside the spotlight — the user should read the
      // bubble and tap Next, not start completing actual habits
      // mid-tour. Otherwise a misfired long-press would mark a habit
      // done and shift the daily progress bars while the tour is
      // still introducing what they are.
      blockInteraction: true,
      // First post-setup step — make sure we're on the dashboard.
      onEnter: () => { startTransition(() => setMobileTab("dashboard")); },
      scroll: true
    });
    list.push({
      id: "daily-board",
      // Spotlight the actual "DAILY BOARD X/Y" segmented progress card on
      // the Dashboard (above the quest list), NOT the quest list itself.
      // The previous target (`daily-board-panel`) was a desktop-only
      // element living in ProfilePanel.jsx — never rendered on the mobile
      // shell, so the tour fell back to a "missing" state and the user
      // could keep tapping the quest list. The mobile Daily Board card is
      // in DashboardTab.jsx and carries `data-tour="daily-board"`.
      target: '[data-tour="daily-board"]',
      title: t.tourDailyBoardTitle || "Full board = bonus",
      text: t.tourDailyBoardText || "Close the whole board and your streak grows — plus extra silver.",
      gate: "next",
      blockInteraction: true,
      scroll: true,
      scrollBlock: "center"
    });
    // CITY: tour switches to the city tab automatically (no more
    // "tap the City tab" prompts — those interrupt the flow and the
    // native iOS tab bar can't be properly highlighted from the
    // WebView). The new tab is selected on enter and the spotlight
    // fades back in once City has rendered.
    list.push({
      id: "city-hero",
      target: '[data-tour="city-hero"]',
      title: t.tourCityTitle || "Your city",
      text: t.tourCityText || "Every habit you complete grows this city. Let's take a walk through it.",
      gate: "next",
      blockInteraction: true,
      onEnter: () => { startTransition(() => setMobileTab("city")); },
      scroll: true
    });
    list.push({
      id: "park-district-tap",
      target: '[data-tour="district-park"]',
      title: t.tourCityDistrictsTitle || "Districts",
      text: t.tourCityDistrictsText || "The city is made of districts. Tap the Park district to open it up.",
      gate: "condition",
      isSatisfied: () => typeof document !== "undefined" && !!document.querySelector('[data-tour="district-upgrade"]'),
      autoAdvance: true,
      hideNext: true,
      bubblePlacement: "bottom",
      scroll: false
    });
    list.push({
      id: "park-upgrade",
      target: '[data-tour="district-upgrade"]',
      title: t.tourParkDistrictTitle || "Let's upgrade Park",
      text: t.tourParkDistrictText || "This first upgrade is on the house — tap Upgrade.",
      gate: "condition",
      isSatisfied: () => {
        const arr = Array.isArray(state?.districtLevels) ? state.districtLevels : [];
        return (Number(arr[2]) || 0) >= 1;
      },
      autoAdvance: true,
      hideNext: true,
      bubblePlacement: "top",
      scroll: true
    });
    list.push({
      id: "spin-wheel",
      target: '[data-tour="spin-wheel"]',
      title: t.tourSpinWheelTitle || "Daily spin",
      text: t.tourSpinWheelText || "Tap the spin button and claim your daily reward — Next will light up after you do.",
      // NEXT is rendered but DISABLED until the user actually claims
      // the daily reward inside the spin modal (any reward type
      // flips spinTourClaimed). Then the button enables and the
      // user taps it to advance. blockInteraction stays OFF so the
      // spotlit spin button itself remains tappable.
      gate: "condition",
      isSatisfied: () => spinTourClaimed,
      autoAdvance: false,
      hideNext: false,
      onEnter: () => { setSpinTourClaimed(false); },
      bubblePlacement: "top",
      scroll: true
    });
    // STORE — auto-switch tab on enter.
    list.push({
      id: "store-hero",
      target: '[data-tour="store-hero"]',
      title: t.tourStoreTitle || "The store",
      text: t.tourStoreText || "Spend silver on streak freezes, extra rerolls or an XP boost.",
      gate: "next",
      blockInteraction: true,
      onEnter: () => { startTransition(() => setMobileTab("store")); },
      scroll: true
    });
    // COMMUNITY — auto-switch tab + pre-select the Activity sub-tab.
    // Spotlight spans from the CommunityHero's TOP edge down to the
    // BOTTOM of the third player row via extendBottomTo. The user
    // sees the section header, the tabs and the podium all in one
    // active zone; the long #4+ tail below stays in the dim area.
    list.push({
      id: "community",
      target: '[data-tour="community-hero"]',
      extendBottomTo: '[data-tour="community-top3"]',
      title: t.tourCommunityTitle || "Community",
      text: t.tourCommunityText || "See the week's active players, add friends, take on group challenges.",
      gate: "next",
      blockInteraction: true,
      onEnter: () => {
        startTransition(() => setMobileTab("leaderboard"));
        try { window.__pendingSocialSubTab = "activity"; } catch { /* noop */ }
      },
      bubblePlacement: "bottom",
      scroll: true,
      scrollBlock: "start"
    });
    // PROFILE — spotlight just the 4 KPI cards (Total XP, Streak,
    // Silver, Level). Tighter cutout than the previous profile-stats
    // wrapper which also covered the Overall Statistics list below
    // it — the 4 cards are the canonical "your stats at a glance"
    // surface, and the per-row stats list isn't what we're
    // introducing. Auto-switches to the profile tab.
    list.push({
      id: "profile-overview",
      target: '[data-tour="profile-quickstats"]',
      title: t.tourProfileTitle || "Your stats",
      text: t.tourProfileText || "Total XP, streak, silver, level — your stats at a glance.",
      gate: "next",
      blockInteraction: true,
      onEnter: () => { startTransition(() => setMobileTab("profile")); },
      bubblePlacement: "auto",
      scroll: true,
      scrollBlock: "center"
    });
    return list;
  // Note: mobileTab intentionally omitted — the tour drives tab swaps
  // via onEnter callbacks now, and including it would cause the whole
  // step list to rebuild on every tab change. spinTourClaimed flips
  // on the daily-reward claim, which makes the steps array rebuild
  // and the bubble's NEXT button become tappable on the spin step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, tf, showOnboarding, onboardingName, onboardingQuestIds, state?.questSlots?.pinned, state?.districtLevels, spinTourClaimed, wizardStep]);

  useEffect(() => {
    uidRef.current = authUser ? authUser.uid : null;
    Promise.all([
      import("./eventLogger.js"),
      import("./abTesting.js")
    ]).then(([mod, ab]) => {
      if (authUser) {
        mod.setEventContext({
          userId: authUser.uid,
          username: authUser.displayName || authUser.email || authUser.uid,
          email: authUser.email || ""
        });
        ab.ensureAssignments(authUser.uid);
        mod.logEvent("auth_login", { meta: { provider: "firebase" } });
      } else {
        mod.setEventContext({ userId: "", username: "", email: "" });
        ab.ensureAssignments("");
      }
    }).catch(() => {});
  }, [authUser]);

  useEffect(() => {
    if (!isEmbeddedApp || typeof window === "undefined") {
      return undefined;
    }

    const handleMobileTabChange = (event) => {
      // Drop the tap entirely while the onboarding flow is active.
      // The native shell already gets `tabBarLocked:true` via the
      // postMessage bridge and renders the bar at 0.45 opacity with
      // pointerEvents:none — but that requires the iOS app to be
      // rebuilt with the latest WebAppScreen.js. This client-side
      // fallback makes the lock work even on a stale native build:
      // if a tap event somehow reaches the WebView, we ignore it.
      if (showOnboarding || showTour) return;
      // Tab-bar tap should return the user to the underlying screen —
      // dismiss any full-screen modal overlays first so the tab change
      // isn't invisible behind them.
      setShowNotesHistory(false);
      setShowThemePicker(false);
      setShowLanguagePicker(false);
      setShowAbout(false);
      setShowQuiz(false);
      setShowActivityLogs(false);
      setShowReferrals(false);
      setSingleHabitPickerOpen(false);
      setMobileTab(normalizeMobileTab(event?.detail));
    };

    window.addEventListener("life-rpg-mobile-tab", handleMobileTabChange);
    return () => window.removeEventListener("life-rpg-mobile-tab", handleMobileTabChange);
  }, [isEmbeddedApp, showOnboarding, showTour]);

  useEffect(() => {
    if (!isEmbeddedApp || typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(MOBILE_TAB_STORAGE_KEY, mobileTab);
    } catch {
      // ignore storage failures
    }
  }, [isEmbeddedApp, mobileTab]);

  useEffect(() => {
    if (!isEmbeddedApp) {
      return;
    }

    if (previousMobileTabRef.current !== mobileTab) {
      previousMobileTabRef.current = mobileTab;
    }
  }, [isEmbeddedApp, mobileTab]);

  useEffect(() => {
    if (!isEmbeddedApp || typeof window === "undefined") {
      return;
    }

    const bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== "function") {
      return;
    }

    const anyOverlayOpen = Boolean(
      showOnboarding
      // Note: showTour is intentionally NOT in this set anymore. We
      // keep the native tab bar VISIBLE during the onboarding tour
      // and instead lock its taps via the separate tabBarLocked
      // flag below. That gives the user a sense of place ("I can
      // see I'm on Dashboard / City / Store / etc.") without
      // letting them jump off the scripted flow.
      || cityFullscreen
      || showPinnedReplaceModal
      || pinnedReplacementOpening
      || showAbout
      || showQuiz
      || showActivityLogs
      || showReferrals
      || tierUnlock
      || showLogoutConfirm
      || showLevelUp
      || showHabitMilestone
      || showFreezeSuccess
      || showRerollConfirm
      || showNotesModal
      || showThemePicker
      || showLanguagePicker
      || achievementModalOpen
      || showNotesHistory
      || deleteProfileOpen
      || questCompletePopup
      || timerLimitPopup
      || singleHabitPickerOpen
    );
    // The injected wrapper relays to `window.webkit.messageHandlers.ReactNativeWebView.postMessage`,
    // which can be undefined during unload / WebView teardown on iOS. Swallow the TypeError.
    try {
      bridge.postMessage(JSON.stringify({
        type: "mobile-shell-state",
        showTabBar: Boolean(authUser) && !authLoading && !dataLoading && initialDataResolved && !anyOverlayOpen,
        // Tab bar stays VISIBLE during the tour but locked from
        // taps — see the comment on anyOverlayOpen above. The native
        // shell honours this flag by rendering the bar at reduced
        // opacity with pointerEvents:none.
        tabBarLocked: Boolean(showTour),
        loading: Boolean(authLoading || dataLoading || (authUser && !initialDataResolved)),
        activeTab: mobileTab,
        languageId
      }));
    } catch { /* bridge missing — WebView tearing down */ }
  }, [
    isEmbeddedApp, authUser, authLoading, dataLoading, initialDataResolved,
    showOnboarding, showTour, mobileTab, cityFullscreen, showPinnedReplaceModal, pinnedReplacementOpening,
    showAbout, showQuiz, showActivityLogs, showReferrals, tierUnlock, showLogoutConfirm, showLevelUp, showHabitMilestone,
    showFreezeSuccess, showRerollConfirm, showNotesModal, showThemePicker,
    showLanguagePicker, achievementModalOpen, showNotesHistory, deleteProfileOpen, questCompletePopup, timerLimitPopup,
    singleHabitPickerOpen, languageId
  ]);

  useEffect(() => {
    if (!authUser) {
      setState(createDefaultState());
      setQuests([]);
      setInitialDataResolved(false);
      setCharacterName(defaultCharacterName);
      setNameDraft(defaultCharacterName);
      setPortraitData("");
      setShowNotesModal(false);
      setPrivateNotes("");
      setNotesDraft("");
      setMobileTab("dashboard");
      resetOnLogout();
      questRenderCountRef.current = 0;
      dayMarkerRef.current = String(new Date().getUTCFullYear()) + "-" + String(new Date().getUTCMonth()) + "-" + String(new Date().getUTCDate());
      return;
    }
    const uid = authUser.uid;
    const name = authUser.displayName || defaultCharacterName;
    setCharacterName(name);
    setNameDraft(name);
    // Deliberately ignore authUser.photoURL (Google avatar). Google's CDN
    // sometimes returns blank/403 and the fallback spinner is ugly. The
    // user uploads their own photo via the profile editor; the server's
    // stored photoUrl is what we trust (loaded below from /game-state).
    setPortraitData("");
    const savedNotes = localStorage.getItem(notesKey(uid)) || "";
    setPrivateNotes(savedNotes);
    setNotesDraft(savedNotes);
    dayMarkerRef.current = String(new Date().getUTCFullYear()) + "-" + String(new Date().getUTCMonth()) + "-" + String(new Date().getUTCDate());
    questRenderCountRef.current = 0;
    setState(() => {
      const loaded = loadState(uid);
      if (!loaded.logs.length) {
        loaded.logs.push({
          msg: t.welcomeBack,
          classes: "opacity-70 italic",
          timestamp: getTimestamp()
        });
      }
      return loaded;
    });
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setLeaderboard([]);
      setDataLoadError("");
      setDataLoading(false);
      setInitialDataResolved(false);
      return;
    }
    const profileName = authUser.displayName || defaultCharacterName;
    // Don't seed the profile with the Google avatar — it's flaky and users
    // prefer to set their own photo. New accounts start with no portrait.
    const profilePortrait = "";
    setInitialDataResolved(false);
    setDataLoading(true);
    setDataLoadError("");
    Promise.resolve()
      .then(() => fetchGameState(authUser.uid))
      .catch((err) => {
        if ((err?.message || "") !== "User not found") {
          throw err;
        }
        return upsertProfile(authUser.uid, profileName, profilePortrait)
          .catch(() => upsertProfile(authUser.uid, profileName, ""))
          .then(() => fetchGameState(authUser.uid));
      })
      .then(async (gameStateResponse) => {
        if (gameStateResponse?.forceLogout) {
          setDataLoading(false);
          setInitialDataResolved(true);
          await handleLogout(() => {
            setShowLevelUp(false);
          });
          return;
        }

        const gsUser = gameStateResponse?.user || {};
        const gsLevel = Number(gsUser.level) || 1;
        const gsStreak = Number(gameStateResponse?.streak ?? gsUser.streak ?? 0);
        const [{ users }, allQuestsResponse] = await Promise.all([
          fetchLeaderboard(),
          fetchAllQuests({ level: gsLevel, streak: gsStreak })
        ]);
        setDataLoading(false);
        setInitialDataResolved(true);
        applyServerTimeSync(gameStateResponse);
        surfacePendingGrants(gameStateResponse);
        const nextQuests = Array.isArray(gameStateResponse?.quests) ? gameStateResponse.quests.map(normalizeLocalizedQuest) : [];
        setQuests(nextQuests);
        seedAllQuestOptions(allQuestsResponse);
        const userData = gameStateResponse.user || {};
        setCharacterName(userData.displayName || profileName);
        setNameDraft(userData.displayName || profileName);
        setPortraitData(userData.photoUrl || "");
        if (userData.streakBurnedAt) setStreakBurnedNoticeAt(userData.streakBurnedAt);
        const preferredQuestIds = applyServerBootstrap(gameStateResponse, characterName);
        if (Array.isArray(gameStateResponse?.completedQuestIds)) {
        if (userData.theme) setThemeId(userData.theme);
          setState((prev) => ({ 
            ...prev, 
            completed: gameStateResponse.completedQuestIds,
            streak: Number(gameStateResponse?.streak ?? prev.streak),
            streakFreezeActive: gameStateResponse?.streakFreezeActive ?? prev.streakFreezeActive,
            hasRerolledToday: gameStateResponse?.hasRerolledToday ?? prev.hasRerolledToday,
            extraRerollsToday: Number(gameStateResponse?.extraRerollsToday ?? userData?.extraRerollsToday ?? prev.extraRerollsToday),
            lvl: userData.level ?? prev.lvl,
            xp: userData.xp ?? prev.xp,
            xpNext: userData.xpNext ?? prev.xpNext,
            silver: userData.silver ?? prev.silver,
            gold: Number(userData.gold ?? prev.gold ?? 0),
            rouletteCoupons: Number(userData.rouletteCoupons ?? prev.rouletteCoupons ?? 0),
            ownedCosmetics: typeof userData.ownedCosmetics === "string" ? userData.ownedCosmetics : (prev.ownedCosmetics ?? "[]"),
            activeCosmetics: typeof userData.activeCosmetics === "string" ? userData.activeCosmetics : (prev.activeCosmetics ?? "{}"),
            couponInventory: typeof userData.couponInventory === "string" ? userData.couponInventory : (prev.couponInventory ?? "[]"),
            districtLevels: (() => {
              const raw = userData.districtLevels;
              if (Array.isArray(raw)) return raw.slice(0, 5).map((n) => Math.max(0, Math.min(5, Math.floor(Number(n) || 0))));
              if (typeof raw === "string" && raw.length) {
                return raw.split(",").slice(0, 5).map((n) => Math.max(0, Math.min(5, Math.floor(Number(n) || 0))));
              }
              return prev.districtLevels || [0, 0, 0, 0, 0];
            })(),
            user: {
              ...prev.user,
              handle: userData.handle ?? prev.user?.handle ?? null,
              lastFreeTaskRerollAt: userData.lastFreeTaskRerollAt ?? null,
              lastBusinessClaimDayKey: userData.lastBusinessClaimDayKey ?? "",
              vacationEndsAt: userData.vacationEndsAt ?? null,
              lastVacationAt: userData.lastVacationAt ?? null,
              monthlyFreezeClaims: userData.monthlyFreezeClaims ?? "",
              streakFreezeCharges: Number(userData.streakFreezeCharges) || 0,
              streakFreezeExpiresAt: userData.streakFreezeExpiresAt ?? null,
              lastFreezePurchaseWeekKey: userData.lastFreezePurchaseWeekKey ?? "",
              xpBoostExpiresAt: userData.xpBoostExpiresAt ?? null,
              cityName: typeof userData.cityName === "string" ? userData.cityName : (prev.user?.cityName ?? "")
            },
            productivity: gameStateResponse?.productivity ?? prev.productivity,
            pinnedQuestProgress21d: normalizePinnedQuestProgress(gameStateResponse?.pinnedQuestProgress21d),
            preferredQuestIds,
            questSlots: gameStateResponse?.questSlots ?? prev.questSlots,
            activeTimers: Array.isArray(gameStateResponse?.activeTimers) ? gameStateResponse.activeTimers : [],
            activeCounters: Array.isArray(gameStateResponse?.activeCounters) ? gameStateResponse.activeCounters : [],
            isDevTester: Boolean(gameStateResponse?.isDevTester)
          }));
        }
        setLeaderboard(users || []);
      })
      .catch((err) => {
        setDataLoading(false);
        setInitialDataResolved(true);
        setDataLoadError(err?.message || t.dataLoadWakeServer);
      });
  }, [authUser, languageId, t.dataLoadWakeServer]);

  useEffect(() => {
    if (!authUser) return;
    
    const syncedNowMs = Date.now() + serverOffsetMs;
    const syncedDate = new Date(syncedNowMs);
    const today = `${syncedDate.getUTCFullYear()}-${syncedDate.getUTCMonth()}-${syncedDate.getUTCDate()}`;

    if (dayMarkerRef.current === today) return;
    dayMarkerRef.current = today;

    resetDaily(username)
      .then(() => fetchGameState(authUser.uid))
      .then((gameStateResponse) => {
        if (gameStateResponse?.forceLogout) {
          handleLogout(() => {
            setShowLevelUp(false);
          });
          return;
        }
        applyServerTimeSync(gameStateResponse);
        surfacePendingGrants(gameStateResponse);
        const nextQuests = Array.isArray(gameStateResponse?.quests) ? gameStateResponse.quests.map(normalizeLocalizedQuest) : [];
        setQuests(nextQuests);
        const userData = gameStateResponse.user || {};
        if (userData.theme) setThemeId(userData.theme);
        if (userData.streakBurnedAt) setStreakBurnedNoticeAt(userData.streakBurnedAt);
        setState((prev) => ({
          ...prev,
          completed: Array.isArray(gameStateResponse?.completedQuestIds) ? gameStateResponse.completedQuestIds : [],
          streak: Number(gameStateResponse?.streak ?? prev.streak),
          streakFreezeActive: gameStateResponse?.streakFreezeActive ?? false,
          hasRerolledToday: gameStateResponse?.hasRerolledToday ?? prev.hasRerolledToday,
          extraRerollsToday: Number(gameStateResponse?.extraRerollsToday ?? userData?.extraRerollsToday ?? prev.extraRerollsToday),
          lvl: userData.level ?? prev.lvl,
          xp: userData.xp ?? prev.xp,
          xpNext: userData.xpNext ?? prev.xpNext,
          silver: userData.silver ?? prev.silver,
          districtLevels: (() => {
            const raw = userData.districtLevels;
            if (Array.isArray(raw)) return raw.slice(0, 5).map((n) => Math.max(0, Math.min(5, Math.floor(Number(n) || 0))));
            if (typeof raw === "string" && raw.length) {
              return raw.split(",").slice(0, 5).map((n) => Math.max(0, Math.min(5, Math.floor(Number(n) || 0))));
            }
            return prev.districtLevels || [0, 0, 0, 0, 0];
          })(),
          user: {
            ...prev.user,
            handle: userData.handle ?? prev.user?.handle ?? null,
            lastFreeTaskRerollAt: userData.lastFreeTaskRerollAt ?? null,
            cityName: typeof userData.cityName === "string" ? userData.cityName : (prev.user?.cityName ?? "")
          },
          productivity: gameStateResponse?.productivity ?? prev.productivity,
          questSlots: gameStateResponse?.questSlots ?? prev.questSlots,
          activeTimers: Array.isArray(gameStateResponse?.activeTimers) ? gameStateResponse.activeTimers : [],
          isDevTester: Boolean(gameStateResponse?.isDevTester),
          pinnedQuestProgress21d: normalizePinnedQuestProgress(gameStateResponse?.pinnedQuestProgress21d),
          lastReset: Date.now(),
          hasRerolledToday: false,
          extraRerollsToday: 0,
          logs: [
            ...prev.logs,
            {
              msg: t.newDay,
              classes: "text-cyan-400 font-bold cinzel",
              timestamp: getTimestamp()
            }
          ]
        }));
      })
      .catch(() => {});
  }, [authUser, resetTimer, languageId]);

  useEffect(() => {
    if (!uidRef.current) return;
    saveState(uidRef.current, state);
  }, [state]);

  useEffect(() => {
    // Intentionally removed auto-close for level up. Must be closed manually.
  }, [showLevelUp]);

  const xpPercent = (state.xp / state.xpNext) * 100;

  useEffect(() => {
    if (mobileTab === "profile" && authUser) {
      fetchProfileStats(authUser.uid).then(setProfileStats).catch(() => {});
    }
  }, [mobileTab, authUser]);

  // Keep in sync with server streak_xp_multiplier tiers
  // (server/rpg_life_daily_quests_v2.json).
  const streakMultiplier = state.streak >= 50
    ? 1.50
    : state.streak >= 30
      ? 1.30
      : state.streak >= 21
        ? 1.20
        : state.streak >= 14
          ? 1.15
          : state.streak >= 7
            ? 1.10
            : state.streak >= 3
              ? 1.05
              : 1.00;
  const streakBonusPercent = Math.round((streakMultiplier - 1) * 100);
  const completedToday = state.completed.length;
  const maxDailyQuests = Number(state.questSlots?.dailyTotal) || 6;
  const milestoneProgressPercent = Math.min(100, (completedToday / Math.max(1, maxDailyQuests)) * 100);
  const milestoneRunes = Array.isArray(t.milestoneRunes) && t.milestoneRunes.length >= 3
    ? t.milestoneRunes
    : ["✓", "★", "🏆"];
  // Square district adds silver on top of the base full-board reward.
  const squareLvlForMilestone = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[3]) || 0)));
  const fullBoardSilverReward = 1 + squareLvlForMilestone;
  // Server-side streak rule: +1 streak is awarded at >=4 completed quests
  // (see calculateStreak in server/src/index.js). The dashboard milestone
  // that carries the streak icon must sit at the SAME position — otherwise
  // low-capacity users (level 1 → 4 slots) see "+1 streak" at the second
  // card (target=2) even though the server still requires 4 completions.
  const STREAK_SUCCESS_THRESHOLD = 4;
  const streakMilestoneTarget = Math.min(STREAK_SUCCESS_THRESHOLD, maxDailyQuests);
  // Build 3 targets ensuring the streak threshold is represented, and the
  // final card always lands on the user's full board.
  let milestoneTargets;
  if (maxDailyQuests <= STREAK_SUCCESS_THRESHOLD + 1) {
    // 4- or 5-slot tier: keep the original "last 3" progression.
    milestoneTargets = [
      Math.max(1, maxDailyQuests - 2),
      Math.max(1, maxDailyQuests - 1),
      maxDailyQuests
    ];
  } else {
    // 6+ slots: lead with the streak threshold so +1 streak is visible,
    // middle = midway between streak and full, tail = full board.
    const mid = Math.max(streakMilestoneTarget + 1, Math.round((streakMilestoneTarget + maxDailyQuests) / 2));
    milestoneTargets = [streakMilestoneTarget, Math.min(maxDailyQuests - 1, mid), maxDailyQuests];
  }
  const milestoneSteps = milestoneTargets.map((target, i) => {
    const isStreak = target === streakMilestoneTarget;
    const isFullBoard = target === maxDailyQuests;
    // Structured reward parts — DashboardTab renders these as colored
    // pill chips on the final/jackpot card so XP, silver and streak each
    // read distinctly. The legacy `reward` string is preserved for
    // surfaces that haven't migrated yet (ProfilePanel, etc.).
    const parts = [];
    let reward;
    if (isFullBoard) {
      parts.push({ kind: "xp", amount: 25 });
      parts.push({ kind: "silver", amount: fullBoardSilverReward });
      if (isStreak) parts.push({ kind: "streak", amount: 1 });
      const silverPart = fullBoardSilverReward > 1
        ? `+${fullBoardSilverReward} ${t.silverIcon}`
        : `+${t.silverIcon}`;
      reward = `+25 ${t.xpLabel} / ${silverPart}`;
      if (isStreak) reward += ` / +${t.streakIcon}`;
    } else if (isStreak) {
      parts.push({ kind: "xp", amount: 20 });
      parts.push({ kind: "streak", amount: 1 });
      reward = `+20 ${t.xpLabel} / +${t.streakIcon}`;
    } else {
      const xpAmount = i === 1 ? 25 : 20;
      parts.push({ kind: "xp", amount: xpAmount });
      // Mid milestone earns the heavier XP bump so the card isn't empty.
      reward = `+${xpAmount} ${t.xpLabel}`;
    }
    return { target, reward, parts, rune: milestoneRunes[i] };
  });
  // Trust the actual preferredQuestIds length once state has loaded — even
  // if it's 0 (user skipped onboarding). Only fall back to the slot cap
  // when the array hasn't been hydrated yet, so the board can't briefly
  // mis-split random quests into the pinned region.
  const preferredQuestCount = Array.isArray(state.preferredQuestIds)
    ? state.preferredQuestIds.length
    : (Number(state.questSlots?.pinned) || 3);
  const maxPinnedForLevel = Number(state.questSlots?.pinned) || Math.max(preferredQuestCount, 2);
  const maxRandomForLevel = Number(state.questSlots?.random) || 3;
  const emptyPinnedSlotCount = Math.max(0, maxPinnedForLevel - (Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds.length : 0));
  const pinnedQuests = quests.slice(0, preferredQuestCount).map((q) => ({ ...q, xp: 30 }));
  const otherQuests = quests.slice(preferredQuestCount);
  const syncedNow = new Date(Date.now() + serverOffsetMs);
  const dailyQuestFreshDayKey = `${syncedNow.getUTCFullYear()}-${String(syncedNow.getUTCMonth() + 1).padStart(2, "0")}-${String(syncedNow.getUTCDate()).padStart(2, "0")}`;
  const mobileTabTitle = getMobileTabTitle(mobileTab, t);
  const pinnedQuestProgressById = Object.fromEntries(
    normalizePinnedQuestProgress(state.pinnedQuestProgress21d).map((item) => [item.questId, item])
  );
  const allRandomCompleted = otherQuests.length > 0 && otherQuests.every(q => state.completed.includes(q.id));
  const emptyOtherSlotCount = Math.max(0, maxRandomForLevel - otherQuests.length);
  const canReroll = (!state.hasRerolledToday || state.extraRerollsToday > 0) && completedToday < 6 && !allRandomCompleted;
  const languageShortLabel = languageId === "ru" ? "RU" : "EN";
  const isFreePinnedReroll = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
  let daysUntilFreePinnedReroll = 0;
  if (!isFreePinnedReroll) {
    const elapsedMs = Date.now() - new Date(state.user?.lastFreeTaskRerollAt).getTime();
    const remainingMs = FREE_PINNED_REROLL_INTERVAL_MS - elapsedMs;
    daysUntilFreePinnedReroll = Number.isFinite(remainingMs)
      ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
      : 21;
  }
  const canRerollPinned = isFreePinnedReroll || state.silver >= 7;

  const {
    floatingTexts,
    pendingQuestIds,
    addLog,
    completeQuest,
    doReroll,
    handleResetDaily,
    handleHardReset,
    handleBuyExtraReroll,
    handleBuyXpBoost,
    handleRerollPinned,
    handleFreezeStreak,
    freezeStreakPending,
    rerollingQuestId,
    rerollingPinned
  } = useGameplayActions({
    authUser,
    username,
    state,
    setState,
    setQuests,
    quests,
    normalizeQuest: normalizeLocalizedQuest,
    getTimestamp,
    fetchGameState,
    completeQuestOnServer,
    resetDaily,
    resetHard,
    buyExtraReroll,
    buyXpBoost,
    freezeStreak,
    rerollPinned,
    onServerTimeSync: applyServerTimeSync,
    setShowRerollConfirm,
    setShowFreezeSuccess,
    setShowLevelUp,
    setLevelUpLevel,
    setShowHabitMilestone,
    setHabitMilestoneTitle,
    setHabitMilestoneSilver,
    setTierUnlock,
    levelDisplayRef,
    questRenderCountRef,
    vocab: t
  });

  const [noteQuest, setNoteQuest] = useState(null);
  // Tracks the cosmetic id being purchased so the matching card can render
  // its loading/disabled state without blocking the rest of the cosmetics tab.
  const [cosmeticPurchasePending, setCosmeticPurchasePending] = useState(null);
  const [buyPinnedRerollCouponPending, setBuyPinnedRerollCouponPending] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [counterPendingId, setCounterPendingId] = useState(null);
  // NOTE: showNotesHistory, cityResetConfirmOpen, cityResetBusy are now
  // declared up near the other overlay-state flags so the earlier
  // mobile-shell-state useEffect can reference them without hitting a
  // TDZ. Don't redeclare them here.

  // City-reset memos must live above any early returns below (authLoading
  // / LoginScreen) — otherwise React sees more hooks after the user logs
  // in than before (error #310).
  const DISTRICT_UPGRADE_COSTS_CLIENT = [5, 15, 25, 50, 100];
  // Reset City coupon is now a flat 20 silver — see server's
  // CITY_RESET_COST. cityResetsPaid still bumps on each purchase
  // for the Phoenix achievement, but no longer affects price.
  const cityResetCost = 20;
  const cityResetRefund = useMemo(() => {
    const levels = Array.isArray(state.districtLevels) ? state.districtLevels : [0, 0, 0, 0, 0];
    return levels.reduce((sum, lvl) => {
      const safe = Math.max(0, Math.min(5, Math.floor(Number(lvl) || 0)));
      let silver = 0;
      for (let i = 0; i < safe; i += 1) silver += DISTRICT_UPGRADE_COSTS_CLIENT[i] || 0;
      return sum + silver;
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.districtLevels]);

  const mergeCounterIntoState = (questId, counter) => {
    setState((prev) => {
      const existing = Array.isArray(prev.activeCounters) ? prev.activeCounters : [];
      const filtered = existing.filter((entry) => entry.questId !== questId);
      filtered.push({
        questId,
        count: Number(counter.count || 0),
        target: Number(counter.target || 0),
        lastTickAt: counter.lastTickAt ?? null,
        windowStartAt: counter.windowStartAt ?? null,
        windowTicks: Number(counter.windowTicks || 0)
      });
      return { ...prev, activeCounters: filtered };
    });
  };

  const refreshStateAfterCompletion = async () => {
    try {
      const latest = await fetchGameState(username);
      applyServerTimeSync(latest);
      setState((prev) => ({
        ...prev,
        completed: Array.isArray(latest?.completedQuestIds) ? latest.completedQuestIds : prev.completed,
        xp: latest?.user?.xp ?? prev.xp,
        lvl: latest?.user?.level ?? prev.lvl,
        xpNext: latest?.user?.xpNext ?? prev.xpNext,
        silver: latest?.user?.silver ?? prev.silver,
        streak: Number(latest?.streak ?? prev.streak),
        productivity: latest?.productivity ?? prev.productivity,
        questSlots: latest?.questSlots ?? prev.questSlots,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(latest?.pinnedQuestProgress21d),
        activeCounters: Array.isArray(latest?.activeCounters) ? latest.activeCounters : prev.activeCounters
      }));
    } catch {
      // Non-fatal; user can refresh.
    }
  };

  const handleCounterTick = async (quest) => {
    if (!username || counterPendingId) return;
    setCounterPendingId(quest.id);
    try {
      const resp = await tickQuestCounter(username, quest.id);
      if (resp?.counter) {
        mergeCounterIntoState(quest.id, resp.counter);
      }
      if (resp?.completed) {
        await refreshStateAfterCompletion();
        addLog(
          (t.counterCompleteLog || "💧 {title} completed!").replace("{title}", quest.title),
          "text-cyan-300 font-bold cinzel"
        );
      }
    } catch (err) {
      const msg = String(err?.message || "");
      if (/cooldown/i.test(msg)) {
        addLog(t.counterCooldownWarn || "Hold on — wait for the cooldown.", "text-amber-300 font-bold");
      } else if (/already/i.test(msg)) {
        await refreshStateAfterCompletion();
      } else {
        addLog(t.counterTickFailed || "Could not record sip.", "text-red-400 font-bold");
      }
    } finally {
      setCounterPendingId(null);
    }
  };

  const renderQuestMechanicNode = (quest) => {
    if (!quest) return null;
    if (quest.mechanic === "counter") {
      const entry = (state.activeCounters || []).find((c) => Number(c.questId) === Number(quest.id)) || null;
      return (
        <QuestCounterInline
          quest={quest}
          count={entry?.count || 0}
          target={Number(quest.targetCount) || 1}
          windowStartAt={entry?.windowStartAt || null}
          windowTicks={Number(entry?.windowTicks || 0)}
          cooldownMin={Number(quest.counterCooldownMin) || 15}
          maxInWindow={Number(quest.counterMaxPerTick) || 3}
          pending={counterPendingId === quest.id}
          onTick={() => handleCounterTick(quest)}
          unitLabel={t.counterGlassUnit}
        />
      );
    }
    if (quest.mechanic === "note" || quest.mechanic === "words") {
      return (
        <div
          className="mt-3 pl-9 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { setNoteError(""); setNoteQuest(quest); }}
            className="mobile-pressable cinzel quest-note-cta"
            style={{
              width: "100%",
              minHeight: 44,
              fontSize: 12,
              fontWeight: 700,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid var(--color-primary)",
              background: "linear-gradient(90deg, rgba(250,204,21,0.14), rgba(250,204,21,0.08))",
              color: "var(--color-accent)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(250,204,21,0.12)"
            }}
          >
            {quest.mechanic === "words"
              ? (t.wordsOpenCta || "📝 Enter words")
              : (t.noteOpenCta || "📝 Write notes")}
          </button>
        </div>
      );
    }
    return null;
  };

  const handleNoteSubmit = async ({ kind, items }) => {
    if (!username || !noteQuest) return;
    setNoteSubmitting(true);
    setNoteError("");
    try {
      const cleanedItems = noteQuest.mechanic === "words"
        ? items.map((pair) => ({
            word: String(pair.word || "").trim(),
            translation: String(pair.translation || "").trim()
          }))
        : items.map((item) => ({ text: String(item.text || "").trim() }));
      await submitQuestNote(username, noteQuest.id, kind, cleanedItems);
      setNoteQuest(null);
      await refreshStateAfterCompletion();
      addLog(
        (t.noteCompleteLog || "📝 {title} saved.").replace("{title}", noteQuest.title),
        "text-cyan-300 font-bold cinzel"
      );
    } catch (err) {
      setNoteError(String(err?.message || (t.noteSubmitFailed || "Submission failed.")));
    } finally {
      setNoteSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !import.meta.env.DEV) {
      return;
    }

    const runHabitStress = async (options = {}) => {
      const {
        count = 3,
        delayMs = 25,
        mode = "burst"
      } = options || {};

      if (dataLoading) {
        console.warn("[GoHabit debug] data is still loading; wait until quests are ready");
        return {
          ok: false,
          reason: "data-loading"
        };
      }

      const availableHabits = pinnedQuests.filter((q) => !state.completed.includes(q.id));
      const targets = availableHabits.slice(0, Math.max(1, Number(count) || 1));

      if (targets.length === 0) {
        console.warn("[GoHabit debug] no incomplete habits available for stress test");
        return {
          ok: false,
          reason: "no-targets"
        };
      }

      const mockEvent = {
        clientX: Math.max(100, Math.floor(window.innerWidth * 0.5)),
        clientY: Math.max(120, Math.floor(window.innerHeight * 0.35))
      };

      if (mode === "sequential") {
        for (let index = 0; index < targets.length; index += 1) {
          handleQuestCompleteWrapper(targets[index], mockEvent);
          if (delayMs > 0 && index < targets.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      } else {
        targets.forEach((quest, index) => {
          const wait = Math.max(0, Number(delayMs) || 0) * index;
          setTimeout(() => {
            handleQuestCompleteWrapper(quest, mockEvent);
          }, wait);
        });
      }

      return {
        ok: true,
        mode,
        count: targets.length,
        targetQuestIds: targets.map((q) => q.id)
      };
    };

    window.__goHabitStressCompleteHabits = runHabitStress;
    window.__goHabitDebug = {
      ...(window.__goHabitDebug || {}),
      stressCompleteHabits: runHabitStress
    };

    return () => {
      if (window.__goHabitStressCompleteHabits === runHabitStress) {
        delete window.__goHabitStressCompleteHabits;
      }
      if (window.__goHabitDebug?.stressCompleteHabits === runHabitStress) {
        const nextDebug = { ...window.__goHabitDebug };
        delete nextDebug.stressCompleteHabits;
        window.__goHabitDebug = nextDebug;
      }
    };
  }, [dataLoading, pinnedQuests, state.completed, handleQuestCompleteWrapper]);

  // Prefetch remaining tabs and their data in background after initial data loads.
  // This removes the "first-open" delay when user immediately switches from dashboard.
  useEffect(() => {
    if (!authUser || !initialDataResolved) {
      return;
    }

    if (tabPrefetchDoneForUidRef.current === authUser.uid) {
      return;
    }
    tabPrefetchDoneForUidRef.current = authUser.uid;

    // Preload tab bundles and data required by non-dashboard tabs.
    const prefetchFn = () => {
      import("./components/tabs/CityTab.jsx").catch(() => {});
      import("./components/tabs/StoreTab.jsx").catch(() => {});
      import("./components/tabs/LeaderboardTab.jsx").catch(() => {});
      import("./components/tabs/ProfileTab.jsx").catch(() => {});

      Promise.allSettled([
        fetchLeaderboard(),
        fetchProfileStats(authUser.uid)
      ]).then((results) => {
        const leaderboardResult = results[0];
        const profileStatsResult = results[1];

        if (leaderboardResult.status === "fulfilled") {
          setLeaderboard(leaderboardResult.value?.users || []);
        }

        if (profileStatsResult.status === "fulfilled") {
          setProfileStats(profileStatsResult.value || null);
        }
      }).catch(() => {});
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(prefetchFn, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      const timer = setTimeout(prefetchFn, 2000);
      return () => clearTimeout(timer);
    }
  }, [authUser, initialDataResolved]);

  function handleAddXp(amount) {
    setState((prev) => {
      let xp = prev.xp + amount;
      let lvl = prev.lvl;
      let xpNext = prev.xpNext;
      let silverGain = 0;
      while (xp >= xpNext) {
        xp -= xpNext;
        lvl += 1;
        silverGain += lvl >= 10 ? 2 : 1;
        xpNext = Math.floor(xpNext * 1.1);
      }
      if (lvl > prev.lvl) {
        setLevelUpLevel(lvl);
        setShowLevelUp(true);
      }
      return {
        ...prev,
        xp,
        lvl,
        xpNext,
        silver: prev.silver + silverGain
      };
    });
  }

  function handleThemeChange(id) {
    setThemeId(id);
    setShowThemePicker(false);
    if (authUser) updateTheme(authUser.uid, id).catch(() => {});
  }

  function handleLanguageChange(id) {
    setLanguageId(id);
    setShowLanguagePicker(false);
    // Persist language on the server so the `polyglot` achievement can
    // unlock and the preference survives across devices. The server
    // awaits trackAchievements before responding, so by the time the
    // promise resolves any newly-eligible row is already in the DB —
    // bumping the refresh key triggers a fresh fetch in
    // AchievementsSection so the polyglot trophy appears immediately
    // (no app restart required).
    if (authUser?.uid) {
      updatePreferredLanguage(authUser.uid, id)
        .then(() => bumpAchievements())
        .catch(() => {});
    }
  }

  function handlePortraitUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)) {
      setAvatarError(t.avatarUnsupportedFormat);
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError(t.avatarTooLarge);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setAvatarError(t.avatarReadFailed);
      event.target.value = "";
    };
    reader.onload = async (loadEvent) => {
      try {
        const imageData = loadEvent.target?.result;
        if (typeof imageData !== "string") {
          setAvatarError(t.avatarProcessFailed);
          return;
        }
        const compressed = await compressImage(imageData);
        if (!compressed) {
          setAvatarError(t.avatarCompressFailed);
          return;
        }
        const prevPortrait = portraitData;
        setPortraitData(compressed);
        addLog(t.characterPortraitUpdated, "text-yellow-400 font-bold");
        upsertProfile(authUser.uid, characterName || defaultCharacterName, compressed)
          .then(() => fetchLeaderboard())
          .then(({ users }) => setLeaderboard(users || []))
          .catch(() => {
            setPortraitData(prevPortrait);
            setAvatarError(t.avatarSaveFailed);
          });
      } catch {
        setAvatarError(t.avatarUnknownError);
      }
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function saveCharacterName(nextName) {
    setCharacterName(nextName);
  }

  function handleOpenNotes() {
    setNotesDraft(privateNotes);
    setShowNotesModal(true);
  }

  function handleSaveNotes() {
    localStorage.setItem(notesKey(authUser.uid), notesDraft);
    setPrivateNotes(notesDraft);
    setShowNotesModal(false);
    addLog(t.privateNotesUpdated, "text-cyan-300 font-bold");
  }

  function submitNameEdit() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== characterName) {
      const prevName = characterName;
      saveCharacterName(trimmed);
      addLog(tf("characterNameChanged", { name: trimmed }), "text-yellow-400 font-bold");
      upsertProfile(authUser.uid, trimmed, portraitData || "")
        .then(() => fetchLeaderboard())
        .then(({ users }) => setLeaderboard(users || []))
        .catch(() => {
          setCharacterName(prevName);
          addLog(t.saveNameFailed, "text-red-400 font-bold");
        });
    }
    setEditingName(false);
  }

  async function handleLogoutConfirm() {
    resetOnLogout();
    setShowLogoutConfirm(false);
    await handleLogout(() => {
      setShowLevelUp(false);
    });
  }

  async function handleDeleteProfile() {
    if (!authUser) return;
    try {
      await deleteProfile(authUser.uid);
    } catch {
      // best effort — proceed to logout even if server delete fails
    }
    resetOnLogout();
    await handleLogout(() => {
      setShowLevelUp(false);
    });
  }

  const rerollButtonLabel = completedToday >= 6 || allRandomCompleted
    ? t.rerollComplete
    : state.hasRerolledToday && state.extraRerollsToday === 0
      ? t.rerollDone
      : state.extraRerollsToday > 0
        ? `${t.rerollButton} (${state.extraRerollsToday})`
        : t.rerollButton;
  const rerollButtonTitle = allRandomCompleted ? t.allRandomTasksDone : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.alreadyUsedToday : completedToday >= 6 ? t.allDoneUnavailable : t.oncePerDay;

  if (authLoading) {
    return (
      <PortalPreloader title={t.loadingText} fullscreen />
    );
  }

  if (!authUser) {
    return (
      <Suspense fallback={<PortalPreloader title={t.loadingText} fullscreen />}>
        <LoginScreen
          t={t}
          handleGoogleLogin={handleGoogleLogin}
          authError={authError}
          languageId={languageId}
          languageIds={languageIds}
          getLanguageMeta={getLanguageMeta}
          setLanguageId={setLanguageId}
        />
      </Suspense>
    );
  }

  async function handlePickSingleHabit(questId) {
    if (!username || !questId) return;
    setSingleHabitPickerSaving(true);
    setSingleHabitPickerError("");
    try {
      await addPinnedQuest(username, Number(questId));
      await refreshFromServer();
      setSingleHabitPickerOpen(false);
    } catch (err) {
      setSingleHabitPickerError(String(err?.message || "Could not add habit"));
    } finally {
      setSingleHabitPickerSaving(false);
    }
  }

  // (The old `handleCreateAndPinSingleHabit` create-and-pin-in-one-step
  // helper was dropped along with the SingleHabitPickerModal's
  // create-only tab. The redesigned modal now embeds CustomHabitManager
  // for browse + create, and the user picks the new custom from the
  // list to confirm — same two-step flow as OnboardingModal.)

  async function refreshFromServer() {
    if (!authUser?.uid) return;
    try {
      const gameStateResponse = await fetchGameState(authUser.uid);
      if (gameStateResponse?.forceLogout) return;
      applyServerTimeSync(gameStateResponse);
      surfacePendingGrants(gameStateResponse);
      const nextQuests = Array.isArray(gameStateResponse?.quests) ? gameStateResponse.quests.map(normalizeLocalizedQuest) : [];
      setQuests(nextQuests);
      const userData = gameStateResponse.user || {};
      setState((prev) => ({
        ...prev,
        lvl: userData.level ?? prev.lvl,
        xp: userData.xp ?? prev.xp,
        xpNext: userData.xpNext ?? prev.xpNext,
        silver: userData.silver ?? prev.silver,
        streak: Number(gameStateResponse?.streak ?? prev.streak),
        completed: Array.isArray(gameStateResponse?.completedQuestIds) ? gameStateResponse.completedQuestIds : prev.completed,
        productivity: gameStateResponse?.productivity ?? prev.productivity,
        questSlots: gameStateResponse?.questSlots ?? prev.questSlots,
        isDevTester: Boolean(gameStateResponse?.isDevTester),
        preferredQuestIds: Array.isArray(gameStateResponse?.preferredQuestIds)
          ? gameStateResponse.preferredQuestIds
          : prev.preferredQuestIds,
        activeTimers: Array.isArray(gameStateResponse?.activeTimers) ? gameStateResponse.activeTimers : [],
        activeCounters: Array.isArray(gameStateResponse?.activeCounters) ? gameStateResponse.activeCounters : []
      }));
    } catch {
      // Ignore — failures surface via network logs.
    }
  }

  // BUY-time path: the shop button calls this directly (no confirm
  // modal in the shop). Just charges silver and adds a city_reset
  // coupon to the inventory. The confirm modal opens later — when
  // the user activates the coupon from the inventory tab — and that
  // path calls activate-coupon, not resetCity, so the actual wipe +
  // refund happens at activation time.
  async function handleResetCity() {
    if (!username || cityResetBusy) return;
    setCityResetBusy(true);
    try {
      const resp = await resetCity(username);
      setState((prev) => ({
        ...prev,
        silver: typeof resp?.silver === "number" ? resp.silver : prev.silver,
        couponInventory: typeof resp?.couponInventory === "string" ? resp.couponInventory : prev.couponInventory,
        user: {
          ...prev.user,
          cityResetsPaid: Number(resp?.cityResetsPaid) || ((Number(prev.user?.cityResetsPaid) || 0) + 1)
        }
      }));
      addLog(
        t.couponPurchasedCityReset || "🎫 Reset City coupon added to inventory.",
        "text-cyan-300 font-bold cinzel"
      );
    } catch (err) {
      addLog(err?.message || t.cityResetFailed || "City reset failed", "text-red-400 font-bold");
    } finally {
      setCityResetBusy(false);
    }
  }

  // Pull-to-refresh handler bound to every major mobile tab. Drops the
  // community cache so challenges / leaderboard / friends refetch, then
  // pulls a fresh game-state and leaderboard in parallel.
  async function handlePullRefresh() {
    evictCommunityCache();
    try {
      await Promise.all([
        refreshFromServer(),
        (async () => {
          try {
            const resp = await fetchLeaderboard({ force: true });
            if (resp?.users) setLeaderboard(resp.users);
          } catch {}
        })()
      ]);
    } catch {
      // Individual failures already surface — swallow the aggregate.
    }
  }

  async function handleTimerStart(questId) {
    try {
      const resp = await startQuestTimerAction(questId);
      return resp;
    } catch (err) {
      const msg = String(err?.message || "");
      if (/timer limit/i.test(msg) || /timer_limit/i.test(msg)) {
        setTimerLimitPopup(true);
      }
      return null;
    }
  }

  async function handleTimerStop(questId) {
    try {
      const result = await stopQuestTimerAction(questId);
      // Snapshot the quest title before refresh — the quest object may
      // disappear from `quests` after completion updates state.
      const stoppedQuest = quests.find((q) => Number(q.id) === Number(questId));
      await refreshFromServer();
      if (result?.completed) {
        const percent = Number(result?.completionPercent ?? 0);
        const threshold = Number(result?.streakThreshold ?? 4);
        const hundredCount = Number(result?.todayHundredCount ?? 0);
        const streakRemaining = Math.max(0, threshold - hundredCount);
        setQuestCompletePopup({
          title: stoppedQuest?.title || "",
          questXp: Number(result?.awardedXp ?? 0),
          milestoneXp: Number(result?.milestoneBonusXp ?? 0),
          sportXp: Number(result?.sportBonusXp ?? 0),
          silverAwarded: Number(result?.milestoneSilver ?? 0) + Number(result?.squareBonusSilver ?? 0),
          streakCounted: percent >= 100,
          completionPercent: percent,
          streakRemaining
        });
      }
      return result;
    } catch {
      return null;
    }
  }

  return (
    <>
      {dataLoading && !isEmbeddedApp ? <PortalPreloader title={t.loadingText} fullscreen /> : null}
      {/* Embedded (mobile WebView) gets the overlay variant during the
       * initial data load so the dashboard never flashes "0/2 tasks"
       * before quests + challenges resolve. Same chrome as the
       * referrals modal preloader, just stretched edge-to-edge. */}
      {dataLoading && isEmbeddedApp ? <PortalPreloader title={t.loadingText} overlay /> : null}
      {onboardingSaving ? <PortalPreloader title={t.loadingText} overlay /> : null}
      {pinnedReplacementOpening ? <PortalPreloader title={t.loadingText} overlay /> : null}
      {replacePinnedSaving ? <PortalPreloader title={t.loadingText} overlay /> : null}
      <NetworkRetryBanner />

      <Suspense fallback={null}>
        <DevTestPanel
          username={authUser?.uid}
          onRefresh={refreshFromServer}
          onLogout={handleLogoutConfirm}
          xp={state.xp}
          xpNext={state.xpNext}
          isDevTester={Boolean(state.isDevTester)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <FreezeSuccessModal open={showFreezeSuccess} onClose={() => setShowFreezeSuccess(false)} />
        <ResidentialAutoGrantModal
          grant={residentialAutoGrant}
          onClose={() => setResidentialAutoGrant(null)}
        />
        <TierUnlockModal
          tier={tierUnlock}
          onAcknowledge={() => setTierUnlock(null)}
        />
      </Suspense>

      <StreakBurnedDialog
        open={Boolean(streakBurnedNoticeAt)}
        onClose={() => {
          setStreakBurnedNoticeAt(null);
          if (authUser?.uid) {
            dismissStreakBurnNotice(authUser.uid).catch(() => {});
          }
        }}
      />

      <RerollConfirmModal
        open={showRerollConfirm}
        onCancel={() => setShowRerollConfirm(false)}
        onConfirm={doReroll}
        quests={otherQuests}
        completedIds={state.completed}
      />

      <LogoutConfirmModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogoutConfirm}
      />

      {cityResetConfirmOpen ? (
        <div
          className="logout-confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cityResetBusy) {
              setCityResetConfirmOpen(false);
              setCityResetCouponId(null);
            }
          }}
          style={{ zIndex: 95 }}
        >
          <div className="logout-confirm-card" style={{ maxWidth: 420 }}>
            <div className="text-4xl mb-2">🏙</div>
            <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>
              {t.cityResetConfirmTitle || "Reset your city?"}
            </h2>
            <p className="logout-confirm-msg" style={{ marginBottom: 10 }}>
              {t.cityResetConfirmBody || "All districts drop back to level 0. Every silver you spent upgrading them comes back to your balance."}
            </p>
            {/* The coupon was paid for at buy time, so the modal at
                activation time shows only the REFUND (what you get
                back) and the resulting balance. No "Price" row. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: 12,
                borderRadius: 12,
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--card-border-idle)",
                marginBottom: 10
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>
                <span>{t.cityResetRefundLabel || "Refund"}</span>
                <span style={{ color: "#6ee7b7", display: "inline-flex", alignItems: "center", gap: 4 }}>+ <IconSilver size={14} /> {cityResetRefund}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-accent)", fontWeight: 800, borderTop: "1px solid var(--card-border-idle)", paddingTop: 6, marginTop: 2 }}>
                <span>{t.cityResetNetLabel || "Total balance after reset"}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconSilver size={14} /> {Math.max(0, (Number(state.silver) || 0) + cityResetRefund)}</span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
              ⚠ {t.cityResetStreakWarning || "High-tier districts (levels 3–5) also need an active streak — silver alone won't unlock them. Keep your streak alive before paying to rebuild."}
            </p>
            <div className="logout-confirm-actions">
              <button
                className="logout-confirm-cancel cinzel mobile-pressable"
                onClick={() => {
                  if (cityResetBusy) return;
                  setCityResetConfirmOpen(false);
                  setCityResetCouponId(null);
                }}
                disabled={cityResetBusy}
              >
                {t.cancelLabel || "Cancel"}
              </button>
              <button
                className="logout-confirm-proceed cinzel mobile-pressable"
                onClick={async () => {
                  if (cityResetBusy || !cityResetCouponId || !authUser?.uid) return;
                  setCityResetBusy(true);
                  try {
                    const resp = await activateCoupon(authUser.uid, cityResetCouponId);
                    setState((prev) => ({
                      ...prev,
                      silver: typeof resp?.silver === "number" ? resp.silver : prev.silver,
                      couponInventory: typeof resp?.couponInventory === "string" ? resp.couponInventory : prev.couponInventory,
                      districtLevels: Array.isArray(resp?.districtLevels) ? resp.districtLevels : prev.districtLevels
                    }));
                    addLog?.((t.couponActivatedCityReset || "🏙 City reset — districts wiped, silver refunded."), "text-cyan-300 font-bold");
                  } catch (err) {
                    addLog?.((t.couponActivationFailed || "Activation failed."), "text-red-400 font-bold");
                  } finally {
                    setCityResetBusy(false);
                    setCityResetConfirmOpen(false);
                    setCityResetCouponId(null);
                  }
                }}
                disabled={cityResetBusy || !cityResetCouponId}
              >
                {cityResetBusy
                  ? (t.submittingLabel || "Submitting...")
                  : (t.cityResetActivateCta || "Reset")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ThemePickerModal
        open={showThemePicker}
        onClose={() => setShowThemePicker(false)}
        themeId={themeId}
        onThemeChange={handleThemeChange}
        getThemeMeta={getThemeMeta}
        t={t}
      />

      <LanguagePickerModal
        open={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        languageId={languageId}
        languageIds={languageIds}
        getLanguageMeta={getLanguageMeta}
        onLanguageChange={handleLanguageChange}
        t={t}
      />

      <Suspense fallback={null}>
        <AboutAppModal open={showAbout} onClose={() => setShowAbout(false)} />
      </Suspense>
      {/* Referrals lives in its OWN Suspense with a full-screen
          spinner fallback so the user can't see the native tab bar
          finish its hide-animation while the lazy chunk is still
          downloading. The fallback only renders when showReferrals
          is true, so it's free for closed-modal mounts. */}
      <Suspense fallback={showReferrals ? <ModalLazyFallback /> : null}>
        <ReferralsModal
          open={showReferrals}
          username={authUser?.uid || username}
          onClose={() => setShowReferrals(false)}
          onSilverClaimed={(nextTotal) => {
            // Server returned the user's new silver total — mirror it
            // locally so the dashboard balance updates instantly.
            if (Number.isFinite(Number(nextTotal))) {
              setState((prev) => ({ ...prev, silver: Number(nextTotal) }));
              bumpAchievements();
            }
          }}
        />
      </Suspense>
      {/* Activity Logs gets its own Suspense + ModalLazyFallback so
          the user sees a continuous loading state during the lazy
          chunk download (same as ReferralsModal). */}
      <Suspense fallback={showActivityLogs ? <ModalLazyFallback /> : null}>
        <ActivityLogsModal
          open={showActivityLogs}
          username={authUser?.uid}
          onClose={() => setShowActivityLogs(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <QuizModal
          open={showQuiz}
          username={authUser?.uid}
          onClose={() => setShowQuiz(false)}
          onPassed={({ justUnlocked }) => {
            // Quiz no longer auto-credits silver — scholar's reward
            // flows through the unified achievement claim flow. Just
            // bump the refresh key so AchievementsSection picks up the
            // freshly-unlocked row and the user can claim from there.
            if (justUnlocked) {
              bumpAchievements();
            }
          }}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SingleHabitPickerModal
          open={singleHabitPickerOpen}
          onClose={() => {
            setSingleHabitPickerOpen(false);
            setSingleHabitPickerError("");
          }}
          availableQuests={(() => {
            const pinnedSet = new Set(Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds : []);
            return (filteredReplacePinnedQuests || []).filter((q) => !pinnedSet.has(q.id));
          })()}
          saving={singleHabitPickerSaving}
          errorMessage={singleHabitPickerError}
          onPick={handlePickSingleHabit}
          // Custom-habit management surface — same wiring as the
          // OnboardingModal so the user can browse + pick existing
          // customs, edit/delete them, or create a new one. The
          // create handler returns a custom quest object the user
          // then taps to select before confirming with Add habit.
          customQuests={(() => {
            const pinnedSet = new Set(Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds : []);
            return (Array.isArray(customQuests) ? customQuests : []).filter((cq) => !pinnedSet.has(cq.id));
          })()}
          onCreateCustomQuest={handleCreateCustomQuest}
          onUpdateCustomQuest={handleUpdateCustomQuest}
          onDeleteCustomQuest={handleDeleteCustomQuest}
          customSaving={customSaving}
          customError={customError}
          onClearCustomError={() => setCustomError("")}
        />
      </Suspense>

      <Suspense fallback={null}>
        <QuestCompletePopup
          show={Boolean(questCompletePopup)}
          onClose={() => setQuestCompletePopup(null)}
          title={questCompletePopup?.title}
          questXp={questCompletePopup?.questXp || 0}
          milestoneXp={questCompletePopup?.milestoneXp || 0}
          sportXp={questCompletePopup?.sportXp || 0}
          silverAwarded={questCompletePopup?.silverAwarded || 0}
          streakCounted={Boolean(questCompletePopup?.streakCounted)}
          streakRemaining={questCompletePopup?.streakRemaining}
          completionPercent={questCompletePopup?.completionPercent}
        />
      </Suspense>

      {timerLimitPopup ? (
        <div
          className="logout-confirm-overlay"
          style={{ zIndex: 95 }}
          onClick={() => setTimerLimitPopup(false)}
        >
          <div
            className="logout-confirm-card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 380 }}
          >
            <div className="logout-confirm-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}><IconTimer size={36} /></div>
            <h3 className="cinzel logout-confirm-title">{t.timerLimitTitle || "Too many timers running"}</h3>
            <p className="logout-confirm-msg">
              {t.timerLimitMessage || "You can only run 2 timer quests at the same time. Finish one or stop it before starting a new one."}
            </p>
            <div className="logout-confirm-actions">
              <button
                type="button"
                className="logout-confirm-proceed cinzel"
                onClick={() => setTimerLimitPopup(false)}
              >
                {t.proceedLabel || "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Suspense fallback={null}>
        <AnimatedOnboardingTour
          open={showTour}
          steps={tourSteps}
          onSkip={() => finalizeTour({ awardLevel: false })}
          onFinish={() => finalizeTour({ awardLevel: true })}
          onStepChange={setTourStepId}
        />
      </Suspense>

      <OnboardingModal
        open={showOnboarding}
        onClose={handleLogoutConfirm}
        onboardingName={onboardingName}
        onOnboardingNameChange={setOnboardingName}
        onboardingQuestIds={onboardingQuestIds}
        onboardingQuestSearch={onboardingQuestSearch}
        onOnboardingQuestSearchChange={setOnboardingQuestSearch}
        filteredOnboardingQuests={filteredOnboardingQuests}
        allEligibleQuestOptions={allEligibleQuestOptions}
        onToggleOnboardingQuest={toggleOnboardingQuest}
        onboardingError={onboardingError}
        onboardingSaving={onboardingSaving}
        onComplete={handleCompleteOnboarding}
        onSkip={handleSkipOnboarding}
        customQuests={customQuests}
        customSaving={customSaving}
        customError={customError}
        onClearCustomError={() => setCustomError("")}
        onCreateCustomQuest={handleCreateCustomQuest}
        onUpdateCustomQuest={handleUpdateCustomQuest}
        onDeleteCustomQuest={handleDeleteCustomQuest}
        selectionLimit={Number(state.questSlots?.pinned) || 2}
        randomQuestCount={Number(state.questSlots?.random) || 2}
        authUsername={authUser?.uid || ""}
        wizardStep={wizardStep}
        onWizardStepChange={setWizardStep}
        referralCode={onboardingReferralCode}
        onReferralCodeChange={setOnboardingReferralCode}
        lockBegin={showTour && tourStepId !== "setup-begin"}
        forcedHabitsTab={forcedHabitsTab}
      />

      <PinnedReplacementModal
        open={showPinnedReplaceModal}
        onClose={() => setShowPinnedReplaceModal(false)}
        replacePinnedSearch={replacePinnedSearch}
        onReplacePinnedSearchChange={setReplacePinnedSearch}
        filteredReplacePinnedQuests={filteredReplacePinnedQuests}
        allEligibleQuestOptions={allEligibleQuestOptions}
        replacePinnedQuestIds={replacePinnedQuestIds}
        onToggleReplacePinnedQuest={toggleReplacePinnedQuest}
        replacePinnedError={replacePinnedError}
        replacePinnedSaving={replacePinnedSaving}
        silver={state.silver}
        isFreePinnedReroll={isFreePinnedReroll}
        onBuy={handleBuyPinnedReplacement}
        customQuests={customQuests}
        customSaving={customSaving}
        customError={customError}
        onClearCustomError={() => setCustomError("")}
        onCreateCustomQuest={handleCreateCustomQuest}
        onUpdateCustomQuest={handleUpdateCustomQuest}
        onDeleteCustomQuest={handleDeleteCustomQuest}
        selectionLimit={Number(state.questSlots?.pinned) || 2}
      />

      <NotesModal
        open={showNotesModal}
        notesDraft={notesDraft}
        onNotesDraftChange={setNotesDraft}
        onClose={() => setShowNotesModal(false)}
        onSave={handleSaveNotes}
      />

      <Suspense fallback={null}>
        <QuestNoteModal
          open={Boolean(noteQuest)}
          quest={noteQuest}
          submitting={noteSubmitting}
          errorMessage={noteError}
          onClose={() => { if (!noteSubmitting) { setNoteQuest(null); setNoteError(""); } }}
          onSubmit={handleNoteSubmit}
        />
        <NotesHistoryModal
          open={showNotesHistory}
          username={username}
          onClose={() => setShowNotesHistory(false)}
        />
      </Suspense>

      <LevelUpPopup
        show={showLevelUp}
        onClose={() => setShowLevelUp(false)}
        level={levelUpLevel || state.lvl}
        t={t}
      />

      <HabitMilestonePopup
        show={showHabitMilestone}
        onClose={() => setShowHabitMilestone(false)}
        title={habitMilestoneTitle}
        silver={habitMilestoneSilver}
        t={t}
        tf={tf}
      />

      <FloatingTexts items={floatingTexts} />

      <div className={`mx-auto game-shell relative py-2 px-4 ${isEmbeddedApp ? "max-w-4xl embedded-shell" : "max-w-7xl"}`}>
        <div className="rune-orb rune-orb-left" />

        <header className={`flex flex-col items-center ${isEmbeddedApp ? "gap-2 py-0 mb-1" : "gap-3 py-3 mb-4"}`}>
          <input ref={portraitUploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePortraitUpload} />
          {isEmbeddedApp ? null : (
            <AppHeader
              portraitUploadRef={portraitUploadRef}
              portraitData={portraitData}
              characterName={characterName}
              authUser={authUser}
              themeId={themeId}
              t={t}
              languageShortLabel={languageShortLabel}
              onOpenThemePicker={() => setShowThemePicker(true)}
              onOpenLanguagePicker={() => setShowLanguagePicker(true)}
              onLogout={() => setShowLogoutConfirm(true)}
            />
          )}
        </header>

        {isEmbeddedApp ? (
          <PullToRefresh
            onRefresh={handlePullRefresh}
            // Also disabled during the animated tour — pulling down to
            // refresh mid-step would scroll the spotlight target off-
            // screen and break the per-step scroll lock that keeps the
            // user anchored on what the bubble is talking about.
            disabled={Boolean(noteQuest) || showOnboarding || showTour}
          >
          <div className="w-full max-w-3xl mx-auto embedded-content-safe">
            {mobileTab === "city" ? (
              <Suspense fallback={<PortalPreloader title={t.loadingText} overlay />}>
              <CityTab
                stage={Math.max(0, Math.floor(state.lvl) || 0)}
                dailyXpToday={state.productivity?.xpToday ?? 0}
                username={state.username || authUser?.uid || ""}
                onRewardClaimed={handleCityRewardClaimed}
                t={t}
                districtLevels={state.districtLevels || [0, 0, 0, 0, 0]}
                silver={state.silver || 0}
                userLevel={Math.floor(Number(state.lvl) || 0)}
                userStreak={Number(state.streak) || 0}
                tourFreeUpgradeDistrict={showTour ? "park" : null}
                lastBusinessClaimDayKey={state.user?.lastBusinessClaimDayKey || ""}
                monthlyFreezeClaims={state.user?.monthlyFreezeClaims || ""}
                lastVacationAt={state.user?.lastVacationAt || null}
                vacationEndsAt={state.user?.vacationEndsAt || null}
                cityName={state.user?.cityName || ""}
                onCityNameChanged={(name) => {
                  setState((prev) => ({
                    ...prev,
                    user: { ...(prev.user || {}), cityName: String(name || "") }
                  }));
                }}
                onDistrictUpgraded={(result) => {
                  setState((prev) => {
                    const next = {
                      ...prev,
                      silver: typeof result?.silver === "number" ? result.silver : prev.silver,
                      districtLevels: Array.isArray(result?.districtLevels) ? result.districtLevels : prev.districtLevels
                    };
                    // Residential auto-grant on threshold upgrade — mirror
                    // the server's bumped streakFreezeCharges / cycle clock
                    // into local state so the Profile freeze card updates
                    // immediately without waiting for the next refetch.
                    if (typeof result?.streakFreezeCharges === "number") {
                      next.user = {
                        ...(prev.user || {}),
                        streakFreezeCharges: result.streakFreezeCharges
                      };
                    }
                    return next;
                  });
                }}
                onStatsGranted={(result) => {
                  setState((prev) => ({
                    ...prev,
                    lvl: typeof result?.level === "number" ? result.level : prev.lvl,
                    xp: typeof result?.xp === "number" ? result.xp : prev.xp,
                    xpNext: typeof result?.xpNext === "number" ? result.xpNext : prev.xpNext,
                    silver: typeof result?.silver === "number" ? result.silver : prev.silver,
                    streak: typeof result?.streak === "number" ? result.streak : prev.streak,
                    user: {
                      ...(prev.user || {}),
                      ...(typeof result?.streakFreezeCharges === "number" ? { streakFreezeCharges: result.streakFreezeCharges } : {}),
                      ...(typeof result?.monthlyFreezeClaims === "string" ? { monthlyFreezeClaims: result.monthlyFreezeClaims } : {}),
                      ...(result?.vacationEndsAt !== undefined ? { vacationEndsAt: result.vacationEndsAt } : {}),
                      ...(result?.vacationStartedAt !== undefined ? { vacationStartedAt: result.vacationStartedAt } : {}),
                      ...(result?.lastVacationAt !== undefined ? { lastVacationAt: result.lastVacationAt } : {})
                    }
                  }));
                }}
              />
              </Suspense>
            ) : null}

            {mobileTab === "dashboard" ? (
              <Suspense fallback={<PortalPreloader title={t.loadingText} overlay />}>
              <DashboardTab
                questsLoaded={initialDataResolved}
                state={state}
                characterName={characterName}
                t={t}
                xpPercent={xpPercent}
                completedToday={completedToday}
                milestoneSteps={milestoneSteps}
                streakBonusPercent={streakBonusPercent}
                xpBoostExpiresAt={state.user?.xpBoostExpiresAt ?? null}
                maxDailyQuests={maxDailyQuests}
                renderQuestTimer={(quest) => (
                  <QuestTimerControls
                    quest={quest}
                    session={timerSessionsByQuestId[quest.id]}
                    elapsedMs={getTimerElapsedMs(quest.id)}
                    onStart={handleTimerStart}
                    onPause={pauseQuestTimerAction}
                    onResume={resumeQuestTimerAction}
                    onStop={handleTimerStop}
                  />
                )}
                renderQuestMechanic={(quest) => renderQuestMechanicNode(quest)}
                emptyPinnedSlotCount={emptyPinnedSlotCount}
                emptyOtherSlotCount={emptyOtherSlotCount}
                onOpenHabitPicker={() => setSingleHabitPickerOpen(true)}
                pinnedQuests={pinnedQuests}
                otherQuests={otherQuests}
                pinnedQuestProgressById={pinnedQuestProgressById}
                dailyQuestFreshDayKey={dailyQuestFreshDayKey}
                dailyQuestFreshStorageId={authUser?.uid || ""}
                canReroll={canReroll}
                allRandomCompleted={allRandomCompleted}
                questRenderCount={questRenderCountRef.current}
                pendingQuestIds={pendingQuestIds}
                resetTimer={resetTimer}
                onReroll={() => { if (canReroll) setShowRerollConfirm(true); }}
                onCompleteQuest={handleQuestCompleteWrapper}
                rerollButtonLabel={rerollButtonLabel}
                rerollButtonTitle={rerollButtonTitle}
                rerollingQuestId={rerollingQuestId}
                rerollingPinned={rerollingPinned}
                authUser={authUser}
              />
              </Suspense>
            ) : null}

            {mobileTab === "leaderboard" ? (
              <Suspense fallback={<PortalPreloader title={t.loadingText} overlay />}>
              <LeaderboardTab
                leaderboard={leaderboard}
                authUser={authUser}
                logs={state.logs}
                t={t}
              />
              </Suspense>
            ) : null}

            {mobileTab === "store" ? (
              <Suspense fallback={<PortalPreloader title={t.loadingText} overlay />}>
              <StoreTab
                silver={state.silver}
                streakFreezeCharges={Number(state.user?.streakFreezeCharges) || 0}
                freezeCost={(() => {
                  const resLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)));
                  const discount = resLvl >= 5 ? 2 : resLvl >= 1 ? 1 : 0;
                  return Math.max(0, 7 - discount);
                })()}
                rerollCost={(() => {
                  const resLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)));
                  const discount = resLvl >= 5 ? 2 : resLvl >= 1 ? 1 : 0;
                  return Math.max(0, 3 - discount);
                })()}
                freezeWeeklyLocked={(() => {
                  const lastKey = state.user?.lastFreezePurchaseWeekKey || "";
                  if (!lastKey) return false;
                  const d = new Date();
                  const dayNum = d.getUTCDay() || 7;
                  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
                  monday.setUTCDate(monday.getUTCDate() + 4 - dayNum);
                  const yearStart = new Date(Date.UTC(monday.getUTCFullYear(), 0, 1));
                  const weekNo = Math.ceil((((monday - yearStart) / 86400000) + 1) / 7);
                  const currentWeekKey = `${monday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
                  return lastKey === currentWeekKey;
                })()}
                residentialLevel={Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)))}
                extraRerollsToday={state.extraRerollsToday}
                hasRerolledToday={state.hasRerolledToday}
                canRerollPinned={canRerollPinned}
                isFreePinnedReroll={isFreePinnedReroll}
                daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
                onOpenPinnedReplacement={openPinnedReplacementModal}
                onFreezeStreak={handleFreezeStreak}
                freezeStreakPending={freezeStreakPending}
                onBuyExtraReroll={handleBuyExtraReroll}
                xpBoostCost={(() => {
                  const resLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)));
                  const discount = resLvl >= 5 ? 2 : resLvl >= 1 ? 1 : 0;
                  return Math.max(0, 15 - discount);
                })()}
                xpBoostExpiresAt={state.user?.xpBoostExpiresAt ?? null}
                onBuyXpBoost={handleBuyXpBoost}
                cityResetCost={cityResetCost}
                cityResetRefund={cityResetRefund}
                onResetCity={handleResetCity}
                onSwapSilverToGold={async () => {
                  if (!authUser?.uid) return;
                  try {
                    const resp = await swapSilverToGold(authUser.uid);
                    setState((prev) => ({
                      ...prev,
                      silver: Number(resp?.silver ?? prev.silver),
                      gold: Number(resp?.gold ?? prev.gold ?? 0)
                    }));
                    addLog?.((t.swapSuccessLog || "Exchanged 100 silver for 1 gold"), "text-amber-300");
                  } catch (err) {
                    const code = err?.data?.code || "unknown";
                    const msg = code === "insufficient_silver"
                      ? (t.notEnoughSilverSwap || "Not enough silver to swap (need 100)")
                      : (t.swapFailed || "Exchange failed");
                    addLog?.(msg, "text-red-400 font-bold");
                  }
                }}
                gold={Number(state.gold) || 0}
                rouletteCoupons={Number(state.rouletteCoupons) || 0}
                ownedCosmetics={typeof state.ownedCosmetics === "string" ? state.ownedCosmetics : "[]"}
                onBuyCosmetic={async (item) => {
                  if (!item || !authUser?.uid) return;
                  setCosmeticPurchasePending(item.id);
                  try {
                    const resp = await buyCosmetic(authUser.uid, item.id);
                    setState((prev) => ({
                      ...prev,
                      gold: Number(resp?.gold ?? prev.gold ?? 0),
                      ownedCosmetics: typeof resp?.ownedCosmetics === "string" ? resp.ownedCosmetics : prev.ownedCosmetics
                    }));
                    addLog?.((t.cosmeticPurchasedLog || "Cosmetic acquired"), "text-emerald-300");
                  } catch (err) {
                    const code = err?.data?.code || "unknown";
                    const msg = code === "insufficient_gold"
                      ? (t.notEnoughGold || "Not enough gold")
                      : code === "already_owned"
                        ? (t.cosmeticAlreadyOwned || "Already owned")
                        : (t.cosmeticPurchaseFailed || "Purchase failed");
                    addLog?.(msg, "text-red-400 font-bold");
                  } finally {
                    setCosmeticPurchasePending(null);
                  }
                }}
                cosmeticPurchasePending={cosmeticPurchasePending}
                onBuyPinnedRerollCoupon={async () => {
                  if (!authUser?.uid || buyPinnedRerollCouponPending) return;
                  setBuyPinnedRerollCouponPending(true);
                  try {
                    const resp = await buyPinnedRerollCoupon(authUser.uid);
                    setState((prev) => ({
                      ...prev,
                      silver: typeof resp?.silver === "number" ? resp.silver : prev.silver,
                      couponInventory: typeof resp?.couponInventory === "string" ? resp.couponInventory : prev.couponInventory
                    }));
                    addLog?.((t.couponPurchasedPinnedReroll || "🎫 Change Habits coupon added to inventory."), "text-cyan-300 font-bold");
                  } catch (err) {
                    const code = err?.data?.code || "unknown";
                    const msg = code === "insufficient_silver"
                      ? (t.notEnough || "Not enough silver")
                      : (t.purchaseFailed || "Purchase failed");
                    addLog?.(msg, "text-red-400 font-bold");
                  } finally {
                    setBuyPinnedRerollCouponPending(false);
                  }
                }}
                buyPinnedRerollCouponPending={buyPinnedRerollCouponPending}
                couponInventory={typeof state.couponInventory === "string" ? state.couponInventory : "[]"}
                activeCosmetics={typeof state.activeCosmetics === "string" ? state.activeCosmetics : "{}"}
                onActivateCoupon={async (coupon) => {
                  if (!coupon || !authUser?.uid) return;
                  // Pinned-reroll coupons need a habit picker; just open
                  // the modal and let it auto-consume the oldest matching
                  // coupon when the user confirms.
                  if (coupon.type === "pinned_reroll") {
                    setShowPinnedReplaceModal(true);
                    return;
                  }
                  // City-reset coupons open the existing reset-confirm
                  // popup. The modal's "Reset" button calls activate-
                  // coupon directly, not this handler — so we just stash
                  // the coupon id and bail out without firing the API.
                  if (coupon.type === "city_reset") {
                    setCityResetCouponId(coupon.id);
                    setCityResetConfirmOpen(true);
                    return;
                  }
                  try {
                    const resp = await activateCoupon(authUser.uid, coupon.id);
                    setState((prev) => ({
                      ...prev,
                      silver: typeof resp?.silver === "number" ? resp.silver : prev.silver,
                      gold: typeof resp?.gold === "number" ? resp.gold : prev.gold,
                      couponInventory: typeof resp?.couponInventory === "string" ? resp.couponInventory : prev.couponInventory,
                      extraRerollsToday: typeof resp?.extraRerollsToday === "number" ? resp.extraRerollsToday : prev.extraRerollsToday,
                      districtLevels: Array.isArray(resp?.districtLevels) ? resp.districtLevels : prev.districtLevels,
                      user: {
                        ...prev.user,
                        ...(typeof resp?.streakFreezeCharges === "number" ? { streakFreezeCharges: resp.streakFreezeCharges } : {}),
                        ...(resp?.xpBoostExpiresAt ? { xpBoostExpiresAt: resp.xpBoostExpiresAt } : {})
                      }
                    }));
                    const logKey = {
                      freeze: "couponActivatedFreeze",
                      reroll: "couponActivatedReroll",
                      xp_boost: "couponActivatedXpBoost",
                      city_reset: "couponActivatedCityReset"
                    }[coupon.type] || "couponActivatedGeneric";
                    addLog?.((t[logKey] || "Coupon activated."), "text-emerald-300");
                  } catch (err) {
                    addLog?.((t.couponActivationFailed || "Activation failed."), "text-red-400 font-bold");
                  }
                }}
                onActivateCosmetic={async (cosmeticId) => {
                  if (!cosmeticId || !authUser?.uid) return;
                  try {
                    const resp = await activateCosmetic(authUser.uid, cosmeticId);
                    setState((prev) => ({
                      ...prev,
                      activeCosmetics: typeof resp?.activeCosmetics === "string" ? resp.activeCosmetics : prev.activeCosmetics
                    }));
                    addLog?.((t.cosmeticActivatedLog || "Cosmetic equipped."), "text-emerald-300");
                  } catch (err) {
                    addLog?.((t.cosmeticActivationFailed || "Cosmetic activation failed."), "text-red-400 font-bold");
                  }
                }}
                t={t}
              />
              </Suspense>
            ) : null}

            {mobileTab === "profile" ? (
              <Suspense fallback={<PortalPreloader title={t.loadingText} overlay />}>
              <ProfileTab
                characterName={characterName}
                editingName={editingName}
                nameDraft={nameDraft}
                portraitData={portraitData}
                state={state}
                xpPercent={xpPercent}
                profileStats={profileStats}
                languageId={languageId}
                themeId={themeId}
                getThemeMeta={getThemeMeta}
                getLanguageMeta={getLanguageMeta}
                avatarError={avatarError}
                t={t}
                username={username}
                onAvatarClick={() => { setAvatarError(""); portraitUploadRef.current?.click(); }}
                onAvatarErrorClear={() => setAvatarError("")}
                onStartEditingName={() => { setNameDraft(characterName); setEditingName(true); }}
                onNameDraftChange={setNameDraft}
                onSubmitNameEdit={submitNameEdit}
                onCancelEditingName={() => { setNameDraft(characterName); setEditingName(false); }}
                onOpenThemePicker={() => setShowThemePicker(true)}
                onOpenLanguagePicker={() => setShowLanguagePicker(true)}
                onAchievementModalChange={setAchievementModalOpen}
                onOpenAbout={() => setShowAbout(true)}
                onOpenQuiz={() => setShowQuiz(true)}
                onOpenActivityLogs={() => setShowActivityLogs(true)}
                onOpenNotesHistory={() => setShowNotesHistory(true)}
                onOpenReferrals={() => setShowReferrals(true)}
                achievementsRefreshKey={achievementsRefreshKey}
                onAchievementSilverClaimed={(amount) => {
                  // Mirror the server-side silver grant locally so the
                  // Profile balance updates instantly without waiting
                  // for the next /api/game-state refresh.
                  if (Number(amount) > 0) {
                    setState((prev) => ({
                      ...prev,
                      silver: (Number(prev.silver) || 0) + Number(amount)
                    }));
                  }
                }}
                onRestartTour={handleRestartTour}
                onLogout={() => setShowLogoutConfirm(true)}
                onDeleteProfile={handleDeleteProfile}
                onDeleteConfirmStateChange={setDeleteProfileOpen}
                onFreezeUsed={(result) => {
                  setState((prev) => ({
                    ...prev,
                    user: {
                      ...prev.user,
                      streakFreezeCharges: typeof result?.streakFreezeCharges === "number" ? result.streakFreezeCharges : prev.user?.streakFreezeCharges,
                      streakFreezeExpiresAt: result?.streakFreezeExpiresAt ?? prev.user?.streakFreezeExpiresAt
                    }
                  }));
                }}
              />
              </Suspense>
            ) : null}
          </div>
          </PullToRefresh>
        ) : (
          <DesktopLayout
            showCity={showCity}
            state={state}
            levelDisplayRef={levelDisplayRef}
            editingName={editingName}
            nameDraft={nameDraft}
            characterName={characterName}
            onNameDraftChange={setNameDraft}
            onSubmitNameEdit={submitNameEdit}
            onStartEditingName={() => { setNameDraft(characterName); setEditingName(true); }}
            onCancelEditingName={() => { setNameDraft(characterName); setEditingName(false); }}
            xpPercent={xpPercent}
            completedToday={completedToday}
            milestoneProgressPercent={milestoneProgressPercent}
            milestoneSteps={milestoneSteps}
            streakBonusPercent={streakBonusPercent}
            maxDailyQuests={maxDailyQuests}
            renderQuestTimer={(quest) => (
              <QuestTimerControls
                quest={quest}
                session={timerSessionsByQuestId[quest.id]}
                elapsedMs={getTimerElapsedMs(quest.id)}
                onStart={handleTimerStart}
                onPause={pauseQuestTimerAction}
                onResume={resumeQuestTimerAction}
                onStop={handleTimerStop}
              />
            )}
            renderQuestMechanic={(quest) => renderQuestMechanicNode(quest)}
            emptyPinnedSlotCount={emptyPinnedSlotCount}
            emptyOtherSlotCount={emptyOtherSlotCount}
            onOpenHabitPicker={() => setSingleHabitPickerOpen(true)}
            pinnedQuests={pinnedQuests}
            otherQuests={otherQuests}
            pinnedQuestProgressById={pinnedQuestProgressById}
            dailyQuestFreshDayKey={dailyQuestFreshDayKey}
            dailyQuestFreshStorageId={authUser?.uid || ""}
            canReroll={canReroll}
            questRenderCount={questRenderCountRef.current}
            pendingQuestIds={pendingQuestIds}
            onReroll={() => { if (canReroll) setShowRerollConfirm(true); }}
            onCompleteQuest={handleQuestCompleteWrapper}
            rerollButtonLabel={rerollButtonLabel}
            rerollButtonTitle={rerollButtonTitle}
            rerollingQuestId={rerollingQuestId}
            rerollingPinned={rerollingPinned}
            resetTimer={resetTimer}
            leaderboard={leaderboard}
            authUser={authUser}
            logs={state.logs}
            canRerollPinned={canRerollPinned}
            isFreePinnedReroll={isFreePinnedReroll}
            daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
            onOpenPinnedReplacement={openPinnedReplacementModal}
            onFreezeStreak={handleFreezeStreak}
            onBuyExtraReroll={handleBuyExtraReroll}
            onBuyXpBoost={handleBuyXpBoost}
            xpBoostExpiresAt={state.user?.xpBoostExpiresAt ?? null}
            t={t}
          />
        )}
      </div>
      </>
    );
  }

  export default App;
