import { useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import {
  fetchCustomQuests as apiFetchCustomQuests,
  createCustomQuest as apiCreateCustomQuest,
  updateCustomQuest as apiUpdateCustomQuest,
  deleteCustomQuest as apiDeleteCustomQuest,
  fetchGameState as apiFetchGameState
} from "../api";

const PREFERRED_QUEST_LIMIT = 3;
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
  const [allQuestOptions, setAllQuestOptions] = useState([]);
  const [customQuests, setCustomQuests] = useState([]);
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState("");

  const combinedQuestOptions = useMemo(() => {
    const customEntries = Array.isArray(customQuests) ? customQuests.map((cq) => ({
      ...cq,
      // Custom quests always show 30 XP and are tagged for UI affordances.
      xp: 30,
      category: cq.category || "CUSTOM",
      isCustom: true
    })) : [];
    return [...customEntries, ...allQuestOptions];
  }, [allQuestOptions, customQuests]);

  const filteredOnboardingQuests = useMemo(() => {
    const normalizedQuestSearch = onboardingQuestSearch.trim().toLowerCase();
    return combinedQuestOptions.filter((quest) => {
      if (!normalizedQuestSearch) return true;

      const searchableText = [
        String(quest?.title || "").toLowerCase(),
        String(quest?.desc || "").toLowerCase(),
        quest?.isCustom ? "custom мои own personal" : ""
      ].join(" ");

      return searchableText.includes(normalizedQuestSearch);
    });
  }, [combinedQuestOptions, onboardingQuestSearch]);

  const filteredReplacePinnedQuests = useMemo(() => {
    const normalizedPinnedSearch = replacePinnedSearch.trim().toLowerCase();
    return combinedQuestOptions.filter((quest) => {
      if (!normalizedPinnedSearch) return true;
      const searchableText = `${String(quest?.title || "").toLowerCase()} ${String(quest?.desc || "").toLowerCase()}`;
      return searchableText.includes(normalizedPinnedSearch);
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

  async function handleCreateCustomQuest({ title, description, stat }) {
    const cleanTitle = String(title || "").trim().slice(0, CUSTOM_QUEST_TITLE_MAX);
    const cleanDesc = String(description || "").trim().slice(0, CUSTOM_QUEST_DESC_MAX);
    if (!cleanTitle) {
      setCustomError(t.customHabitTitleRequired || "Enter a title");
      return null;
    }
    setCustomSaving(true);
    setCustomError("");
    try {
      const result = await apiCreateCustomQuest(username, {
        title: cleanTitle,
        description: cleanDesc,
        stat: stat || "sta"
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

  async function handleUpdateCustomQuest(id, { title, description, stat }) {
    const cleanTitle = title !== undefined ? String(title || "").trim().slice(0, CUSTOM_QUEST_TITLE_MAX) : undefined;
    const cleanDesc = description !== undefined ? String(description || "").trim().slice(0, CUSTOM_QUEST_DESC_MAX) : undefined;
    if (cleanTitle !== undefined && !cleanTitle) {
      setCustomError(t.customHabitTitleRequired || "Enter a title");
      return null;
    }
    setCustomSaving(true);
    setCustomError("");
    try {
      const result = await apiUpdateCustomQuest(username, id, {
        title: cleanTitle,
        description: cleanDesc,
        stat
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
      const result = await apiDeleteCustomQuest(username, id);
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
      const result = await apiFetchCustomQuests(username);
      if (Array.isArray(result?.customQuests)) {
        setCustomQuests(result.customQuests);
      }
    } catch {
      /* noop */
    }
  }

  function applyServerBootstrap(gameStateResponse, fallbackName) {
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
      setOnboardingName((fallbackName || gameStateResponse?.user?.displayName || authUser?.displayName || "").trim());
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
      if (prev.length >= PREFERRED_QUEST_LIMIT) {
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
      if (prev.length >= PREFERRED_QUEST_LIMIT) {
        return prev;
      }
      return [...prev, questId];
    });
  }

  async function openPinnedReplacementModal() {
    setReplacePinnedError("");
    setReplacePinnedSaving(true);
    setReplacePinnedSearch("");
    setReplacePinnedQuestIds(Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds.slice(0, PREFERRED_QUEST_LIMIT) : []);

    // Fetch authoritative state before showing the modal so token-dependent UI
    // does not flash stale values from persisted local state.
    if (authUser?.uid) {
      try {
        const resp = await apiFetchGameState(username);
        if (resp) {
          if (Array.isArray(resp.customQuests)) {
            setCustomQuests(resp.customQuests);
          }
          const nextPreferred = Array.isArray(resp.preferredQuestIds)
            ? resp.preferredQuestIds.slice(0, PREFERRED_QUEST_LIMIT)
            : (Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds.slice(0, PREFERRED_QUEST_LIMIT) : []);
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
  }

  async function handleBuyPinnedReplacement() {
    if (replacePinnedQuestIds.length !== PREFERRED_QUEST_LIMIT) {
      setReplacePinnedError(t.pickExactly4Quests);
      return;
    }

    setReplacePinnedSaving(true);
    setReplacePinnedError("");
    try {
      const isFreePinnedReroll = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
        const result = await replacePinnedQuests(username, replacePinnedQuestIds, !isFreePinnedReroll);
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
        apiFetchGameState(username)
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

  async function handleCompleteOnboarding() {
    const trimmedName = onboardingName.trim();
    if (!trimmedName) {
      setOnboardingError(t.nicknameRequired);
      return;
    }
    if (onboardingQuestIds.length !== PREFERRED_QUEST_LIMIT) {
      setOnboardingError(t.pickExactly4PreferredQuests);
      return;
    }

    setOnboardingSaving(true);
    setOnboardingError("");
    try {
      const result = await completeOnboarding(username, trimmedName, onboardingQuestIds, portraitData || undefined);
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
        preferredQuestIds: Array.isArray(result?.preferredQuestIds) ? result.preferredQuestIds : prev.preferredQuestIds,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d),
        logs: [
          ...prev.logs,
          {
            msg: t.onboardingSetupComplete,
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
    resetOnLogout,
    applyServerBootstrap,
    seedAllQuestOptions,
    toggleOnboardingQuest,
    toggleReplacePinnedQuest,
    openPinnedReplacementModal,
    handleBuyPinnedReplacement,
    handleCompleteOnboarding
  };
}

export default useOnboardingPinned;
