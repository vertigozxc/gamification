import { useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";

const PREFERRED_QUEST_LIMIT = 3;

function useOnboardingPinned({
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

  const filteredOnboardingQuests = useMemo(() => {
    const normalizedQuestSearch = onboardingQuestSearch.trim().toLowerCase();
    return allQuestOptions.filter((quest) => {
      if (!normalizedQuestSearch) return true;

      const stat = String(quest?.stat || "").toLowerCase();
      const searchableText = [
        String(quest?.title || "").toLowerCase(),
        String(quest?.desc || "").toLowerCase(),
        stat,
        stat === "str" ? "strength body power muscle 💪 ⚔" : "",
        stat === "int" ? "intelligence mind focus brain 🧠 📘" : "",
        stat === "sta" ? "stamina endurance recovery shield 🛡 ❤️" : ""
      ].join(" ");

      return searchableText.includes(normalizedQuestSearch);
    });
  }, [allQuestOptions, onboardingQuestSearch]);

  const filteredReplacePinnedQuests = useMemo(() => {
    const normalizedPinnedSearch = replacePinnedSearch.trim().toLowerCase();
    return allQuestOptions.filter((quest) => {
      if (!normalizedPinnedSearch) return true;
      const searchableText = `${String(quest?.title || "").toLowerCase()} ${String(quest?.desc || "").toLowerCase()}`;
      return searchableText.includes(normalizedPinnedSearch);
    });
  }, [allQuestOptions, replacePinnedSearch]);

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
  }

  function applyServerBootstrap(gameStateResponse, fallbackName) {
    const allQuests = Array.isArray(gameStateResponse?.allQuests)
      ? gameStateResponse.allQuests.map(normalizeQuest)
      : [];
    if (allQuests.length) {
      setAllQuestOptions(allQuests);
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

  function openPinnedReplacementModal() {
    setReplacePinnedError("");
    setReplacePinnedSaving(false);
    setReplacePinnedSearch("");
    setReplacePinnedQuestIds(Array.isArray(state.preferredQuestIds) ? state.preferredQuestIds.slice(0, PREFERRED_QUEST_LIMIT) : []);
    setShowPinnedReplaceModal(true);
  }

  async function handleBuyPinnedReplacement() {
    if (replacePinnedQuestIds.length !== PREFERRED_QUEST_LIMIT) {
      setReplacePinnedError(t.pickExactly4Quests);
      return;
    }

    setReplacePinnedSaving(true);
    setReplacePinnedError("");
    try {
      const isFreePinnedReroll = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= 30 * 24 * 60 * 60 * 1000);
      const result = await replacePinnedQuests(authUser.uid, replacePinnedQuestIds, !isFreePinnedReroll);
      const costText = isFreePinnedReroll ? t.freeLabel : t.sevenTokens;
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
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
      const result = await completeOnboarding(authUser.uid, trimmedName, onboardingQuestIds, portraitData || undefined);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      setQuests(nextQuests);
      localStorage.setItem(`rpg_character_name_${authUser.uid}`, trimmedName);
      setCharacterName(trimmedName);
      setNameDraft(trimmedName);
      const nextPortrait = result?.user?.photoUrl || portraitData || "";
      setPortraitData(nextPortrait);
      localStorage.setItem(portraitKey(authUser.uid), nextPortrait);
      setState((prev) => ({
        ...prev,
        completed: Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : prev.completed,
        streak: Number(result?.streak ?? prev.streak),
        streakFreezeActive: result?.streakFreezeActive ?? prev.streakFreezeActive,
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
