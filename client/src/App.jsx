import { useEffect, useRef, useState } from "react";
import { auth, googleProvider, firebaseInitError } from "./firebaseAuth";
import {
  upsertProfile,
  updateTheme,
  syncState as syncStateToServer,
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
  fetchProfileStats
} from "./api";
import FreezeSuccessModal from "./components/modals/FreezeSuccessModal";
import RerollConfirmModal from "./components/modals/RerollConfirmModal";
import LogoutConfirmModal from "./components/modals/LogoutConfirmModal";
import NotesModal from "./components/modals/NotesModal";
import OnboardingModal from "./components/modals/OnboardingModal";
import PinnedReplacementModal from "./components/modals/PinnedReplacementModal";
import QuestBoard from "./components/QuestBoard";
import TokenVault from "./components/TokenVault";
import ProfilePanel from "./components/ProfilePanel";
import CityIllustration from "./components/CityIllustration";
import LanguageSelector from "./components/LanguageSelector";
import SidePanels from "./components/SidePanels";
import useGameplayActions from "./hooks/useGameplayActions";
import useAuthSession from "./hooks/useAuthSession";
import useOnboardingPinned from "./hooks/useOnboardingPinned";
import { useTheme } from "./ThemeContext";
import themes, { themeIds } from "./themeConfig";
import InteractiveMapWrapper from "./components/InteractiveMapWrapper";

const saveKey         = (uid) => `rpg_save_${uid}`;
const characterNameKey = (uid) => `rpg_character_name_${uid}`;
const portraitKey      = (uid) => `rpg_portrait_${uid}`;
const notesKey         = (uid) => `rpg_private_notes_${uid}`;
const MOBILE_TAB_STORAGE_KEY = "life_rpg_mobile_tab";

function normalizeMobileTab(value) {
  const normalized = String(value || "").toLowerCase();
  if (["dashboard", "leaderboard", "city", "store", "profile"].includes(normalized)) {
    return normalized;
  }
  return "dashboard";
}

function getMobileTabIndex(tab) {
  const order = ["dashboard", "leaderboard", "city", "store", "profile"];
  const index = order.indexOf(tab);
  return index >= 0 ? index : 2;
}

function getMobileTabTitle(tab, t) {
  if (tab === "dashboard") return t.mobileDashboardLabel;
  if (tab === "leaderboard") return t.mobileLeaderboardLabel;
  if (tab === "store") return t.mobileStoreLabel;
  if (tab === "profile") return t.mobileProfileLabel;
  return t.mobileCityLabel;
}

function getQuestIcon(stat) {
  if (stat === "int") {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M5 5h14v14H5z"/><path d="M5 8h14"/><path d="M8 11l4 3 4-3"/></svg>';
  }
  if (stat === "str") {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="8" width="4" height="8" rx="1.5"/><rect x="18" y="8" width="4" height="8" rx="1.5"/><path d="M6 12h12"/><path d="M6 16h12"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M8 11l4-4 4 4" stroke="#ffffff" stroke-width="1.5" fill="none"/><path d="M12 13v6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>';
}

function normalizeQuest(quest, translateQuest, translateCategory) {
  const stat = String(quest?.stat || "sta").toLowerCase();
  const xp = Number(quest?.xp ?? quest?.base_xp ?? 0);
  const rawCategory = String(quest?.category || "Uncategorized").trim() || "Uncategorized";
  const sourceId = String(quest?.sourceId || "");
  const title = String(quest?.title || "Quest");
  const desc = String(quest?.desc ?? quest?.description ?? "");
  return {
    id: Number(quest?.id),
    sourceId,
    title: translateQuest ? translateQuest({ ...quest, sourceId }, "title", title) : title,
    desc: translateQuest ? translateQuest({ ...quest, sourceId }, "description", desc) : desc,
    xp: Number.isFinite(xp) ? xp : 0,
    stat,
    category: translateCategory ? translateCategory(rawCategory) : rawCategory,
    icon: String(quest?.icon || getQuestIcon(stat))
  };
}

function normalizePinnedQuestProgress(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      questId: Number(item?.questId),
      daysCompleted: Math.max(0, Number(item?.daysCompleted) || 0),
      totalDays: Math.max(1, Number(item?.totalDays) || 21)
    }))
    .filter((item) => Number.isInteger(item.questId) && item.questId > 0);
}

function compressImage(dataUrl, maxSide = 256, quality = 0.7) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(""), 10_000);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(""); };
    img.src = dataUrl;
  });
}

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function createDefaultState() {
  return {
    lvl: 1,
    xp: 0,
    xpNext: 300,
    tokens: 0,
    completed: [],
    logs: [],
    streak: 0,
    lastReset: Date.now(),
    hasRerolledToday: false,
    streakFreezeActive: false,
    extraRerollsToday: 0,
    user: {
      lastFreeTaskRerollAt: null
    },
    preferredQuestIds: [],
    pinnedQuestProgress21d: [],
    productivity: {
      xpToday: 0,
      tasksCompletedToday: 0,
      baseTasksCompletedToday: 0,
      dailyScore: 0,
      currentPI: null,
      piStatus: "calibrating",
      currentTier: "IRON",
      weeksInCurrentTier: 0,
      rankLevel: 1,
      rankLabel: "IRON I"
    }
  };
}

function normalizeState(rawState) {
  const state = createDefaultState();
  if (!rawState || typeof rawState !== "object") {
    return state;
  }

  state.lvl = typeof rawState.lvl === "number" ? rawState.lvl : 1;
  state.xp = typeof rawState.xp === "number" ? rawState.xp : 0;
  state.xpNext = typeof rawState.xpNext === "number" ? rawState.xpNext : 300;
  state.tokens = typeof rawState.tokens === "number" ? rawState.tokens : 0;
  state.completed = Array.isArray(rawState.completed) ? rawState.completed : [];
  state.logs = Array.isArray(rawState.logs) ? rawState.logs : [];
  state.streak = typeof rawState.streak === "number" ? rawState.streak : 0;
  state.lastReset = typeof rawState.lastReset === "number" ? rawState.lastReset : Date.now();
  state.hasRerolledToday = rawState.hasRerolledToday === true;
  state.streakFreezeActive = rawState.streakFreezeActive === true;
  state.extraRerollsToday = typeof rawState.extraRerollsToday === "number" ? rawState.extraRerollsToday : 0;
  state.user = {
    ...state.user,
    ...(rawState.user && typeof rawState.user === "object" ? rawState.user : {})
  };
  state.preferredQuestIds = Array.isArray(rawState.preferredQuestIds)
    ? rawState.preferredQuestIds.filter((id) => Number.isInteger(id))
    : [];
  state.pinnedQuestProgress21d = normalizePinnedQuestProgress(rawState.pinnedQuestProgress21d);
  state.productivity = {
    ...state.productivity,
    ...(rawState.productivity && typeof rawState.productivity === "object" ? rawState.productivity : {})
  };
  return state;
}

function loadState(uid) {
  const saved = localStorage.getItem(saveKey(uid));
  if (!saved) return normalizeState(null);
  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return normalizeState(null);
  }
}

function saveState(uid, state) {
  localStorage.setItem(saveKey(uid), JSON.stringify(state));
}

function getMsUntilNextUtcMidnight(nowMs) {
  const now = new Date(nowMs);
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ));
  return Math.max(0, nextMidnight.getTime() - nowMs);
}

function formatTwoDigits(num) {
  return String(num).padStart(2, "0");
}

function formatDurationWithDays(ms) {
  const totalSecs = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hrs = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const hms = `${formatTwoDigits(hrs)}:${formatTwoDigits(mins)}:${formatTwoDigits(secs)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

function App() {
  const {
    authUser,
    authLoading,
    authError,
    handleGoogleLogin,
    handleLogout
  } = useAuthSession({ auth, googleProvider, firebaseInitError });

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
  const [state, setState] = useState(createDefaultState);
  const [characterName, setCharacterName] = useState("Warrior");
  const [editingName, setEditingName] = useState(false);

  const handleQuestCompleteWrapper = (quest, event) => {
    completeQuest(quest, event);
  };

  const [nameDraft, setNameDraft] = useState("Warrior");
  const [portraitData, setPortraitData] = useState("");
  const [resetTimer, setResetTimer] = useState("--:--:--");
  const [weekResetTimer, setWeekResetTimer] = useState("--:--:--");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nextWeekResetAtMs, setNextWeekResetAtMs] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quests, setQuests] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
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
      return normalizeMobileTab(localStorage.getItem(MOBILE_TAB_STORAGE_KEY));
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
  const previousMobileTabRef = useRef("city");
  const normalizeLocalizedQuest = (quest) => normalizeQuest(quest, translateQuest, translateCategory);

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
    applyServerBootstrap
  } = useOnboardingPinned({
    authUser,
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
      showTabBar: Boolean(authUser) && !showOnboarding && !cityFullscreen,
      activeTab: mobileTab
    }));
  }, [isEmbeddedApp, authUser, showOnboarding, mobileTab, cityFullscreen]);

  useEffect(() => {
    if (!authUser) {
      setState(createDefaultState());
      setQuests([]);
      setCharacterName("Warrior");
      setNameDraft("Warrior");
      setPortraitData("");
      setShowNotesModal(false);
      setPrivateNotes("");
      setNotesDraft("");
      setMobileTab("city");
      resetOnLogout();
      questRenderCountRef.current = 0;
      dayMarkerRef.current = String(new Date().getUTCFullYear()) + "-" + String(new Date().getUTCMonth()) + "-" + String(new Date().getUTCDate());
      return;
    }
    const uid = authUser.uid;
    const name = localStorage.getItem(characterNameKey(uid)) || "Warrior";
    setCharacterName(name);
    setNameDraft(name);
    setPortraitData(localStorage.getItem(portraitKey(uid)) || "");
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
      return;
    }
    const profileName = localStorage.getItem(characterNameKey(authUser.uid)) || authUser.displayName || "Warrior";
    const profilePortrait = localStorage.getItem(portraitKey(authUser.uid)) || "";
    setDataLoading(true);
    setDataLoadError("");
    upsertProfile(authUser.uid, profileName, profilePortrait)
      .catch(() => upsertProfile(authUser.uid, profileName, ""))
      .then(() => Promise.all([fetchGameState(authUser.uid), fetchLeaderboard(), fetchAllQuests()]))
      .then(([gameStateResponse, { users }, allQuestsResponse]) => {
        setDataLoading(false);
        applyServerTimeSync(gameStateResponse);
        const nextQuests = Array.isArray(gameStateResponse?.quests) ? gameStateResponse.quests.map(normalizeLocalizedQuest) : [];
        setQuests(nextQuests);
        seedAllQuestOptions(allQuestsResponse);
        const preferredQuestIds = applyServerBootstrap(gameStateResponse, characterName);
        if (Array.isArray(gameStateResponse?.completedQuestIds)) {
          const userData = gameStateResponse.user || {};
        if (userData.theme) setThemeId(userData.theme);
          setState((prev) => ({ 
            ...prev, 
            completed: gameStateResponse.completedQuestIds,
            streak: Number(gameStateResponse?.streak ?? prev.streak),
            streakFreezeActive: gameStateResponse?.streakFreezeActive ?? prev.streakFreezeActive,
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
        setDataLoadError(err?.message || "Не удалось загрузить данные. Сервер просыпается (~1 мин). Нажмите «Повторить».");
      });
  }, [authUser, characterName, languageId]);

  useEffect(() => {
    if (!authUser) return;
    
    // Instead of using the local local `new Date().toDateString()`, 
    // calculate the synced current UTC date since the reset should be tied to UTC midnight.
    const syncedNowMs = Date.now() + serverOffsetMs;
    const syncedDate = new Date(syncedNowMs);
    const today = `${syncedDate.getUTCFullYear()}-${syncedDate.getUTCMonth()}-${syncedDate.getUTCDate()}`;

    if (dayMarkerRef.current === today) return;
    dayMarkerRef.current = String(new Date().getUTCFullYear()) + "-" + String(new Date().getUTCMonth()) + "-" + String(new Date().getUTCDate());

    resetDaily(authUser.uid)
      .then(() => fetchGameState(authUser.uid))
      .then((gameStateResponse) => {
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
    if (!uidRef.current) return;
    syncStateToServer(uidRef.current, { level: state.lvl, xp: state.xp, xpNext: state.xpNext })
      .then(() => fetchLeaderboard())
      .then(({ users }) => setLeaderboard(users || []))
      .catch(() => {});
  }, [state.lvl, state.xp]);

  useEffect(() => {
    const tick = () => {
      const syncedNowMs = Date.now() + serverOffsetMs;
      const msLeft = getMsUntilNextUtcMidnight(syncedNowMs);
      const totalSecs = Math.floor(msLeft / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setResetTimer(`${formatTwoDigits(hrs)}:${formatTwoDigits(mins)}:${formatTwoDigits(secs)}`);
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [serverOffsetMs]);

  useEffect(() => {
    const tick = () => {
      if (!Number.isFinite(nextWeekResetAtMs)) {
        setWeekResetTimer("--:--:--");
        return;
      }
      const syncedNowMs = Date.now() + serverOffsetMs;
      const msLeft = Math.max(0, nextWeekResetAtMs - syncedNowMs);
      setWeekResetTimer(formatDurationWithDays(msLeft));
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [nextWeekResetAtMs, serverOffsetMs]);

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
  const milestoneSteps = [
    { target: 4, reward: `+20 ${t.xpLabel} / +1 ${t.streakIcon}`, rune: t.milestoneRunes[0] },
    { target: 5, reward: "+25 " + t.xpLabel, rune: t.milestoneRunes[1] },
    { target: 6, reward: `+25 ${t.xpLabel} / +1 ${t.tokenIcon}`, rune: t.milestoneRunes[2] }
  ];
  const preferredQuestCount = Array.isArray(state.preferredQuestIds) && state.preferredQuestIds.length > 0 ? state.preferredQuestIds.length : 3;
  const pinnedQuests = quests.slice(0, preferredQuestCount);
  const otherQuests = quests.slice(preferredQuestCount);
  const mobileTabTitle = getMobileTabTitle(mobileTab, t);
  const pinnedQuestProgressById = Object.fromEntries(
    normalizePinnedQuestProgress(state.pinnedQuestProgress21d).map((item) => [item.questId, item])
  );
  const allRandomCompleted = otherQuests.length > 0 && otherQuests.every(q => state.completed.includes(q.id));
  const canReroll = (!state.hasRerolledToday || state.extraRerollsToday > 0) && completedToday < 6 && !allRandomCompleted;
  const languageShortLabel = languageId === "ru" ? "RU" : "EN";
  const isFreePinnedReroll = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= 30 * 24 * 60 * 60 * 1000);
  let daysUntilFreePinnedReroll = 0;
  if (!isFreePinnedReroll) {
    const elapsedMs = Date.now() - new Date(state.user?.lastFreeTaskRerollAt).getTime();
    const remainingMs = 30 * 24 * 60 * 60 * 1000 - elapsedMs;
    daysUntilFreePinnedReroll = Number.isFinite(remainingMs)
      ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
      : 30;
  }
  const canRerollPinned = isFreePinnedReroll || state.tokens >= 7;

  const {
    floatingTexts,
    addLog,
    completeQuest,
    handleReroll,
    doReroll,
    handleResetDaily,
    handleHardReset,
    handleBuyExtraReroll,
    handleRerollPinned,
    handleFreezeStreak
  } = useGameplayActions({
    authUser,
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

  function handlePortraitUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)) {
      setAvatarError("Unsupported image format. Use JPG, PNG, GIF, or WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("Image is too large (max 10 MB).");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setAvatarError("Failed to read image file. Please try again.");
      event.target.value = "";
    };
    reader.onload = async (loadEvent) => {
      try {
        const imageData = loadEvent.target?.result;
        if (typeof imageData !== "string") {
          setAvatarError("Failed to process image.");
          return;
        }
        const compressed = await compressImage(imageData);
        if (!compressed) {
          setAvatarError("Failed to compress image. Try a different photo.");
          return;
        }
        localStorage.setItem(portraitKey(authUser.uid), compressed);
        setPortraitData(compressed);
        addLog(t.characterPortraitUpdated, "text-yellow-400 font-bold");
        upsertProfile(authUser.uid, characterName || "Warrior", compressed)
          .then(() => fetchLeaderboard())
          .then(({ users }) => setLeaderboard(users || []))
          .catch(() => {});
      } catch {
        setAvatarError("Something went wrong. Please try a different image.");
      }
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function saveCharacterName(nextName) {
    localStorage.setItem(characterNameKey(authUser.uid), nextName);
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
      saveCharacterName(trimmed);
      addLog(tf("characterNameChanged", { name: trimmed }), "text-yellow-400 font-bold");
      upsertProfile(authUser.uid, trimmed, portraitData || "")
        .then(() => fetchLeaderboard())
        .then(({ users }) => setLeaderboard(users || []))
        .catch(() => {});
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

  if (authLoading) {
    return (
      <div className="auth-shell">
        <div className="auth-card text-center">
          <p className="cinzel tracking-widest" style={{ color: "var(--color-primary)" }}>{t.loadingText}</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="auth-shell relative w-full h-[100dvh] overflow-hidden flex flex-col" style={{ background: "var(--bg-color)" }}>
        {/* Ambient Background with City Illustration */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* subtle radial glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-yellow-500/10 rounded-full blur-[100px] opacity-50" />
          
          {/* city illustration scaled up, faded into background */}
          <div className="absolute top-[10%] inset-x-0 bottom-0 opacity-[0.15] scale-[1.35] origin-top md:scale-[1.1] md:top-[15%] transition-transform duration-1000 ease-out">
            <CityIllustration height="100%" stage={25} />
          </div>
          
          {/* rich gradients to blend the illustration */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent h-[60%] top-auto" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent h-[30%]" />
        </div>

        {/* Top Content: Branding */}
        <div className="relative z-10 flex-col items-center justify-start pt-16 flex-none px-6">
          <div className="animate-slide-down text-center">
            <p className="cinzel text-xs tracking-[0.4em] uppercase mb-3" style={{ color: "var(--color-primary-dim)" }}>
              {t.appTagline || "Journey to Greatness"}
            </p>
            <h1 className="cinzel text-5xl md:text-6xl font-black text-transparent bg-clip-text tracking-widest leading-tight" style={{ backgroundImage: "var(--heading-gradient)" }}>
              {t.appTitle}
            </h1>
          </div>
        </div>

        {/* Middle Content Spacer (pushes everything to bottom) */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center animate-fade-in" style={{ animationDelay: "200ms" }}>
           <p className="text-slate-300 text-lg md:text-xl font-light max-w-md mx-auto leading-relaxed shadow-sm">
             {t.loginHeroTagline || "Turn your daily tasks into an epic adventure. Level up, build habits, and grow your empire."}
           </p>
           
           <div className="flex gap-4 mt-8 opacity-60">
             <div className="flex flex-col items-center gap-1"><span className="text-2xl">{t.habitsIcon}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Habits</span></div>
             <div className="flex flex-col items-center gap-1"><span className="text-2xl">{t.levelIcon}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Levels</span></div>
             <div className="flex flex-col items-center gap-1"><span className="text-2xl">{t.cityIcon}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">City</span></div>
           </div>
        </div>

        {/* Bottom Content: Interactive Auth Elements */}
        <div className="relative z-10 flex-none pb-12 pt-6 px-6 w-full max-w-[420px] mx-auto animate-slide-up" style={{ animationDelay: "300ms", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
          
          <div className="rounded-[2rem] p-6 border shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md relative overflow-hidden" style={{ background: "linear-gradient(to bottom, rgba(30,41,59,0.7), rgba(15,23,42,0.9))", borderColor: "var(--color-primary-dim)" }}>
            
            {/* Soft decorative glow inside the card */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-[50px] pointer-events-none" />

            <div className="relative z-10 text-center mb-6">
              <h2 className="cinzel text-2xl text-white font-bold mb-1">{t.loginTitle}</h2>
              <p className="text-slate-400 text-sm">{t.loginSubtitle}</p>
            </div>

            <div className="relative z-10">
              <button 
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-lg font-bold transition-all active:scale-[0.98] shadow-lg hover:shadow-yellow-500/20"
                style={{ 
                  background: "linear-gradient(135deg, #1e293b, #0f172a)",
                  border: "1px solid var(--color-primary)",
                  color: "var(--color-primary)"
                }}
                onClick={handleGoogleLogin}
              >
                <div className="bg-white rounded-full p-1.5 shadow-sm">
                  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <span>{t.loginButton}</span>
              </button>
              
              {authError && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center animate-fade-in">
                  <span className="mr-1">⚠️</span> {authError}
                </div>
              )}
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-slate-700/50 flex justify-center">
              <LanguageSelector
                languageId={languageId}
                languageIds={languageIds}
                getLanguageMeta={getLanguageMeta}
                onChange={setLanguageId}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {cityFullscreen && (
        <div className="city-fullscreen-mode" style={{ backgroundColor: "var(--bg-body)", zIndex: 99999 }}>
          <button
            onClick={() => setCityFullscreen(false)}
            className="absolute bottom-6 right-6 z-[99999] rounded-full w-14 h-14 flex items-center justify-center border shadow-2xl transition-all"
            style={{ background: "rgba(10, 10, 18, 0.8)", borderColor: "var(--color-primary)", backdropFilter: "blur(12px)", color: "var(--color-primary)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
            </svg>
          </button>
          <InteractiveMapWrapper>
            <CityIllustration height="100%" stage={Math.max(0, Math.floor(state.lvl) || 0)} />
          </InteractiveMapWrapper>
        </div>
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

      {showThemePicker && (
        <div className="logout-confirm-overlay" onClick={() => setShowThemePicker(false)}>
          <div className="logout-confirm-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "360px" }}>
            <div className="text-4xl mb-2">🎨</div>
            <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)" }}>{t.chooseThemeTitle}</h2>
            <div className="flex flex-col gap-3 mt-4">
              {themeIds.map((id) => (
                <button
                  key={id}
                  className="flex items-center gap-3 w-full rounded-xl border-2 p-4 transition-all cinzel font-bold text-left"
                  style={{
                    background: id === themeId ? "var(--color-accent-dim)" : "var(--card-bg)",
                    borderColor: id === themeId ? "var(--color-primary)" : "var(--card-border-idle)",
                    color: id === themeId ? "var(--color-primary)" : "var(--color-text)"
                  }}
                  onClick={() => { setThemeId(id); setShowThemePicker(false); if(authUser) updateTheme(authUser.uid, id).catch(()=>{}); }}
                >
                  <span className="text-2xl">{themes[id].icon}</span>
                  <div>
                    <div className="text-sm">{getThemeMeta(id).label}</div>
                    <div className="text-xs font-normal opacity-60">{getThemeMeta(id).description}</div>
                  </div>
                  {id === themeId && <span className="ml-auto text-lg">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLanguagePicker && (
        <div className="logout-confirm-overlay" onClick={() => setShowLanguagePicker(false)}>
          <div className="logout-confirm-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "360px" }}>
            <div className="text-4xl mb-2">🌐</div>
            <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-primary)" }}>{t.chooseLanguageTitle}</h2>
            <div className="flex flex-col gap-3 mt-4">
              {languageIds.map((id) => {
                const language = getLanguageMeta(id);
                return (
                  <button
                    key={id}
                    className="flex items-center gap-3 w-full rounded-xl border-2 p-4 transition-all cinzel font-bold text-left"
                    style={{
                      background: id === languageId ? "var(--color-accent-dim)" : "var(--card-bg)",
                      borderColor: id === languageId ? "var(--color-primary)" : "var(--card-border-idle)",
                      color: id === languageId ? "var(--color-primary)" : "var(--color-text)"
                    }}
                    onClick={() => { setLanguageId(id); setShowLanguagePicker(false); }}
                  >
                    <span className="text-xl">🌐</span>
                    <div>
                      <div className="text-sm">{language.nativeLabel}</div>
                      <div className="text-xs font-normal opacity-60">{language.label}</div>
                    </div>
                    {id === languageId && <span className="ml-auto text-lg">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
      />

      <NotesModal
        open={showNotesModal}
        notesDraft={notesDraft}
        onNotesDraftChange={setNotesDraft}
        onClose={() => setShowNotesModal(false)}
        onSave={handleSaveNotes}
      />

      <div className={`levelup-popup ${showLevelUp ? "show" : "hidden"}`} aria-live="assertive" style={{ backdropFilter: "blur(8px)", background: "rgba(5, 10, 20, 0.85)" }}>
        <div className="levelup-popup-card relative flex flex-col items-center justify-center p-5 md:p-8 w-[90vw] md:w-[600px] max-h-[85vh] overflow-hidden" style={{ borderRadius: "2rem", border: "2px solid rgba(251, 191, 36, 0.6)", background: "linear-gradient(160deg, rgba(30,41,59,0.98), rgba(5,10,20,0.99))", boxShadow: "0 0 50px rgba(251, 191, 36, 0.2), inset 0 0 30px rgba(251,191,36,0.1)" }}>
          {/* Animated Background Rays */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
            <div className="w-[150%] h-[150%] animate-[spin_20s_linear_infinite]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.2) 20deg, transparent 40deg, rgba(251,191,36,0.2) 60deg, transparent 80deg, rgba(251,191,36,0.2) 100deg, transparent 120deg, rgba(251,191,36,0.2) 140deg, transparent 160deg, rgba(251,191,36,0.2) 180deg, transparent 200deg, rgba(251,191,36,0.2) 220deg, transparent 240deg, rgba(251,191,36,0.2) 260deg, transparent 280deg, rgba(251,191,36,0.2) 300deg, transparent 320deg, rgba(251,191,36,0.2) 340deg, transparent 360deg)" }} />
          </div>
          <div className="absolute inset-0 top-[-50%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_60%)] animate-[pulse_3s_ease-in-out_infinite]" />
          
          <div className="relative z-10 w-full text-center">
            {/* Title Section */}
            <p className="levelup-popup-subtitle cinzel" style={{ fontSize: "1.2rem", letterSpacing: "5px", color: "#fef08a", textShadow: "0 0 15px rgba(251,191,36,0.7)", margin: "0 0 0.25rem 0", animation: "fadeInDown 0.6s ease-out" }}>
              {t.levelUpTitle}
            </p>
            <h2 className="levelup-popup-title cinzel" style={{ fontSize: "4rem", margin: "0 0 0.75rem 0", color: "#fbbf24", borderBottom: "1px solid rgba(251,191,36,0.3)", paddingBottom: "0.5rem", lineHeight: "1", filter: "drop-shadow(0 0 20px rgba(251,191,36,0.6))", animation: "levelUpPulseSoft 2s infinite" }}>
              {t.levelUpPrefix} {levelUpLevel || state.lvl}
            </h2>

            {/* Content Text */}
            <p className="levelup-popup-message" style={{ fontSize: "1.1rem", fontStyle: "italic", opacity: 0.9, margin: "0 0 0.5rem 0", color: "#e2e8f0", animation: "fadeInUp 0.8s ease-out" }}>
              "{t.levelUpMessage}"
            </p>
            <div className="mx-auto w-12 h-[2px] bg-yellow-600/50 mb-2" />
            <p className="text-sm text-amber-200/80 mb-4 px-4" style={{ animation: "fadeInUp 1s ease-out" }}>
              {t.cityExpansionText}
            </p>

            {/* Rewards */}
            <div className="inline-flex justify-center items-center gap-3 bg-black/40 border border-yellow-700/50 rounded-xl px-5 py-3 mb-5 shadow-[inset_0_0_15px_rgba(251,191,36,0.1)]" style={{ animation: "fadeInUp 1.2s ease-out" }}>
              <span className="text-xl text-yellow-100 uppercase tracking-widest text-[0.85rem] font-bold">{t.rewardClaimLabel}</span>
              <span className="text-3xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                +{levelUpLevel > 10 ? 2 : 1} <span className="text-4xl px-1">{t.tokenIcon}</span>
              </span>
            </div>

            {/* Action Button */}
            <div style={{ animation: "fadeInUp 1.4s ease-out" }}>
              <button 
                onClick={() => setShowLevelUp(false)}
                className="cinzel font-bold tracking-widest text-lg px-10 py-3 rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
                style={{ background: "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)", border: "1px solid #fef08a", boxShadow: "0 5px 20px rgba(217,119,6,0.4), inset 0 1px 1px rgba(255,255,255,0.6)" }}
              >
                {t.proceedLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`levelup-popup ${showHabitMilestone ? "show" : "hidden"}`} aria-live="assertive" style={{ backdropFilter: "blur(8px)", background: "rgba(5, 20, 10, 0.82)" }}>
        <div className="levelup-popup-card relative flex flex-col items-center justify-center p-8 md:p-12 w-[90vw] md:w-[600px] overflow-hidden" style={{ borderRadius: "2rem", border: "2px solid rgba(74, 222, 128, 0.65)", background: "linear-gradient(160deg, rgba(15,23,42,0.98), rgba(5,20,10,0.99))", boxShadow: "0 0 50px rgba(74, 222, 128, 0.2), inset 0 0 30px rgba(74,222,128,0.12)" }}>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
            <div className="w-[150%] h-[150%] animate-[spin_20s_linear_infinite]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(74,222,128,0.2) 20deg, transparent 40deg, rgba(74,222,128,0.2) 60deg, transparent 80deg, rgba(74,222,128,0.2) 100deg, transparent 120deg, rgba(74,222,128,0.2) 140deg, transparent 160deg, rgba(74,222,128,0.2) 180deg, transparent 200deg, rgba(74,222,128,0.2) 220deg, transparent 240deg, rgba(74,222,128,0.2) 260deg, transparent 280deg, rgba(74,222,128,0.2) 300deg, transparent 320deg, rgba(74,222,128,0.2) 340deg, transparent 360deg)" }} />
          </div>
          <div className="absolute inset-0 top-[-50%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(74,222,128,0.15),transparent_60%)] animate-[pulse_3s_ease-in-out_infinite]" />

          <div className="relative z-10 w-full text-center">
            <p className="levelup-popup-subtitle cinzel" style={{ fontSize: "1.25rem", letterSpacing: "4px", color: "#bbf7d0", textShadow: "0 0 15px rgba(74,222,128,0.65)", margin: "0 0 0.5rem 0", animation: "fadeInDown 0.6s ease-out" }}>
              {t.habitMilestoneTitle}
            </p>
            <h2 className="levelup-popup-title cinzel" style={{ fontSize: "4.2rem", margin: "0 0 1.5rem 0", color: "#4ade80", borderBottom: "1px solid rgba(74,222,128,0.35)", paddingBottom: "1rem", lineHeight: "1", filter: "drop-shadow(0 0 20px rgba(74,222,128,0.6))", animation: "levelUpPulseSoft 2s infinite" }}>
              21/21+
            </h2>

            <p className="levelup-popup-message" style={{ fontSize: "1.2rem", fontStyle: "italic", opacity: 0.95, margin: "0 0 1rem 0", color: "#e2e8f0", animation: "fadeInUp 0.8s ease-out" }}>
              {tf("habitMilestoneMessage", { title: habitMilestoneTitle || t.pinnedSection })}
            </p>

            <div className="inline-flex justify-center items-center gap-3 bg-black/40 border border-emerald-500/50 rounded-xl px-6 py-4 mb-8 shadow-[inset_0_0_15px_rgba(74,222,128,0.12)]" style={{ animation: "fadeInUp 1.2s ease-out" }}>
              <span className="text-xl text-emerald-100 uppercase tracking-widest text-[0.85rem] font-bold">{t.rewardClaimLabel}</span>
              <span className="text-3xl font-black text-emerald-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]">
                +{habitMilestoneTokens} <span className="text-4xl px-1">{t.tokenIcon}</span>
              </span>
            </div>

            <div style={{ animation: "fadeInUp 1.4s ease-out" }}>
              <button
                onClick={() => setShowHabitMilestone(false)}
                className="cinzel font-bold tracking-widest text-lg px-10 py-3 rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
                style={{ background: "linear-gradient(180deg, #4ade80 0%, #16a34a 100%)", color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.5)", border: "1px solid #86efac", boxShadow: "0 5px 20px rgba(22,163,74,0.4), inset 0 1px 1px rgba(255,255,255,0.6)" }}
              >
                {t.proceedLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {floatingTexts.map((item) => (
        <div key={item.id} className={`floating-text ${item.colorClass} cinzel`} style={{ left: `${item.x}px`, top: `${item.y}px` }}>
          {item.text}
        </div>
      ))}

      <div className={`mx-auto game-shell relative py-2 px-4 ${isEmbeddedApp ? "max-w-4xl embedded-shell" : "max-w-7xl"}`}>
        <div className="rune-orb rune-orb-left" />

        <header className={`flex flex-col items-center ${isEmbeddedApp ? "gap-2 py-0 mb-1" : "gap-3 py-3 mb-4"}`}>
          <input ref={portraitUploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePortraitUpload} />
          {isEmbeddedApp ? null : (
            <>
              <div className="w-full flex items-center justify-end gap-2 user-auth-widget flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="theme-selector" style={{ position: "relative" }}>
                    <button className="theme-picker-trigger" onClick={() => setShowThemePicker(true)}>
                      <span>{themes[themeId].icon}</span> {t.chooseThemeButtonLabel}
                      <span className="ml-1 text-xs opacity-60">▾</span>
                    </button>
                  </div>
                  <div className="theme-selector" style={{ position: "relative" }}>
                    <button className="theme-picker-trigger" onClick={() => setShowLanguagePicker(true)}>
                      <span>🌐</span> {languageShortLabel}
                      <span className="ml-1 text-xs opacity-60">▾</span>
                    </button>
                  </div>
                </div>
                <div 
                  className="flex items-center gap-2 bg-slate-900/70 rounded-full pl-1 pr-3 py-1 cursor-pointer hover:opacity-80 transition-colors"
                  style={{ color: "var(--color-text)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--panel-border)" }}
                  onClick={() => portraitUploadRef.current?.click()}
                  title={t.changeAvatar}
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center border" style={{ borderColor: "var(--panel-border)" }}>
                    {portraitData ? (
                      <img src={portraitData} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-60">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold max-w-[100px] truncate">{characterName || authUser.displayName || authUser.email}</span>
                </div>
                <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>{t.logoutConfirm}</button>
              </div>
              <div className="w-full flex items-center justify-center gap-4">
                <div className="hidden sm:flex flex-1 items-center gap-2">
                  <div className="h-px flex-1 opacity-60" style={{ background: `linear-gradient(to right, transparent, var(--color-primary))` }} />
                </div>
                <div className="text-center">
                  <h1 className="cinzel text-2xl md:text-3xl font-bold text-transparent bg-clip-text tracking-widest leading-tight" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.appTitle}</h1>
                  <p className="cinzel text-[10px] tracking-[0.25em] uppercase mt-0.5" style={{ color: "var(--color-primary-dim)" }}>{t.appSubtitle}</p>
                </div>
                <div className="hidden sm:flex flex-1 items-center gap-2">
                  <div className="h-px flex-1 opacity-60" style={{ background: `linear-gradient(to left, transparent, var(--color-primary))` }} />
                </div>
              </div>
            </>
          )}
        </header>

        {isEmbeddedApp ? (
          <div className="w-full max-w-3xl mx-auto embedded-content-safe">
            {mobileTab === "city" ? (
              <div className="relative flex flex-col gap-4">
              <div className="flex flex-row justify-between items-center gap-3 backdrop-blur-md rounded-2xl p-5 border shadow-xl mobile-card" style={{ borderColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)" }}>
                <div className="flex-1">
                  <h3 className="cinzel text-xl font-bold tracking-wide mb-2 flex items-center gap-2" style={{ color: "var(--color-primary)" }}>
                    <span>🏙</span> {t.landingGrowCityTitle || "Your City"}
                  </h3>
                  <p className="text-sm leading-relaxed m-0" style={{ color: "var(--color-text)", opacity: 0.85 }}>
                    {t.cityExpansionText || "Level up by completing quests to expand and upgrade your city."}
                  </p>
                </div>
                <div className="backdrop-blur-xl px-4 py-3 rounded-2xl shadow-lg border text-center shrink-0" style={{ background: "rgba(10, 10, 18, 0.4)", borderColor: "var(--panel-border)" }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--color-text)", opacity: 0.7 }}>{t.mobileCityLabel}</p>
                  <p className="cinzel text-xl font-bold m-0 flex items-center justify-center gap-1" style={{ color: "var(--color-primary)" }}>
                    <span className="text-[12px] uppercase opacity-80">{t.levelShort || t.levelLabel}</span> {state.lvl}
                  </p>
                </div>
              </div>

              <div className="w-full h-[55vh] min-h-[350px] max-h-[500px] sm:min-h-[450px] relative rounded-[2rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-fade-in transition-all duration-500 flex-1" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--panel-border)", borderWidth: 1 }}>
                {!cityFullscreen && (
                  <>
                    <button
                      onClick={() => setCityFullscreen(true)}
                      className="absolute bottom-4 right-4 z-50 rounded-full w-12 h-12 flex items-center justify-center border shadow-xl transition-all"
                      style={{ background: "rgba(10, 10, 18, 0.65)", borderColor: "var(--panel-border)", backdropFilter: "blur(12px)", color: "var(--color-primary)" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
                      </svg>
                    </button>
                    <InteractiveMapWrapper>
                      <CityIllustration height="100%" stage={Math.max(0, Math.floor(state.lvl) || 0)} />
                    </InteractiveMapWrapper>
                  </>
                )}
              </div>
              </div>
            ) : null}

            {mobileTab === "dashboard" ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="flex gap-2 justify-center mb-1">
                  <button onClick={handleResetDaily} className="text-[10px] px-3 py-1 rounded-full border transition-colors font-bold uppercase tracking-wider hover:opacity-80" style={{ borderColor: "var(--color-primary-dim)", background: "var(--card-bg)", color: "var(--color-primary)" }}>{t.resetDaily}</button>
                  <button
                    onClick={() => setState((prev) => {
                      let xp = prev.xp + 500;
                      let lvl = prev.lvl;
                      let xpNext = prev.xpNext;
                      while (xp >= xpNext) {
                        xp -= xpNext;
                        lvl += 1;
                        xpNext = Math.floor(xpNext * 1.1);
                      }
                      if (lvl > prev.lvl) {
                        setLevelUpLevel(lvl);
                        setShowLevelUp(true);
                      }
                      return { ...prev, xp, lvl, xpNext };
                    })}
                    className="text-[10px] px-3 py-1 rounded-full border transition-colors font-bold uppercase tracking-wider hover:opacity-80"
                    style={{ borderColor: "rgba(251,191,36,0.5)", background: "rgba(127,95,0,0.3)", color: "rgb(251,191,36)" }}
                  >
                    ⚡ +500 {t.xpLabel || "XP"}
                  </button>
                  <button onClick={handleHardReset} className="text-[10px] px-3 py-1 rounded-full border transition-colors font-bold uppercase tracking-wider hover:opacity-80" style={{ borderColor: "rgba(220,38,38,0.5)", background: "rgba(127,29,29,0.3)", color: "rgb(239,68,68)" }}>{t.resetProgress}</button>
                </div>
                {/* Hero: XP + Level compact row */}
                <div className="dash-hero">
                  <div className="dash-hero-top">
                    <div className="min-w-0 flex-1">
                      <p className="cinzel text-lg truncate" style={{ color: "var(--color-primary)" }}>{characterName}</p>
                      <p className="text-xs mt-0.5 cinzel opacity-80" style={{ color: "var(--color-text)" }}>{t.levelShort} {state.lvl}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="cinzel text-sm" style={{ color: "var(--color-text)" }}>{state.xp}<span className="opacity-70" style={{ color: "var(--color-muted)" }}>/{state.xpNext}</span></p>
                      <p className="text-[10px] opacity-70 cinzel tracking-wider" style={{ color: "var(--color-muted)" }}>{t.xpLabel}</p>
                    </div>
                  </div>
                  <div className="dash-xp-bar">
                    <div className="dash-xp-fill" style={{ width: `${xpPercent}%` }} />
                  </div>
                </div>

                {/* Daily Board Section */}
                <div className="mobile-card flex flex-col gap-4">
                  {/* Daily progress strip & Board Title */}
                  <div className="flex flex-col shrink-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="cinzel text-[11px] font-bold tracking-[0.15em] uppercase drop-shadow-sm flex items-center gap-1.5" style={{color: "var(--color-primary)"}}>
                        <span className="text-[12px]">{t.dailyBoardIcon}</span> {t.dailyBoard}
                      </span>
                      <span className="cinzel text-[11px] font-bold opacity-80" style={{ color: "var(--color-text)" }}>{completedToday}<span className="opacity-50">/6</span></span>
                    </div>
                    <div className="dash-progress-strip">
                      <div className="flex gap-1 flex-1">
                        {Array.from({ length: 6 }).map((_, i) => {
                          const isActive = completedToday > i;
                          const isMilestone = i + 1 === 4 || i + 1 === 5 || i + 1 === 6;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full h-1.5 rounded-full transition-all duration-300" style={{ background: isActive ? "var(--color-primary)" : isMilestone ? "var(--card-border-idle)" : "rgba(255,255,255,0.1)", boxShadow: isActive ? "0 0 6px var(--color-primary-glow)" : "none" }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Milestones row */}
                  <div className="grid grid-cols-3 gap-2">
                    {milestoneSteps.map((step) => {
                      const unlocked = completedToday >= step.target;
                      return (
                        <div key={step.target} className={`dash-milestone mobile-pressable ${unlocked ? "dash-milestone-on" : ""}`}>
                          <div className={`text-[20px] leading-tight mb-[2px] drop-shadow-md ${unlocked ? "" : "opacity-40 grayscale"}`}>{step.rune}</div>
                          <div className={"cinzel text-[11px] font-bold tracking-wider mb-0.5"}>
                            <span style={{ color: unlocked ? "var(--color-primary)" : "var(--color-text)", opacity: unlocked ? 1 : 0.6 }}>{step.target} <span className="text-[9px] uppercase tracking-widest opacity-60">{t.itemLabel}</span></span>
                          </div>
                          <div className={"text-[10px] font-extrabold tracking-tight whitespace-nowrap flex flex-wrap items-center justify-center"} style={{ color: unlocked ? "var(--color-text)" : "var(--color-muted)", opacity: unlocked ? 1 : 0.6, filter: unlocked ? "drop-shadow(0 0 2px var(--color-primary-glow))" : "none" }}>
                            {step.reward.split(new RegExp(`(${t.streakIcon}|${t.tokenIcon})`)).map((part, i) => (
                              part === t.streakIcon || part === t.tokenIcon ? (
                                <span key={i} className="text-[13px] leading-none ml-0.5 drop-shadow-sm">{part}</span>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quest board with tabs */}
                <div className="mobile-card">
                  <QuestBoard pinnedQuests={pinnedQuests} otherQuests={otherQuests} pinnedQuestProgressById={pinnedQuestProgressById} canRerollRandom={canReroll} onRerollRandom={() => handleReroll(completedToday, canReroll)} rerollButtonLabel={completedToday >= 6 || allRandomCompleted ? t.rerollComplete : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.rerollDone : t.rerollButton} rerollButtonTitle={allRandomCompleted ? t.allRandomTasksDone : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.alreadyUsedToday : completedToday >= 6 ? t.allDoneUnavailable : t.oncePerDay} completedIds={state.completed} questRenderCount={questRenderCountRef.current} onCompleteQuest={handleQuestCompleteWrapper} resetTimer={resetTimer} streakFreezeActive={state.streakFreezeActive} compact />
                </div>
              </div>
            ) : null}

            {mobileTab === "leaderboard" ? (
              <div className="flex flex-col gap-4">
                <div className="mobile-card">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="mobile-section-kicker">{t.mobileLeaderboardLabel}</p>
                      <h2 className="cinzel text-2xl mt-1 text-transparent bg-clip-text" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.leaderboard}</h2>
                    </div>
                    
                  </div>
                </div>
                <SidePanels leaderboard={leaderboard} authUser={authUser} logs={state.logs} compact />
              </div>
            ) : null}

            {mobileTab === "store" ? (
              <div className="flex flex-col gap-4">
                <div className="relative overflow-hidden mobile-card flex flex-col gap-4 border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]" style={{ background: "linear-gradient(to bottom right, rgba(30, 41, 59, 0.8), rgba(2, 6, 23, 0.95))" }}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.05]"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className="mobile-section-kicker mb-1 leading-none" style={{ color: "var(--color-primary-dim)" }}>Your Balance</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-4xl drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">{t.tokenIcon}</span>
                        <h2 className="cinzel text-5xl font-bold tracking-wide" style={{ color: "var(--color-primary)", textShadow: "0 4px 15px rgba(0,0,0,0.6)" }}>{state.tokens}</h2>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="inline-flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold tracking-wider uppercase shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]"></span>
                          Vault Active
                        </div>
                        <p className="text-[9px] tracking-wider uppercase mt-0.5 opacity-80" style={{ color: "var(--color-text)" }}>Daily limits apply</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px my-1" style={{ background: "linear-gradient(to right, transparent, var(--card-border-idle), transparent)" }}></div>

                <TokenVault
                  tokens={state.tokens}
                  streakFreezeActive={state.streakFreezeActive}
                  extraRerollsToday={state.extraRerollsToday}
                  hasRerolledToday={state.hasRerolledToday}
                  canRerollPinned={canRerollPinned}
                  isFreePinnedReroll={isFreePinnedReroll}
                  daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
                  onOpenPinnedReplacement={openPinnedReplacementModal}
                  onFreezeStreak={handleFreezeStreak}
                  onBuyExtraReroll={handleBuyExtraReroll}
                  compact
                />
              </div>
            ) : null}

            {mobileTab === "profile" ? (
              <div className="mobile-tab-panel flex flex-col gap-4">

                {/* ── Hero Card: Avatar + Name + Level ── */}
                <div className="relative overflow-hidden mobile-card border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.08)]" style={{ background: "linear-gradient(to bottom right, rgba(30, 41, 59, 0.85), rgba(2, 6, 23, 0.95))" }}>
                  <div className="absolute inset-0 opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="relative group">
                      <button
                        type="button"
                        className="w-24 h-24 rounded-[1.8rem] overflow-hidden bg-slate-900 border-2 flex items-center justify-center shrink-0 mobile-pressable transition-all group-hover:border-yellow-500/70"
                        style={{ borderColor: "var(--color-primary-dim)" }}
                        onClick={() => { setAvatarError(""); portraitUploadRef.current?.click(); }}
                        title={t.changeAvatar}
                      >
                        {portraitData ? (
                          <img src={portraitData} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 opacity-50 text-current">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                        )}
                      </button>
                      <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xs text-slate-300 shadow-lg">
                        📷
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      {!editingName ? (
                        <div className="flex items-center gap-2">
                          <h2 className="cinzel text-2xl truncate text-transparent bg-clip-text font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>
                            {characterName}
                          </h2>
                          <button
                            className="opacity-70 hover:opacity-100 transition-colors shrink-0" style={{ color: "var(--color-muted)" }}
                            onClick={() => { setNameDraft(characterName); setEditingName(true); }}
                            title="Edit name"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(event) => setNameDraft(event.target.value)}
                          className="w-full max-w-[220px] cinzel text-lg border rounded-xl px-3 py-2" style={{ background: "var(--card-bg)", color: "var(--color-primary)", borderColor: "var(--color-primary)" }}
                          style={{ borderColor: "var(--color-primary)" }}
                          maxLength={15}
                          autoFocus
                          onBlur={submitNameEdit}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") submitNameEdit();
                            if (event.key === "Escape") { setNameDraft(characterName); setEditingName(false); }
                          }}
                        />
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm" style={{ background: "var(--panel-bg)", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                          {t.levelShort} {state.lvl}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm" style={{ background: "var(--panel-bg)", borderColor: "var(--color-primary)", color: "var(--color-text)" }}>
                          {t.streakIcon} {state.streak}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm" style={{ background: "var(--panel-bg)", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                          {t.tokenIcon} {state.tokens}
                        </span>
                      </div>
                    </div>
                  </div>
                  {avatarError && (
                    <div className="relative z-10 mt-3 flex items-center gap-2 bg-red-900/40 border border-red-500/40 rounded-xl px-3 py-2 text-red-300 text-xs">
                      <span>⚠️</span> {avatarError}
                      <button className="ml-auto text-red-400 hover:text-red-200" onClick={() => setAvatarError("")}>✕</button>
                    </div>
                  )}
                </div>

                {/* ── XP Progress ── */}
                <div className="mobile-card" style={{ background: "var(--panel-bg)" }}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="cinzel text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.levelProgress}</p>
                    <span className="cinzel text-xs opacity-80" style={{ color: "var(--color-text)" }}>{state.xp} / {state.xpNext} {t.xpLabel}</span>
                  </div>
                  <div className="w-full bg-black/50 rounded-full border border-yellow-700/30 overflow-hidden h-3">
                    <div className="bar-fill h-full rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="cinzel text-[10px]" style={{ color: "var(--color-primary)" }}>{t.levelShort} {state.lvl}</span>
                    <span className="cinzel text-[10px] opacity-70" style={{ color: "var(--color-muted)" }}>{t.levelShort} {state.lvl + 1}</span>
                  </div>
                </div>

                {/* ── Quick Stats Grid ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
                    <span className="text-2xl mb-1">{t.logsIcon}</span>
                    <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{(() => { 
                      let total = state.xp; 
                      let threshold = 300; 
                      let l = 1;
                      while(l < state.lvl && l < 1000) { 
                        total += threshold; 
                        threshold = Math.floor(threshold * 1.2); 
                        l++;
                      } 
                      return total.toLocaleString(); 
                    })()}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.totalXpLabel}</p>
                  </div>
                  <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
                    <span className="text-2xl mb-1">{t.streakIcon}</span>
                    <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.streak}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.currentStreak}</p>
                  </div>
                  <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
                    <span className="text-2xl mb-1">{t.tokenIcon}</span>
                    <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.tokens}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>Tokens</p>
                  </div>
                  <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
                    <span className="text-2xl mb-1">🏆</span>
                    <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.lvl}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.levelLabel}</p>
                  </div>
                </div>

                {/* ── Overall Statistics ── */}
                <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
                  <p className="cinzel text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>Statistics</p>
                  <div className="flex flex-col gap-2.5 text-[var(--color-text)]">
                    <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                      <span className="flex items-center gap-2 text-sm"><span className="text-lg">{t.habitsIcon}</span> Quests Completed</span>
                      <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.totalQuestsCompleted ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                      <span className="flex items-center gap-2 text-sm"><span className="text-lg">{t.streakIcon}</span> Best Streak</span>
                      <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.maxStreak ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                      <span className="flex items-center gap-2 text-sm"><span className="text-lg">💪</span> Habits Built <span className="text-[9px]" style={{ color: "var(--color-muted)" }}>(21+ days)</span></span>
                      <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.builtHabits ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
                      <span className="flex items-center gap-2 text-sm"><span className="text-lg">📅</span> Joined</span>
                      <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.joinedAt ? new Date(profileStats.joinedAt).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* ── Settings ── */}
                <div className="mobile-card flex flex-col gap-1" style={{ background: "var(--panel-bg)" }}>
                  <p className="cinzel text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--color-primary)" }}>Settings</p>
                  <button className="flex items-center gap-3 w-full rounded-xl px-3 py-3 transition-all hover:bg-[var(--card-hover)] active:scale-[0.98]" onClick={() => setShowThemePicker(true)}>
                    <span className="text-xl w-8 text-center">{themes[themeId].icon}</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Theme</p>
                      <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{getThemeMeta(themeId).label}</p>
                    </div>
                    <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
                  </button>
                  <button className="flex items-center gap-3 w-full rounded-xl px-3 py-3 transition-all hover:bg-[var(--card-hover)] active:scale-[0.98]" onClick={() => setShowLanguagePicker(true)}>
                    <span className="text-xl w-8 text-center">🌐</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Language</p>
                      <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{getLanguageMeta(languageId).nativeLabel}</p>
                    </div>
                    <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
                  </button>
                </div>

                {/* ── Logout ── */}
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="mobile-card mobile-pressable flex items-center justify-center gap-2 py-3.5 border border-red-500/30 transition-all hover:bg-red-900/20 active:scale-[0.98]"
                  style={{ background: "rgba(127,29,29,0.15)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-400"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  <span className="cinzel font-bold text-sm text-red-400 tracking-wider uppercase">{t.logoutConfirm}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
        <>
        {showCity && (
          <div className="w-full h-80 sm:h-[400px] md:h-[500px] lg:h-[600px] mb-6 relative rounded-xl overflow-hidden border border-[var(--panel-border)] shadow-lg animate-fade-in" style={{ backgroundColor: 'var(--card-bg)' }}>
            <CityIllustration height="100%" stage={Math.max(0, Math.floor(state.lvl) || 0)} />
          </div>
        )}

        <ProfilePanel
          state={state}
          levelDisplayRef={levelDisplayRef}
          editingName={editingName}
          nameDraft={nameDraft}
          characterName={characterName}
          onNameDraftChange={setNameDraft}
          onSubmitNameEdit={submitNameEdit}
          onStartEditingName={() => {
            setNameDraft(characterName);
            setEditingName(true);
          }}
          onCancelEditingName={() => {
            setNameDraft(characterName);
            setEditingName(false);
          }}
          xpPercent={xpPercent}
          completedToday={completedToday}
          milestoneProgressPercent={milestoneProgressPercent}
          milestoneSteps={milestoneSteps}
          streakBonusPercent={streakBonusPercent}
          weekResetTimer={weekResetTimer}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <QuestBoard pinnedQuests={pinnedQuests} otherQuests={otherQuests} pinnedQuestProgressById={pinnedQuestProgressById} canRerollRandom={canReroll} onRerollRandom={() => handleReroll(completedToday, canReroll)} rerollButtonLabel={completedToday >= 6 || allRandomCompleted ? t.rerollComplete : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.rerollDone : t.rerollButton} rerollButtonTitle={allRandomCompleted ? t.allRandomTasksDone : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.alreadyUsedToday : completedToday >= 6 ? t.allDoneUnavailable : t.oncePerDay} completedIds={state.completed} questRenderCount={questRenderCountRef.current} onCompleteQuest={handleQuestCompleteWrapper} resetTimer={resetTimer} streakFreezeActive={state.streakFreezeActive} />

          <SidePanels leaderboard={leaderboard} authUser={authUser} logs={state.logs} />
        </div>

        <TokenVault
          tokens={state.tokens}
          streakFreezeActive={state.streakFreezeActive}
          extraRerollsToday={state.extraRerollsToday}
          hasRerolledToday={state.hasRerolledToday}
          canRerollPinned={canRerollPinned}
          isFreePinnedReroll={isFreePinnedReroll}
          daysUntilFreePinnedReroll={daysUntilFreePinnedReroll}
          onOpenPinnedReplacement={openPinnedReplacementModal}
          onFreezeStreak={handleFreezeStreak}
          onBuyExtraReroll={handleBuyExtraReroll}
        />
        </>
        )}

        {false && (
        <footer className="mt-8 rounded-2xl border p-4" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="cinzel text-sm font-bold tracking-[0.2em]" style={{ color: "var(--color-primary)" }}>{t.adminPanelLabel || "Admin Panel"}</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setState((prev) => ({ ...prev, lvl: prev.lvl + 1, xpNext: Math.floor(prev.xpNext * 1.1) }))}
                className="text-xs px-3 py-1 rounded-full border border-yellow-500 bg-yellow-900/30 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-colors font-bold"
                title={t.cheatLevelUp}
              >
                +1 {t.levelLabel}
              </button>
              <button
                onClick={handleResetDaily}
                className="text-xs px-3 py-1 rounded-full border border-yellow-700 bg-yellow-900/30 text-yellow-600 hover:bg-yellow-700 hover:text-white transition-colors font-bold"
              >
                {t.resetDaily}
              </button>
              <button
                onClick={handleHardReset}
                className="text-xs px-3 py-1 rounded-full border border-red-600 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white transition-colors font-bold"
              >
                {t.resetProgress}
              </button>
            </div>
          </div>
        </footer>
        )}
      </div>
    </>
  );
}

export default App;



