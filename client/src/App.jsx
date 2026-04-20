import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { auth, googleProvider, firebaseInitError } from "./firebaseAuth";
import {
  upsertProfile,
  updateTheme,
  fetchLeaderboard,
  fetchGameState,
  fetchAllQuests,
  completeOnboarding,
  completeQuest as completeQuestOnServer,
  resetDaily,
  resetHard,
  freezeStreak,
  buyExtraReroll,
  replacePinnedQuests,
  rerollPinned,
  fetchProfileStats,
  deleteProfile
} from "./api";
import useGameplayActions from "./hooks/useGameplayActions";
import useAuthSession from "./hooks/useAuthSession";
import useOnboardingPinned from "./hooks/useOnboardingPinned";
import useTimers from "./hooks/useTimers";
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

const FreezeSuccessModal = lazy(() => import("./components/modals/FreezeSuccessModal"));
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
const FullscreenCity = lazy(() => import("./components/FullscreenCity"));
const FloatingTexts = lazy(() => import("./components/FloatingTexts"));
const AppHeader = lazy(() => import("./components/AppHeader"));
const DesktopLayout = lazy(() => import("./components/DesktopLayout"));
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
  const [nextWeekResetAtMs, setNextWeekResetAtMs] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quests, setQuests] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [initialDataResolved, setInitialDataResolved] = useState(false);
  const [dataLoadError, setDataLoadError] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRerollConfirm, setShowRerollConfirm] = useState(false);
  const [showFreezeSuccess, setShowFreezeSuccess] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
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
  const [habitMilestoneTokens, setHabitMilestoneTokens] = useState(10);
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

  const { resetTimer, weekResetTimer } = useTimers(serverOffsetMs, nextWeekResetAtMs);

  function applyServerTimeSync(payload) {
    if (!payload || typeof payload !== "object") return;
    const serverNowMs = Number(payload.serverNowMs);
    const nextWeekResetAt = Number(payload.nextWeekResetAtMs);

    if (Number.isFinite(serverNowMs)) {
      setServerOffsetMs(serverNowMs - Date.now());
    }
    if (Number.isFinite(nextWeekResetAt)) {
      setNextWeekResetAtMs(nextWeekResetAt);
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
    onboardingName,
    setOnboardingName,
    onboardingQuestIds,
    onboardingQuestSearch,
    setOnboardingQuestSearch,
    onboardingError,
    onboardingSaving,
    filteredOnboardingQuests,
    filteredReplacePinnedQuests,
    resetOnLogout,
    toggleOnboardingQuest,
    toggleReplacePinnedQuest,
    openPinnedReplacementModal,
    handleBuyPinnedReplacement,
    handleCompleteOnboarding,
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
      setMobileTab(normalizeMobileTab(event?.detail));
    };

    window.addEventListener("life-rpg-mobile-tab", handleMobileTabChange);
    return () => window.removeEventListener("life-rpg-mobile-tab", handleMobileTabChange);
  }, [isEmbeddedApp]);

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

    bridge.postMessage(JSON.stringify({
      type: "mobile-shell-state",
      showTabBar: Boolean(authUser) && !authLoading && !dataLoading && initialDataResolved && !showOnboarding && !cityFullscreen && !showPinnedReplaceModal,
      loading: Boolean(authLoading || dataLoading || (authUser && !initialDataResolved)),
      activeTab: mobileTab,
      languageId
    }));
  }, [isEmbeddedApp, authUser, authLoading, dataLoading, initialDataResolved, showOnboarding, mobileTab, cityFullscreen, showPinnedReplaceModal, languageId]);

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
    setPortraitData(authUser.photoURL || "");
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
    const profilePortrait = authUser.photoURL || "";
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

        const [{ users }, allQuestsResponse] = await Promise.all([fetchLeaderboard(), fetchAllQuests()]);
        setDataLoading(false);
        setInitialDataResolved(true);
        applyServerTimeSync(gameStateResponse);
        const nextQuests = Array.isArray(gameStateResponse?.quests) ? gameStateResponse.quests.map(normalizeLocalizedQuest) : [];
        setQuests(nextQuests);
        seedAllQuestOptions(allQuestsResponse);
        const userData = gameStateResponse.user || {};
        setCharacterName(userData.displayName || profileName);
        setNameDraft(userData.displayName || profileName);
        setPortraitData(userData.photoUrl || "");
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
            tokens: userData.tokens ?? prev.tokens,
            user: {
              ...prev.user,
              lastFreeTaskRerollAt: userData.lastFreeTaskRerollAt ?? null
            },
            productivity: gameStateResponse?.productivity ?? prev.productivity,
            pinnedQuestProgress21d: normalizePinnedQuestProgress(gameStateResponse?.pinnedQuestProgress21d),
            preferredQuestIds
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
        const nextQuests = Array.isArray(gameStateResponse?.quests) ? gameStateResponse.quests.map(normalizeLocalizedQuest) : [];
        setQuests(nextQuests);
        const userData = gameStateResponse.user || {};
        if (userData.theme) setThemeId(userData.theme);
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
          tokens: userData.tokens ?? prev.tokens,
          user: {
            ...prev.user,
            lastFreeTaskRerollAt: userData.lastFreeTaskRerollAt ?? null
          },
          productivity: gameStateResponse?.productivity ?? prev.productivity,
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

  const streakMultiplier = state.streak >= 25
    ? 1.30
    : state.streak >= 15
      ? 1.25
      : state.streak >= 10
        ? 1.20
        : state.streak >= 7
          ? 1.15
          : state.streak >= 5
            ? 1.10
            : state.streak >= 3
              ? 1.05
              : 1.00;
  const streakBonusPercent = Math.round((streakMultiplier - 1) * 100);
  const completedToday = state.completed.length;
  const milestoneProgressPercent = Math.min(100, (completedToday / 6) * 100);
  const milestoneRunes = Array.isArray(t.milestoneRunes) && t.milestoneRunes.length >= 3
    ? t.milestoneRunes
    : ["✓", "★", "🏆"];
  const milestoneSteps = [
    { target: 4, reward: `+20 ${t.xpLabel} / +1 ${t.streakIcon}`, rune: milestoneRunes[0] },
    { target: 5, reward: "+25 " + t.xpLabel, rune: milestoneRunes[1] },
    { target: 6, reward: `+25 ${t.xpLabel} / +1 ${t.tokenIcon}`, rune: milestoneRunes[2] }
  ];
  const preferredQuestCount = Array.isArray(state.preferredQuestIds) && state.preferredQuestIds.length > 0 ? state.preferredQuestIds.length : 3;
  const pinnedQuests = quests.slice(0, preferredQuestCount).map((q) => ({ ...q, xp: 30 }));
  const otherQuests = quests.slice(preferredQuestCount);
  const mobileTabTitle = getMobileTabTitle(mobileTab, t);
  const pinnedQuestProgressById = Object.fromEntries(
    normalizePinnedQuestProgress(state.pinnedQuestProgress21d).map((item) => [item.questId, item])
  );
  const allRandomCompleted = otherQuests.length > 0 && otherQuests.every(q => state.completed.includes(q.id));
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
  const canRerollPinned = isFreePinnedReroll || state.tokens >= 7;

  const {
    floatingTexts,
    pendingQuestIds,
    addLog,
    completeQuest,
    doReroll,
    handleResetDaily,
    handleHardReset,
    handleBuyExtraReroll,
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
    freezeStreak,
    rerollPinned,
    onServerTimeSync: applyServerTimeSync,
    setShowRerollConfirm,
    setShowFreezeSuccess,
    setShowLevelUp,
    setLevelUpLevel,
    setShowHabitMilestone,
    setHabitMilestoneTitle,
    setHabitMilestoneTokens,
    levelDisplayRef,
    questRenderCountRef,
    vocab: t
  });

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
      import("./components/FullscreenCity.jsx").catch(() => {});

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
      let tokenGain = 0;
      while (xp >= xpNext) {
        xp -= xpNext;
        lvl += 1;
        tokenGain += lvl >= 10 ? 2 : 1;
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
        tokens: prev.tokens + tokenGain
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

  const rerollButtonLabel = completedToday >= 6 || allRandomCompleted ? t.rerollComplete : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.rerollDone : t.rerollButton;
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

  return (
    <>
      {dataLoading && !isEmbeddedApp ? <PortalPreloader title={t.loadingText} overlay /> : null}

      {cityFullscreen && (
        <FullscreenCity
          stage={Math.max(0, Math.floor(state.lvl) || 0)}
          onClose={() => setCityFullscreen(false)}
        />
      )}
      
      <FreezeSuccessModal open={showFreezeSuccess} onClose={() => setShowFreezeSuccess(false)} />

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

      <OnboardingModal
        open={showOnboarding}
        onClose={handleLogoutConfirm}
        onboardingName={onboardingName}
        onOnboardingNameChange={setOnboardingName}
        onboardingQuestIds={onboardingQuestIds}
        onboardingQuestSearch={onboardingQuestSearch}
        onOnboardingQuestSearchChange={setOnboardingQuestSearch}
        filteredOnboardingQuests={filteredOnboardingQuests}
        onToggleOnboardingQuest={toggleOnboardingQuest}
        onboardingError={onboardingError}
        onboardingSaving={onboardingSaving}
        onComplete={handleCompleteOnboarding}
        customQuests={customQuests}
        customSaving={customSaving}
        customError={customError}
        onClearCustomError={() => setCustomError("")}
        onCreateCustomQuest={handleCreateCustomQuest}
        onUpdateCustomQuest={handleUpdateCustomQuest}
        onDeleteCustomQuest={handleDeleteCustomQuest}
      />

      <PinnedReplacementModal
        open={showPinnedReplaceModal}
        onClose={() => setShowPinnedReplaceModal(false)}
        replacePinnedSearch={replacePinnedSearch}
        onReplacePinnedSearchChange={setReplacePinnedSearch}
        filteredReplacePinnedQuests={filteredReplacePinnedQuests}
        replacePinnedQuestIds={replacePinnedQuestIds}
        onToggleReplacePinnedQuest={toggleReplacePinnedQuest}
        replacePinnedError={replacePinnedError}
        replacePinnedSaving={replacePinnedSaving}
        tokens={state.tokens}
        isFreePinnedReroll={isFreePinnedReroll}
        onBuy={handleBuyPinnedReplacement}
        customQuests={customQuests}
        customSaving={customSaving}
        customError={customError}
        onClearCustomError={() => setCustomError("")}
        onCreateCustomQuest={handleCreateCustomQuest}
        onUpdateCustomQuest={handleUpdateCustomQuest}
        onDeleteCustomQuest={handleDeleteCustomQuest}
      />

      <NotesModal
        open={showNotesModal}
        notesDraft={notesDraft}
        onNotesDraftChange={setNotesDraft}
        onClose={() => setShowNotesModal(false)}
        onSave={handleSaveNotes}
      />

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
        tokens={habitMilestoneTokens}
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
          <div className="w-full max-w-3xl mx-auto embedded-content-safe">
            {mobileTab === "city" ? (
              <CityTab
                stage={Math.max(0, Math.floor(state.lvl) || 0)}
                dailyXpToday={state.productivity?.xpToday ?? 0}
                username={state.username}
                t={t}
                cityFullscreen={cityFullscreen}
                setCityFullscreen={setCityFullscreen}
              />
            ) : null}

            {mobileTab === "dashboard" ? (
              <DashboardTab
                state={state}
                characterName={characterName}
                t={t}
                xpPercent={xpPercent}
                completedToday={completedToday}
                milestoneSteps={milestoneSteps}
                streakFreezeActive={state.streakFreezeActive}
                streakBonusPercent={streakBonusPercent}
                pinnedQuests={pinnedQuests}
                otherQuests={otherQuests}
                pinnedQuestProgressById={pinnedQuestProgressById}
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
              />
            ) : null}

            {mobileTab === "leaderboard" ? (
              <LeaderboardTab
                leaderboard={leaderboard}
                authUser={authUser}
                logs={state.logs}
                t={t}
              />
            ) : null}

            {mobileTab === "store" ? (
              <StoreTab
                tokens={state.tokens}
                streakFreezeActive={state.streakFreezeActive}
                extraRerollsToday={state.extraRerollsToday}
                hasRerolledToday={state.hasRerolledToday}
                canRerollPinned={canRerollPinned}
                isFreePinnedReroll={isFreePinnedReroll}
                daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
                onOpenPinnedReplacement={openPinnedReplacementModal}
                onFreezeStreak={handleFreezeStreak}
                freezeStreakPending={freezeStreakPending}
                onBuyExtraReroll={handleBuyExtraReroll}
                t={t}
              />
            ) : null}

            {mobileTab === "profile" ? (
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
                onAvatarClick={() => { setAvatarError(""); portraitUploadRef.current?.click(); }}
                onAvatarErrorClear={() => setAvatarError("")}
                onStartEditingName={() => { setNameDraft(characterName); setEditingName(true); }}
                onNameDraftChange={setNameDraft}
                onSubmitNameEdit={submitNameEdit}
                onCancelEditingName={() => { setNameDraft(characterName); setEditingName(false); }}
                onOpenThemePicker={() => setShowThemePicker(true)}
                onOpenLanguagePicker={() => setShowLanguagePicker(true)}
                onLogout={() => setShowLogoutConfirm(true)}
                onDeleteProfile={handleDeleteProfile}
              />
            ) : null}
          </div>
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
            weekResetTimer={weekResetTimer}
            pinnedQuests={pinnedQuests}
            otherQuests={otherQuests}
            pinnedQuestProgressById={pinnedQuestProgressById}
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
            t={t}
          />
        )}
      </div>
      </>
    );
  }

  export default App;
