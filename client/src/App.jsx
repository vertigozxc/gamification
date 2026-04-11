import { useEffect, useRef, useState } from "react";
import { auth, googleProvider, firebaseInitError } from "./firebaseAuth";
import {
  upsertProfile,
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
  rerollPinned
} from "./api";
import FreezeSuccessModal from "./components/modals/FreezeSuccessModal";
import RerollConfirmModal from "./components/modals/RerollConfirmModal";
import LogoutConfirmModal from "./components/modals/LogoutConfirmModal";
import NotesModal from "./components/modals/NotesModal";
import OnboardingModal from "./components/modals/OnboardingModal";
import PinnedReplacementModal from "./components/modals/PinnedReplacementModal";
import QuestBoard from "./components/QuestBoard";
import TokenVault from "./components/TokenVault";
import PostTaskFeedbackModal from "./components/modals/PostTaskFeedbackModal";
import AnalyticsPage from "./components/AnalyticsPage";
import { submitQuestFeedback } from "./api";
import ProfilePanel from "./components/ProfilePanel";
import CityIllustration from "./components/CityIllustration";
import SidePanels from "./components/SidePanels";
import useGameplayActions from "./hooks/useGameplayActions";
import useAuthSession from "./hooks/useAuthSession";
import useOnboardingPinned from "./hooks/useOnboardingPinned";
import { useTheme } from "./ThemeContext";
import themes, { themeIds } from "./themeConfig";

const saveKey         = (uid) => `rpg_save_${uid}`;
const characterNameKey = (uid) => `rpg_character_name_${uid}`;
const portraitKey      = (uid) => `rpg_portrait_${uid}`;
const notesKey         = (uid) => `rpg_private_notes_${uid}`;

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
    setAuthError,
    handleGoogleLogin,
    handleLogout
  } = useAuthSession({ auth, googleProvider, firebaseInitError });
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
  
  const [feedbackTask, setFeedbackTask] = useState(null);
  const [showAnalyticsPage, setShowAnalyticsPage] = useState(false);

  const handleQuestCompleteWrapper = (quest, event) => {
    completeQuest(quest, event);
    setFeedbackTask(quest);
  };

  const handleFeedbackSubmit = (feedbackData) => {
    if (feedbackTask && authUser) {
      submitQuestFeedback(authUser.uid, String(feedbackTask.id), feedbackData.rating, feedbackData.textNotes, feedbackData.questionType).catch(console.error);
    }
    setFeedbackTask(null);
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
  const [privateNotes, setPrivateNotes] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [levelUpLevel, setLevelUpLevel] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showCity, setShowCity] = useState(true);
  const [overrideStage, setOverrideStage] = useState(null);
  const questRenderCountRef = useRef(0);
  const portraitUploadRef = useRef(null);
  const levelDisplayRef = useRef(null);
  const uidRef = useRef(null);
  const dayMarkerRef = useRef(new Date().toDateString());
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
    if (!authUser) {
      setState(createDefaultState());
      setQuests([]);
      setCharacterName("Warrior");
      setNameDraft("Warrior");
      setPortraitData("");
      setShowNotesModal(false);
      setPrivateNotes("");
      setNotesDraft("");
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
          classes: "text-slate-500 italic",
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
  const milestoneProgressPercent = Math.min(100, (completedToday / 8) * 100);
  const milestoneSteps = [
    { target: 4, reward: "+20 " + t.xpLabel + " +1 🔥", rune: t.milestoneRunes[0] },
    { target: 6, reward: "+30 " + t.xpLabel, rune: t.milestoneRunes[1] },
    { target: 8, reward: "+50 " + t.xpLabel + " +1" + t.tokenIcon, rune: t.milestoneRunes[2] }
  ];
  const pinnedQuests = quests.slice(0, 4);
  const otherQuests = quests.slice(4);
  const allRandomCompleted = otherQuests.length > 0 && otherQuests.every(q => state.completed.includes(q.id));
  const canReroll = (!state.hasRerolledToday || state.extraRerollsToday > 0) && completedToday < 8 && !allRandomCompleted;
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
    levelDisplayRef,
    questRenderCountRef,
    vocab: t
  });

  function handlePortraitUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const imageData = loadEvent.target?.result;
      if (typeof imageData !== "string") return;
      localStorage.setItem(portraitKey(authUser.uid), imageData);
      setPortraitData(imageData);
      addLog(t.characterPortraitUpdated, "text-yellow-400 font-bold");
      upsertProfile(authUser.uid, characterName || "Warrior", imageData)
        .then(() => fetchLeaderboard())
        .then(({ users }) => setLeaderboard(users || []))
        .catch(() => {});
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
      <div className="auth-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
        <div className="w-full max-w-5xl px-6 py-12 flex flex-col items-center">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="cinzel text-5xl md:text-7xl font-black text-transparent bg-clip-text tracking-widest leading-tight mb-4" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.appTitle}</h1>
            <p className="cinzel text-xl tracking-[0.25em] uppercase" style={{ color: "var(--color-primary-dim)" }}>{t.loginHeroTagline}</p>
          </div>

          <div className="auth-card animate-fade-in w-full max-w-md mx-auto mb-16 text-center">
            <p className="cinzel text-xs tracking-[0.35em] uppercase mb-4" style={{ color: "var(--color-primary)" }}>{t.appTagline}</p>
            <h2 className="cinzel text-3xl text-white mb-3">{t.loginTitle}</h2>
            <p className="text-slate-300 mb-8">{t.loginSubtitle}</p>
            <button className="google-btn w-full justify-center py-4 text-lg" onClick={handleGoogleLogin}>
              <span>G</span>
              <span>{t.loginButton}</span>
            </button>
            {authError && <p className="auth-error mt-4">{authError}</p>}
            {/* Theme Picker Removed */}
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-center shadow-xl">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="cinzel text-xl text-white mb-2">{t.landingBuildHabitsTitle}</h3>
              <p className="text-slate-400 text-sm">{t.landingBuildHabitsDesc}</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-center shadow-xl">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="cinzel text-xl text-white mb-2">{t.landingLevelUpTitle}</h3>
              <p className="text-slate-400 text-sm">{t.landingLevelUpDesc}</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-center shadow-xl">
              <div className="text-4xl mb-4">🏙️</div>
              <h3 className="cinzel text-xl text-white mb-2">{t.landingGrowCityTitle}</h3>
              <p className="text-slate-400 text-sm">{t.landingGrowCityDesc}</p>
            </div>
          </div>

          <div className="w-full mb-12">
            <h2 className="cinzel text-3xl text-center text-white mb-8">{t.landingWitnessGrowth}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4">
                <p className="cinzel text-center text-yellow-500 mb-2">{t.levelLabel} 1</p>
                <div className="w-full h-48 bg-black rounded-lg overflow-hidden relative">
                  <CityIllustration height="100%" stage={1} />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4">
                <p className="cinzel text-center text-yellow-500 mb-2">{t.levelLabel} 10</p>
                <div className="w-full h-48 bg-black rounded-lg overflow-hidden relative flex items-center justify-center select-none pointer-events-none">
                  <div className="absolute inset-0 blur-md opacity-40">
                    <CityIllustration height="100%" stage={10} />
                  </div>
                  <span className="cinzel text-6xl font-bold text-slate-500 z-10 opacity-70">?</span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4">
                <p className="cinzel text-center text-yellow-500 mb-2">{t.levelLabel} 20+</p>
                <div className="w-full h-48 bg-black rounded-lg overflow-hidden relative flex items-center justify-center select-none pointer-events-none">
                  <div className="absolute inset-0 blur-xl opacity-20">
                    <CityIllustration height="100%" stage={25} />
                  </div>
                  <span className="cinzel text-6xl font-bold text-slate-500 z-10 opacity-70">?</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    );
  }

  return (
    <>
      
      <PostTaskFeedbackModal
        open={!!feedbackTask}
        quest={feedbackTask}
        onClose={() => setFeedbackTask(null)}
        onSubmit={handleFeedbackSubmit}
      />
      <FreezeSuccessModal open={showFreezeSuccess} onClose={() => setShowFreezeSuccess(false)} />

      <RerollConfirmModal
        open={showRerollConfirm}
        onCancel={() => setShowRerollConfirm(false)}
        onConfirm={doReroll}
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
                  onClick={() => { setThemeId(id); setShowThemePicker(false); }}
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
        <div className="levelup-popup-card relative flex flex-col items-center justify-center p-8 md:p-12 w-[90vw] md:w-[600px] overflow-hidden" style={{ borderRadius: "2rem", border: "2px solid rgba(251, 191, 36, 0.6)", background: "linear-gradient(160deg, rgba(30,41,59,0.98), rgba(5,10,20,0.99))", boxShadow: "0 0 50px rgba(251, 191, 36, 0.2), inset 0 0 30px rgba(251,191,36,0.1)" }}>
          {/* Animated Background Rays */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
            <div className="w-[150%] h-[150%] animate-[spin_20s_linear_infinite]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.2) 20deg, transparent 40deg, rgba(251,191,36,0.2) 60deg, transparent 80deg, rgba(251,191,36,0.2) 100deg, transparent 120deg, rgba(251,191,36,0.2) 140deg, transparent 160deg, rgba(251,191,36,0.2) 180deg, transparent 200deg, rgba(251,191,36,0.2) 220deg, transparent 240deg, rgba(251,191,36,0.2) 260deg, transparent 280deg, rgba(251,191,36,0.2) 300deg, transparent 320deg, rgba(251,191,36,0.2) 340deg, transparent 360deg)" }} />
          </div>
          <div className="absolute inset-0 top-[-50%] pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_60%)] animate-[pulse_3s_ease-in-out_infinite]" />
          
          <div className="relative z-10 w-full text-center">
            {/* Title Section */}
            <p className="levelup-popup-subtitle cinzel" style={{ fontSize: "1.4rem", letterSpacing: "5px", color: "#fef08a", textShadow: "0 0 15px rgba(251,191,36,0.7)", margin: "0 0 0.5rem 0", animation: "fadeInDown 0.6s ease-out" }}>
              {t.levelUpTitle}
            </p>
            <h2 className="levelup-popup-title cinzel" style={{ fontSize: "5rem", margin: "0 0 1.5rem 0", color: "#fbbf24", borderBottom: "1px solid rgba(251,191,36,0.3)", paddingBottom: "1rem", lineHeight: "1", filter: "drop-shadow(0 0 20px rgba(251,191,36,0.6))", animation: "levelUpPulseSoft 2s infinite" }}>
              {t.levelUpPrefix} {levelUpLevel || state.lvl}
            </h2>

            {/* Content Text */}
            <p className="levelup-popup-message" style={{ fontSize: "1.25rem", fontStyle: "italic", opacity: 0.9, margin: "0 0 1rem 0", color: "#e2e8f0", animation: "fadeInUp 0.8s ease-out" }}>
              "{t.levelUpMessage}"
            </p>
            <div className="mx-auto w-12 h-[2px] bg-yellow-600/50 mb-3" />
            <p className="text-md text-amber-200/80 mb-6 px-4" style={{ animation: "fadeInUp 1s ease-out" }}>
              {t.cityExpansionText}
            </p>

            {/* Rewards */}
            <div className="inline-flex justify-center items-center gap-3 bg-black/40 border border-yellow-700/50 rounded-xl px-6 py-4 mb-8 shadow-[inset_0_0_15px_rgba(251,191,36,0.1)]" style={{ animation: "fadeInUp 1.2s ease-out" }}>
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

      {floatingTexts.map((item) => (
        <div key={item.id} className={`floating-text ${item.colorClass} cinzel`} style={{ left: `${item.x}px`, top: `${item.y}px` }}>
          {item.text}
        </div>
      ))}

      {showAnalyticsPage ? (
        <AnalyticsPage onBack={() => setShowAnalyticsPage(false)} />
      ) : (
      <div className="max-w-7xl mx-auto game-shell relative py-2 px-4">
        <div className="rune-orb rune-orb-left" />

        <header className="relative flex flex-col items-center gap-3 py-3 mb-4">
          <div className="absolute right-0 top-0 flex items-center gap-2 user-auth-widget">
            <div className="theme-selector mr-2" style={{ position: "relative" }}>
              <button className="theme-picker-trigger" onClick={() => setShowThemePicker(true)}>
                  <span>{themes[themeId].icon}</span> {getThemeMeta(themeId).label}
                  <span className="ml-1 text-xs opacity-60">v</span>
                </button>
              </div>
              <div className="theme-selector mr-2" style={{ position: "relative" }}>
                <button className="theme-picker-trigger" onClick={() => setShowLanguagePicker(true)}>
                  <span>🌐</span> {getLanguageMeta(languageId).nativeLabel}
                  <span className="ml-1 text-xs opacity-60">v</span>
                </button>
              </div>
              <input ref={portraitUploadRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePortraitUpload} />
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
          <div className="w-full flex justify-center mt-2 gap-2 flex-wrap">
            <button
              onClick={() => setState(prev => ({ ...prev, lvl: prev.lvl + 1, xpNext: Math.floor(prev.xpNext * 1.1) }))}
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

            <button
              onClick={() => setShowAnalyticsPage(true)}
              className="text-xs px-3 py-1 rounded-full border border-blue-600 bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors font-bold uppercase tracking-wider"
            >
              {t.analyticsButton} 📈
            </button>
          </div>
        </header>

        {showCity && (
          <div className="w-full h-80 sm:h-[400px] md:h-[500px] lg:h-[600px] mb-6 relative rounded-xl overflow-hidden border border-[var(--panel-border)] shadow-lg animate-fade-in" style={{ backgroundColor: '#0c131b' }}>
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
          <QuestBoard pinnedQuests={pinnedQuests} otherQuests={otherQuests} canRerollRandom={canReroll} onRerollRandom={() => handleReroll(completedToday, canReroll)} rerollButtonLabel={completedToday >= 8 || allRandomCompleted ? t.rerollComplete : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.rerollDone : t.rerollButton} rerollButtonTitle={allRandomCompleted ? t.allRandomTasksDone : state.hasRerolledToday && state.extraRerollsToday === 0 ? t.alreadyUsedToday : completedToday >= 8 ? t.allDoneUnavailable : t.oncePerDay} completedIds={state.completed} questRenderCount={questRenderCountRef.current} onCompleteQuest={handleQuestCompleteWrapper} resetTimer={resetTimer} streakFreezeActive={state.streakFreezeActive} onOpenNotes={handleOpenNotes} />

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
      </div>
      )}
    </>
  );
}

export default App;



