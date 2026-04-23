import { useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import {
  fetchCustomQuests as apiFetchCustomQuests,
  createCustomQuest as apiCreateCustomQuest,
  updateCustomQuest as apiUpdateCustomQuest,
  deleteCustomQuest as apiDeleteCustomQuest,
  fetchGameState as apiFetchGameState,
  skipOnboarding as apiSkipOnboarding
} from "../api";
import { fuzzyMatch } from "../utils/fuzzySearch";

// Fallback used before /api/game-state returns the user's questSlots.
// Replaced at runtime by state.questSlots.pinned inside the hook.
const DEFAULT_preferredQuestLimit = 2;
export const CUSTOM_QUEST_TITLE_MAX = 40;
export const CUSTOM_QUEST_DESC_MAX = 120;
const CUSTOM_QUEST_ID_OFFSET = 1_000_000;
const FREE_PINNED_REROLL_INTERVAL_MS = 21 * 24 * 60 * 60 * 1000;

export function isCustomQuestId(id) {
  return Number.isInteger(Number(id)) && Number(id) >= CUSTOM_QUEST_ID_OFFSET;
}

function useOnboardingPinned({
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
  onServerTimeSync,
  normalizeQuest,
  getTimestamp,
  portraitKey
}) {
  const { t, tf } = useTheme();
  const resolvedUsername = username || authUser?.uid || null;
  const preferredQuestLimit = Math.max(1, Number(state?.questSlots?.pinned) || DEFAULT_PREFERRED_QUEST_LIMIT);
  const [showPinnedReplaceModal, setShowPinnedReplaceModal] = useState(false);
  const [replacePinnedQuestIds, setReplacePinnedQuestIds] = useState([]);
  const [replacePinnedSearch, setReplacePinnedSearch] = useState("");
  const [replacePinnedSaving, setReplacePinnedSaving] = useState(false);
  const [replacePinnedError, setReplacePinnedError] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingQuestIds, setOnboardingQuestIds] = useState([]);
  const [onboardingQuestSearch, setOnboardingQuestSearch] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [pinnedReplacementOpening, setPinnedReplacementOpening] = useState(false);
  const [allQuestOptions, setAllQuestOptions] = useState([]);
  const [customQuests, setCustomQuests] = useState([]);
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState("");

  const combinedQuestOptions = useMemo(() => {
    const customEntries = Array.isArray(customQuests) ? customQuests.map((cq) => ({
      ...cq,
      // Trust the server-calculated XP (30/40/50 for timer habits, flat 30
      // otherwise). Don't clobber it with a hardcoded value here.
      xp: Number(cq.xp) || 30,
      category: cq.category || "CUSTOM",
      isCustom: true
    })) : [];
    // Defensive client-side filter: hide quests above the user's current
    // difficulty cap. The server already filters allQuests but the initial
    // fetchAllQuests preload may seed the pool before game-state lands.
    const maxEffort = Math.max(1, Number(state?.questSlots?.maxEffort) || 3);
    const currentStreak = Math.max(0, Number(state?.streak) || 0);
    const eligibleOptions = allQuestOptions.filter((q) => {
      const effort = Number(q?.effortScore ?? q?.effort_score ?? 0);
      const minStreak = Number(q?.minStreak ?? q?.min_streak ?? 0);
      return (effort === 0 || effort <= maxEffort) && minStreak <= currentStreak;
    });
    return [...customEntries, ...eligibleOptions];
  }, [allQuestOptions, customQuests, state?.questSlots?.maxEffort, state?.streak]);

  const filteredOnboardingQuests = useMemo(() => {
    const trimmed = onboardingQuestSearch.trim();
    if (!trimmed) return combinedQuestOptions;
    return combinedQuestOptions.filter((quest) => {
      const haystack = [
        quest?.title || "",
        quest?.desc || "",
        quest?.isCustom ? "custom мои own personal" : ""
      ].join(" ");
      return fuzzyMatch(trimmed, haystack);
    });
  }, [combinedQuestOptions, onboardingQuestSearch]);

  const filteredReplacePinnedQuests = useMemo(() => {
    const trimmed = replacePinnedSearch.trim();
    if (!trimmed) return combinedQuestOptions;
    return combinedQuestOptions.filter((quest) => {
      const haystack = `${quest?.title || ""} ${quest?.desc || ""}`;
      return fuzzyMatch(trimmed, haystack);
    });
  }, [combinedQuestOptions, replacePinnedSearch]);

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

  function resetOnLogout() {
    setShowOnboarding(false);
    setShowPinnedReplaceModal(false);
    setReplacePinnedQuestIds([]);
    setReplacePinnedSearch("");
    setReplacePinnedSaving(false);
    setReplacePinnedError("");
    setOnboardingName("");
    setOnboardingQuestIds([]);
    setOnboardingQuestSearch("");
    setOnboardingError("");
    setOnboardingSaving(false);
    setAllQuestOptions([]);
    setCustomQuests([]);
    setCustomError("");
    setCustomSaving(false);
  }

  function applyCustomQuestsFromResponse(response) {
    if (Array.isArray(response?.customQuests)) {
      setCustomQuests(response.customQuests);
    }
  }

  async function handleCreateCustomQuest({ title, description, needsTimer, timeEstimateMin }) {
    const cleanTitle = String(title || "").trim().slice(0, CUSTOM_QUEST_TITLE_MAX);
    const cleanDesc = String(description || "").trim().slice(0, CUSTOM_QUEST_DESC_MAX);
    if (!cleanTitle) {
      setCustomError(t.customHabitTitleRequired || "Enter a title");
      return null;
    }
    setCustomSaving(true);
    setCustomError("");
    try {
      const result = await apiCreateCustomQuest(resolvedUsername, {
        title: cleanTitle,
        description: cleanDesc,
        needsTimer: Boolean(needsTimer),
        timeEstimateMin: Math.max(0, Number(timeEstimateMin) || 0)
      });
      const created = result?.customQuest;
      if (created) {
        setCustomQuests((prev) => [...prev, created]);
      }
      return created;
    } catch (err) {
      setCustomError(err?.message || (t.customHabitSaveFailed || "Failed to save"));
      return null;
    } finally {
      setCustomSaving(false);
    }
  }

  async function handleUpdateCustomQuest(id, { title, description, needsTimer, timeEstimateMin }) {
    const cleanTitle = title !== undefined ? String(title || "").trim().slice(0, CUSTOM_QUEST_TITLE_MAX) : undefined;
    const cleanDesc = description !== undefined ? String(description || "").trim().slice(0, CUSTOM_QUEST_DESC_MAX) : undefined;
    if (cleanTitle !== undefined && !cleanTitle) {
      setCustomError(t.customHabitTitleRequired || "Enter a title");
      return null;
    }
    setCustomSaving(true);
    setCustomError("");
    try {
      const result = await apiUpdateCustomQuest(resolvedUsername, id, {
        title: cleanTitle,
        description: cleanDesc,
        needsTimer,
        timeEstimateMin
      });
      const updated = result?.customQuest;
      if (updated) {
        setCustomQuests((prev) => prev.map((cq) => (cq.id === updated.id ? updated : cq)));
      }
      return updated;
    } catch (err) {
      setCustomError(err?.message || (t.customHabitSaveFailed || "Failed to save"));
      return null;
    } finally {
      setCustomSaving(false);
    }
  }

  async function handleDeleteCustomQuest(id) {
    setCustomSaving(true);
    setCustomError("");
    try {
      const result = await apiDeleteCustomQuest(resolvedUsername, id);
      if (Array.isArray(result?.customQuests)) {
        setCustomQuests(result.customQuests);
      } else {
        setCustomQuests((prev) => prev.filter((cq) => cq.id !== Number(id)));
      }
      // If it was currently selected in onboarding/replace modal, drop it.
      setOnboardingQuestIds((prev) => prev.filter((qid) => qid !== Number(id)));
      setReplacePinnedQuestIds((prev) => prev.filter((qid) => qid !== Number(id)));
      // Update preferredQuestIds in parent state too if server returned it.
      if (Array.isArray(result?.preferredQuestIds)) {
        setState((prev) => ({
          ...prev,
          preferredQuestIds: result.preferredQuestIds
        }));
      }
      return true;
    } catch (err) {
      setCustomError(err?.message || (t.customHabitDeleteFailed || "Failed to delete"));
      return false;
    } finally {
      setCustomSaving(false);
    }
  }

  async function refreshCustomQuests() {
    try {
      const result = await apiFetchCustomQuests(resolvedUsername);
      if (Array.isArray(result?.customQuests)) {
        setCustomQuests(result.customQuests);
      }
    } catch {
      /* noop */
    }
  }

  function applyServerBootstrap(gameStateResponse, _fallbackName) {
    const allQuests = Array.isArray(gameStateResponse?.allQuests)
      ? gameStateResponse.allQuests.map(normalizeQuest)
      : [];
    if (allQuests.length) {
      setAllQuestOptions(allQuests);
    }

    if (Array.isArray(gameStateResponse?.customQuests)) {
      setCustomQuests(gameStateResponse.customQuests);
    }

    const preferredQuestIds = Array.isArray(gameStateResponse?.preferredQuestIds)
      ? gameStateResponse.preferredQuestIds.filter((id) => Number.isInteger(id))
      : [];
    const needsOnboarding = gameStateResponse?.needsOnboarding === true;
    setShowOnboarding(needsOnboarding);
    if (needsOnboarding) {
      setOnboardingError("");
      setOnboardingSaving(false);
      setOnboardingQuestSearch("");
      setOnboardingQuestIds(preferredQuestIds);
      // Pre-fill the nickname from the Google / Firebase displayName so the
      // tester can tap "I'll setup habits later" in one step without having
      // to type anything. Falls back to the server's stored displayName (if
      // any) and finally to an empty string.
      const seededName = String(
        authUser?.displayName
        || gameStateResponse?.user?.displayName
        || ""
      ).trim().slice(0, 32);
      setOnboardingName(seededName);
    }

    return preferredQuestIds;
  }

  function seedAllQuestOptions(allQuestsResponse) {
    const allQuests = Array.isArray(allQuestsResponse?.quests) ? allQuestsResponse.quests.map(normalizeQuest) : [];
    setAllQuestOptions(allQuests);
  }

  function toggleOnboardingQuest(questId) {
    setOnboardingQuestIds((prev) => {
      if (prev.includes(questId)) {
        return prev.filter((id) => id !== questId);
      }
      if (prev.length >= preferredQuestLimit) {
        return prev;
      }
      return [...prev, questId];
    });
  }

  function toggleReplacePinnedQuest(questId) {
    // Any selection change invalidates a previous "Not enough tokens" / server error.
    setReplacePinnedError("");
    setReplacePinnedQuestIds((prev) => {
      if (prev.includes(questId)) {
        return prev.filter((id) => id !== questId);
      }
      if (prev.length >= preferredQuestLimit) {
        return prev;
      }
      return [...prev, questId];
    });
  }

  async function openPinnedReplacementModal() {
    setReplacePinnedError("");
    setReplacePinnedSaving(true);
    // Show a loading preloader while we pre-fetch authoritative state —
    // without it the user taps "Reroll habits" and sees nothing for ~1 s
    // until the modal finally mounts.
    setPinnedReplacementOpening(true);
    setReplacePinnedSearch("");
    setReplacePinnedQuestIds(Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds.slice(0, preferredQuestLimit) : []);

    // Fetch authoritative state before showing the modal so token-dependent UI
    // does not flash stale values from persisted local state.
    if (authUser?.uid) {
      try {
        const resp = await apiFetchGameState(resolvedUsername);
        if (resp) {
          if (Array.isArray(resp.customQuests)) {
            setCustomQuests(resp.customQuests);
          }
          const nextPreferred = Array.isArray(resp.preferredQuestIds)
            ? resp.preferredQuestIds.slice(0, preferredQuestLimit)
            : (Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds.slice(0, preferredQuestLimit) : []);
          setReplacePinnedQuestIds(nextPreferred);
          setState((prev) => ({
            ...prev,
            tokens: typeof resp.user?.tokens === "number" ? resp.user.tokens : prev.tokens,
            preferredQuestIds: Array.isArray(resp.preferredQuestIds) ? resp.preferredQuestIds : prev.preferredQuestIds,
            user: {
              ...prev.user,
              lastFreeTaskRerollAt: resp.user?.lastFreeTaskRerollAt ?? prev.user?.lastFreeTaskRerollAt ?? null,
              tokens: typeof resp.user?.tokens === "number" ? resp.user.tokens : prev.user?.tokens
            }
          }));
        }
      } catch {
        /* non-fatal — keep current state */
      }
    }

    setShowPinnedReplaceModal(true);
    setReplacePinnedSaving(false);
    setPinnedReplacementOpening(false);
  }

  async function handleBuyPinnedReplacement() {
    if (replacePinnedQuestIds.length !== preferredQuestLimit) {
      setReplacePinnedError(tf("pickExactly4Quests", { n: preferredQuestLimit }));
      return;
    }

    setReplacePinnedSaving(true);
    setReplacePinnedError("");
    try {
      const isFreePinnedReroll = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
        const result = await replacePinnedQuests(resolvedUsername, replacePinnedQuestIds, !isFreePinnedReroll);
      const costText = isFreePinnedReroll ? t.freeLabel : t.sevenTokens;
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      applyCustomQuestsFromResponse(result);
      setQuests(nextQuests);
      setState((prev) => ({
        ...prev,
        tokens: result?.tokens ?? prev.tokens,
        preferredQuestIds: Array.isArray(result?.preferredQuestIds) ? result.preferredQuestIds : prev.preferredQuestIds,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d),
        completed: Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : prev.completed,
        user: {
          ...prev.user,
          lastFreeTaskRerollAt: result?.lastFreeTaskRerollAt ?? null
        },
        logs: [
          ...prev.logs,
          {
            msg: tf("pinnedQuestsUpdated", { cost: costText }),
            classes: "text-cyan-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
      setShowPinnedReplaceModal(false);
    } catch (err) {
      setReplacePinnedError(err?.message || t.purchaseFailed);
      // Re-sync tokens/free-reroll state so the UI reflects reality after a failed purchase.
      if (authUser?.uid) {
        apiFetchGameState(resolvedUsername)
          .then((resp) => {
            if (!resp) return;
            setState((prev) => ({
              ...prev,
              tokens: typeof resp.user?.tokens === "number" ? resp.user.tokens : prev.tokens,
              user: {
                ...prev.user,
                lastFreeTaskRerollAt: resp.user?.lastFreeTaskRerollAt ?? prev.user?.lastFreeTaskRerollAt ?? null,
                tokens: typeof resp.user?.tokens === "number" ? resp.user.tokens : prev.user?.tokens
              }
            }));
          })
          .catch(() => {});
      }
    } finally {
      setReplacePinnedSaving(false);
    }
  }

  // "I'll do it later" handler. Still saves the displayName (nickname is
  // required to address the user), but does NOT require any habits picked.
  // Server stamps onboardingSkippedAt so the gate won't come back. Empty
  // habit slots will render as add-habit placeholders on the daily board.
  async function handleSkipOnboarding() {
    const trimmedName = onboardingName.trim();
    if (!trimmedName) {
      setOnboardingError(t.nicknameRequired);
      return;
    }

    setOnboardingSaving(true);
    setOnboardingError("");
    try {
      const result = await apiSkipOnboarding(resolvedUsername, trimmedName, portraitData || undefined);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      applyCustomQuestsFromResponse(result);
      setQuests(nextQuests);
      setCharacterName(result?.user?.displayName || trimmedName);
      setNameDraft(result?.user?.displayName || trimmedName);
      const nextPortrait = result?.user?.photoUrl || portraitData || "";
      setPortraitData(nextPortrait);
      setState((prev) => ({
        ...prev,
        completed: Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : prev.completed,
        streak: Number(result?.streak ?? prev.streak),
        streakFreezeActive: result?.streakFreezeActive ?? prev.streakFreezeActive,
        hasRerolledToday: result?.hasRerolledToday ?? prev.hasRerolledToday,
        extraRerollsToday: Number(result?.extraRerollsToday ?? result?.user?.extraRerollsToday ?? prev.extraRerollsToday),
        lvl: result?.user?.level ?? prev.lvl,
        xp: result?.user?.xp ?? prev.xp,
        xpNext: result?.user?.xpNext ?? prev.xpNext,
        tokens: result?.user?.tokens ?? prev.tokens,
        user: {
          ...prev.user,
          lastFreeTaskRerollAt: result?.user?.lastFreeTaskRerollAt ?? null
        },
        productivity: result?.productivity ?? prev.productivity,
        questSlots: result?.questSlots ?? prev.questSlots,
        preferredQuestIds: Array.isArray(result?.preferredQuestIds) ? result.preferredQuestIds : [],
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d)
      }));
      const { users } = await fetchLeaderboard();
      setLeaderboard(users || []);
      setShowOnboarding(false);
    } catch (error) {
      setOnboardingError(error?.message || t.setupFailed);
    } finally {
      setOnboardingSaving(false);
    }
  }

  async function handleCompleteOnboarding() {
    const trimmedName = onboardingName.trim();
    if (!trimmedName) {
      setOnboardingError(t.nicknameRequired);
      return;
    }
    if (onboardingQuestIds.length !== preferredQuestLimit) {
      setOnboardingError(tf("pickExactly4PreferredQuests", { n: preferredQuestLimit }));
      return;
    }

    setOnboardingSaving(true);
    setOnboardingError("");
    try {
      const result = await completeOnboarding(resolvedUsername, trimmedName, onboardingQuestIds, portraitData || undefined);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      applyCustomQuestsFromResponse(result);
      setQuests(nextQuests);
      setCharacterName(result?.user?.displayName || trimmedName);
      setNameDraft(result?.user?.displayName || trimmedName);
      const nextPortrait = result?.user?.photoUrl || portraitData || "";
      setPortraitData(nextPortrait);
      setState((prev) => ({
        ...prev,
        completed: Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : prev.completed,
        streak: Number(result?.streak ?? prev.streak),
        streakFreezeActive: result?.streakFreezeActive ?? prev.streakFreezeActive,
        hasRerolledToday: result?.hasRerolledToday ?? prev.hasRerolledToday,
        extraRerollsToday: Number(result?.extraRerollsToday ?? result?.user?.extraRerollsToday ?? prev.extraRerollsToday),
        lvl: result?.user?.level ?? prev.lvl,
        xp: result?.user?.xp ?? prev.xp,
        xpNext: result?.user?.xpNext ?? prev.xpNext,
        tokens: result?.user?.tokens ?? prev.tokens,
        user: {
          ...prev.user,
          lastFreeTaskRerollAt: result?.user?.lastFreeTaskRerollAt ?? null
        },
        productivity: result?.productivity ?? prev.productivity,
        questSlots: result?.questSlots ?? prev.questSlots,
        preferredQuestIds: Array.isArray(result?.preferredQuestIds) ? result.preferredQuestIds : prev.preferredQuestIds,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d),
        logs: [
          ...prev.logs,
          {
            msg: tf("onboardingSetupComplete", { pinned: preferredQuestLimit }),
            classes: "text-emerald-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
      const { users } = await fetchLeaderboard();
      setLeaderboard(users || []);
      setShowOnboarding(false);
    } catch (error) {
      setOnboardingError(error?.message || t.setupFailed);
    } finally {
      setOnboardingSaving(false);
    }
  }

  return {
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
    allQuestOptions,
    setAllQuestOptions,
    customQuests,
    setCustomQuests,
    customSaving,
    customError,
    setCustomError,
    handleCreateCustomQuest,
    handleUpdateCustomQuest,
    handleDeleteCustomQuest,
    refreshCustomQuests,
    filteredOnboardingQuests,
    filteredReplacePinnedQuests,
    // Unfiltered pool (before search) — modals use it to re-surface
    // initially-selected habits that a search term would otherwise drop.
    allEligibleQuestOptions: combinedQuestOptions,
    resetOnLogout,
    applyServerBootstrap,
    seedAllQuestOptions,
    toggleOnboardingQuest,
    toggleReplacePinnedQuest,
    openPinnedReplacementModal,
    pinnedReplacementOpening,
    handleBuyPinnedReplacement,
    handleCompleteOnboarding,
    handleSkipOnboarding
  };
}

export default useOnboardingPinned;
