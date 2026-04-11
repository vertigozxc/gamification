import { useState } from "react";

function useGameplayActions({
  authUser,
  state,
  setState,
  setQuests,
  quests,
  normalizeQuest,
  getTimestamp,
  fetchGameState,
  completeQuestOnServer,
  resetDaily,
  resetHard,
  buyExtraReroll,
  freezeStreak,
  rerollPinned,
  onServerTimeSync,
  setShowRerollConfirm,
  setShowFreezeSuccess,
  setShowLevelUp,
  setLevelUpLevel,
  levelDisplayRef,
  questRenderCountRef,
  vocab
}) {
  const [floatingTexts, setFloatingTexts] = useState([]);

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

  function mergeRerolledQuestsInPlace(currentQuests, rerolledQuests, completedQuestIds) {
    if (!Array.isArray(currentQuests) || currentQuests.length === 0) {
      return Array.isArray(rerolledQuests) ? rerolledQuests : [];
    }

    const completedSet = new Set(Array.isArray(completedQuestIds) ? completedQuestIds : []);
    const next = new Array(currentQuests.length);
    const lockedQuestIds = new Set();

    for (let index = 0; index < currentQuests.length; index += 1) {
      const quest = currentQuests[index];
      const isPinnedSlot = index < 4;
      const isCompleted = completedSet.has(quest.id);
      if (isPinnedSlot || isCompleted) {
        next[index] = quest;
        lockedQuestIds.add(quest.id);
      }
    }

    const replacementPool = (Array.isArray(rerolledQuests) ? rerolledQuests : [])
      .filter((quest) => !lockedQuestIds.has(quest.id));
    const usedReplacementIds = new Set();

    for (let index = 0; index < currentQuests.length; index += 1) {
      if (next[index]) {
        continue;
      }

      const replacement = replacementPool.find((quest) => !usedReplacementIds.has(quest.id));
      if (replacement) {
        next[index] = replacement;
        usedReplacementIds.add(replacement.id);
      } else {
        // Fallback keeps a stable layout if backend pool is unexpectedly short.
        next[index] = currentQuests[index];
      }
    }

    return next;
  }

  function spawnFloatingText(x, y, text, colorClass) {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingTexts((prev) => [...prev, { id, x, y, text, colorClass }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }

  function addLog(msg, classes = "text-slate-400") {
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, { msg, classes, timestamp: getTimestamp() }]
    }));
  }

  async function completeQuest(quest, event) {
    if (state.completed.includes(quest.id)) return;

    let completionResult;
    try {
      completionResult = await completeQuestOnServer(authUser.uid, quest.id);
    } catch {
      addLog(vocab?.questCompletionFailed || "Quest completion failed. Please try again.", "text-red-400 font-bold");
      return;
    }

    const response = await fetchGameState(authUser.uid);
    if (typeof onServerTimeSync === "function") {
      onServerTimeSync(response);
    }
    const gameState = response.user;
    const actualXpGain = Number(completionResult?.totalAwardedXp ?? completionResult?.awardedXp ?? quest.xp);
    const milestoneBonusXp = Number(completionResult?.milestoneBonusXp ?? 0);
    const milestoneTokens = Number(completionResult?.milestoneTokens ?? 0);
    const leveledUp = gameState.level > state.lvl;
    const streakIncreased = response.streak > state.streak;

    const nextState = {
      ...state,
      xp: gameState.xp,
      lvl: gameState.level,
      xpNext: gameState.xpNext,
      streak: response.streak,
      tokens: gameState.tokens,
      productivity: response?.productivity ?? state.productivity,
      pinnedQuestProgress21d: normalizePinnedQuestProgress(response?.pinnedQuestProgress21d),
      completed: [...state.completed, quest.id],
      logs: [...state.logs]
    };

    spawnFloatingText(event.clientX, event.clientY, `+${actualXpGain} ${vocab?.xpLabel || "XP"}`, "text-yellow-300 text-lg");

    if (milestoneBonusXp > 0) {
      spawnFloatingText(event.clientX, event.clientY - 80, `🏅 +${milestoneBonusXp} ${vocab?.xpLabel || "XP"}`, "text-cyan-300 text-sm font-bold");
    }
    if (milestoneTokens > 0) {
      const tokenLabel = milestoneTokens === 1 ? (vocab?.tokenSingular || "Token") : (vocab?.tokenPlural || "Tokens");
      spawnFloatingText(event.clientX, event.clientY - 110, `🪙 +${milestoneTokens} ${tokenLabel}`, "text-amber-300 text-sm font-bold");
    }

    if (streakIncreased) {
      spawnFloatingText(
        event.clientX,
        event.clientY - 50,
        (vocab?.streakGainFloating || "🔥 {label} +1! ({streak})")
          .replace("{label}", vocab?.streakUnit || "Streak")
          .replace("{streak}", String(response.streak)),
        "text-orange-300 text-lg font-bold"
      );
    }

    if (leveledUp) {
      nextState.logs.push({
        msg: (vocab?.levelUpAnnounce || "🎉 ⭐ {prefix} UP! {levelLabel} {level}! ⭐ 🎉")
          .replace("{prefix}", vocab?.levelUpPrefix || "LEVEL")
          .replace("{levelLabel}", vocab?.levelLabel || "Level")
          .replace("{level}", String(gameState.level)),
        classes: "text-yellow-400 font-bold cinzel",
        timestamp: getTimestamp()
      });
      setLevelUpLevel(gameState.level);
      setShowLevelUp(true);
      spawnFloatingText(window.innerWidth / 2, window.innerHeight / 2, vocab?.levelUpFloating || "LEVEL UP!", "text-yellow-300 text-2xl cinzel");

      if (levelDisplayRef.current) {
        levelDisplayRef.current.style.animation = "none";
        setTimeout(() => {
          if (levelDisplayRef.current) {
            levelDisplayRef.current.style.animation = "levelUpPulse 0.6s ease-out";
          }
        }, 10);
      }
    }

    const milestoneSuffix = milestoneBonusXp > 0
      ? (vocab?.milestoneSuffix || ", Milestone: +{xp} XP{tokenPart}")
          .replace("{xp}", String(milestoneBonusXp))
          .replace(
            "{tokenPart}",
            milestoneTokens > 0
              ? (vocab?.milestoneTokenPart || ", +{count} {label}")
                  .replace("{count}", String(milestoneTokens))
                  .replace("{label}", milestoneTokens === 1 ? (vocab?.tokenSingular || "token") : (vocab?.tokenPlural || "tokens"))
              : ""
          )
      : "";
    nextState.logs.push({
      msg: (vocab?.questCompletionLog || "✔️ {title} (+{xp} {xpLabel}, {streakLabel}: {streak}{milestoneSuffix})")
        .replace("{title}", quest.title)
        .replace("{xp}", String(actualXpGain))
        .replace("{xpLabel}", vocab?.xpLabel || "XP")
        .replace("{streakLabel}", vocab?.streakUnit || "Streak")
        .replace("{streak}", String(response.streak))
        .replace("{milestoneSuffix}", milestoneSuffix),
      classes: "text-slate-400",
      timestamp: getTimestamp()
    });

    setState(nextState);
    questRenderCountRef.current += 1;
  }

  function handleReroll(completedToday, canReroll) {
    if (completedToday >= 8) return;
    if (canReroll) setShowRerollConfirm(true);
  }

  async function doReroll() {
    setShowRerollConfirm(false);
    try {
      // Exclude categories already shown by non-pinned quests that stay locked (completed quests).
      const currentOtherQuests = Array.isArray(quests) ? quests.slice(4) : [];
      const completedSet = new Set(Array.isArray(state.completed) ? state.completed : []);
      const excludeCategories = currentOtherQuests
        .filter((quest) => completedSet.has(quest?.id))
        .map((quest) => quest?.category)
        .filter((category) => category && category.length > 0);
      
      const result = await resetDaily(authUser.uid, true, excludeCategories);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      const nextCompleted = Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : state.completed;
      setQuests((prevQuests) => mergeRerolledQuestsInPlace(prevQuests, nextQuests, nextCompleted));
      setState((prev) => ({
        ...prev,
        completed: nextCompleted,
        productivity: result?.productivity ?? prev.productivity,
        pinnedQuestProgress21d: Array.isArray(result?.pinnedQuestProgress21d)
          ? normalizePinnedQuestProgress(result?.pinnedQuestProgress21d)
          : prev.pinnedQuestProgress21d,
        hasRerolledToday: true,
        extraRerollsToday: prev.hasRerolledToday && prev.extraRerollsToday > 0 ? prev.extraRerollsToday - 1 : prev.extraRerollsToday,
        lastReset: Date.now(),
        logs: [
          ...prev.logs,
          {
            msg: vocab?.rerolledLog || "🎲 Quests rerolled! New challenges await!",
            classes: "text-purple-400 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
      questRenderCountRef.current = 0;
    } catch {
      addLog(vocab?.rerollFailed || "Reroll failed. Please try again.", "text-red-400 font-bold");
    }
  }

  async function handleResetDaily() {
    if (!window.confirm(vocab?.resetDailyConfirm || "Reset daily quests? This will clear today's completed quests and give you a fresh set.")) return;
    try {
      const result = await resetDaily(authUser.uid, false);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      setQuests(nextQuests);
      setState((prev) => ({
        ...prev,
        completed: [],
        productivity: result?.productivity ?? prev.productivity,
        pinnedQuestProgress21d: Array.isArray(result?.pinnedQuestProgress21d)
          ? normalizePinnedQuestProgress(result?.pinnedQuestProgress21d)
          : prev.pinnedQuestProgress21d,
        hasRerolledToday: false,
        extraRerollsToday: 0,
        lastReset: Date.now(),
        logs: [
          ...prev.logs,
          {
            msg: vocab?.resetLog || "🌅 Daily quests reset! A new set of challenges awaits!",
            classes: "text-cyan-400 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
      questRenderCountRef.current = 0;
    } catch {
      addLog(vocab?.resetFailed || "Reset failed. Please try again.", "text-red-400 font-bold");
    }
  }

  async function handleHardReset() {
    if (!window.confirm(vocab?.hardResetConfirm || "Are you sure? This will erase ALL progress including level and logs!")) return;

    try {
      const result = await resetHard(authUser.uid);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      setQuests(nextQuests);
      setState((prev) => ({
        lvl: 1,
        xp: 0,
        xpNext: 300,
        tokens: 0,
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
        },
        completed: Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : [],
        logs: [
          ...prev.logs,
          {
            msg: vocab?.hardResetLog || "🔄 Complete reset! Starting fresh from level 1...",
            classes: "text-red-400 font-bold",
            timestamp: getTimestamp()
          }
        ],
        streak: 0,
        lastReset: Date.now(),
        hasRerolledToday: false,
        streakFreezeActive: false,
        extraRerollsToday: 0,
        preferredQuestIds: Array.isArray(result?.preferredQuestIds) ? result.preferredQuestIds : prev.preferredQuestIds,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d)
      }));
      questRenderCountRef.current = 0;
    } catch {
      addLog(vocab?.hardResetFailed || "Hard reset failed. Please try again.", "text-red-400 font-bold");
    }
  }

    async function handleRerollPinned() {
    const isFree = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= 30 * 24 * 60 * 60 * 1000);
    if (!isFree && state.tokens < 7) {
      addLog(vocab?.notEnoughTokensPinned || "Not enough tokens to reroll pinned quests.", "text-red-400 font-bold");
      return;
    }
    


    try {
      const result = await rerollPinned(authUser.uid, !isFree);
      
      const costText = isFree ? (vocab?.freeLabel || "Free") : (vocab?.sevenTokens || "7 Tokens");

      setQuests(Array.isArray(result.quests) ? result.quests.map(normalizeQuest) : []);
      setState(prev => ({
        ...prev,
        tokens: result.tokens,
        preferredQuestIds: result.preferredQuestIds,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d),
        completed: result.completedQuestIds || prev.completed,
        user: {
          ...prev.user,
          lastFreeTaskRerollAt: result.lastFreeTaskRerollAt ?? null
        },
        logs: [
          ...prev.logs,
          {
            msg: (vocab?.pinnedRerolledAllLog || "⟳ All pinned quests rerolled! ({cost})").replace("{cost}", costText),
            classes: "text-cyan-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
    } catch (err) {
      addLog(err?.message || vocab?.rerollPinnedFailed || "Reroll pinned failed.", "text-red-400 font-bold");
    }
  }


  async function handleBuyExtraReroll() {
    try {
      const result = await buyExtraReroll(authUser.uid);
      setState((prev) => ({
        ...prev,
        tokens: result.tokens,
        extraRerollsToday: prev.extraRerollsToday + 1,
        logs: [
          ...prev.logs,
          {
            msg: (vocab?.extraRerollPurchased || "🎲 {title} purchased!").replace("{title}", vocab?.rerollShopTitle || "Extra Reroll"),
            classes: "text-violet-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
    } catch (err) {
      addLog(err?.message || vocab?.purchaseFailed || "Purchase failed. Please try again.", "text-red-400 font-bold");
    }
  }

  async function handleFreezeStreak() {
    try {
      const result = await freezeStreak(authUser.uid);
      setState((prev) => ({
        ...prev,
        tokens: result.tokens,
        streakFreezeActive: true,
        logs: [
          ...prev.logs,
          {
            msg: (vocab?.freezeActivatedLog || "🧊 {title} activated!").replace("{title}", vocab?.freezeTitle || "Streak Freeze"),
            classes: "text-cyan-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
      setShowFreezeSuccess(true);
    } catch (err) {
      addLog(err?.message || vocab?.purchaseFailed || "Purchase failed. Please try again.", "text-red-400 font-bold");
    }
  }

  return {
    floatingTexts,
    addLog,
    completeQuest,
    handleReroll,
    doReroll,
    handleResetDaily,
    handleHardReset,
    handleRerollPinned,
    handleBuyExtraReroll,
    handleFreezeStreak
  };
}

export default useGameplayActions;
