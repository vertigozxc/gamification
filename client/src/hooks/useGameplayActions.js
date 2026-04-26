import { useRef, useState } from "react";

const FREE_PINNED_REROLL_INTERVAL_MS = 21 * 24 * 60 * 60 * 1000;

function trackEvent(type, meta) {
  if (typeof window === "undefined") return;
  import("../eventLogger.js")
    .then((mod) => mod.logEvent(type, { meta }))
    .catch(() => {});
}

function useGameplayActions({
  authUser,
  username,
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
  buyXpBoost,
  freezeStreak,
  rerollPinned,
  onServerTimeSync,
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
  vocab
}) {
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [pendingQuestIds, setPendingQuestIds] = useState([]);
  const [freezeStreakPending, setFreezeStreakPending] = useState(false);
  const [rerollingQuestId, setRerollingQuestId] = useState(null);
  const [rerollingPinned, setRerollingPinned] = useState(false);
  const resolvedUsername = username || authUser?.uid || null;
  const completionInFlightRef = useRef(new Set());
  const completionQueueRef = useRef([]);
  const completionRunningRef = useRef(false);

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

  function mergeRerolledQuestsInPlace(currentQuests, rerolledQuests, completedQuestIds, targetQuestId) {
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

      let shouldLock = isPinnedSlot || isCompleted;
      if (targetQuestId) {
        if (quest.id !== targetQuestId) {
          shouldLock = true;
        } else {
          shouldLock = false;
        }
      }

      if (shouldLock) {
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
    const questId = Number(quest?.id);
    if (!Number.isInteger(questId)) {
      return;
    }
    const pointerX = Number(event?.clientX) || (typeof window !== "undefined" ? window.innerWidth / 2 : 0);
    const pointerY = Number(event?.clientY) || (typeof window !== "undefined" ? window.innerHeight / 2 : 0);

    // Check if already completed or in-flight (guard against duplicates)
    if (Array.isArray(state.completed) && state.completed.includes(questId)) {
      return;
    }
    if (completionInFlightRef.current.has(questId)) {
      return;
    }

    completionInFlightRef.current.add(questId);
    setPendingQuestIds((prev) => (prev.includes(questId) ? prev : [...prev, questId]));

    const runCompletion = async () => {
      let completionResult;
      try {
        completionResult = await completeQuestOnServer(resolvedUsername, questId);
      } catch (err) {
        const isAlreadyCompleted = /already completed/i.test(String(err?.message || ""));

        if (isAlreadyCompleted) {
          try {
            const latest = await fetchGameState(resolvedUsername);
            if (typeof onServerTimeSync === "function") {
              onServerTimeSync(latest);
            }
            setState((prev) => ({
              ...prev,
              completed: Array.isArray(latest?.completedQuestIds)
                ? latest.completedQuestIds
                : (prev.completed.includes(questId) ? prev.completed : [...prev.completed, questId]),
              xp: latest?.user?.xp ?? prev.xp,
              lvl: latest?.user?.level ?? prev.lvl,
              xpNext: latest?.user?.xpNext ?? prev.xpNext,
              silver: latest?.user?.silver ?? prev.silver,
              streak: Number(latest?.streak ?? prev.streak),
              productivity: latest?.productivity ?? prev.productivity,
              questSlots: latest?.questSlots ?? prev.questSlots,
              pinnedQuestProgress21d: normalizePinnedQuestProgress(latest?.pinnedQuestProgress21d)
            }));
          } catch (_) {
            // Keep optimistic completion if server says already completed but refresh failed.
          }
          setPendingQuestIds((prev) => prev.filter((id) => id !== questId));
          completionInFlightRef.current.delete(questId);
          return;
        }

        setPendingQuestIds((prev) => prev.filter((id) => id !== questId));
        trackEvent("quest_complete_failed", { questId, message: err?.message });
        addLog(vocab?.questCompletionFailed || "Quest completion failed. Please try again.", "text-red-400 font-bold");
        completionInFlightRef.current.delete(questId);
        return;
      }

      try {
        const response = await fetchGameState(resolvedUsername);
        if (typeof onServerTimeSync === "function") {
          onServerTimeSync(response);
        }
        const gameState = response.user;
        const actualXpGain = Number(completionResult?.totalAwardedXp ?? completionResult?.awardedXp ?? quest.xp);
        const milestoneBonusXp = Number(completionResult?.milestoneBonusXp ?? 0);
        const milestoneSilver = Number(completionResult?.milestoneSilver ?? 0);
        const habitMilestoneReached = completionResult?.habitMilestoneReached === true;
        const habitMilestoneSilver = Number(completionResult?.habitMilestoneSilver ?? 0);

        // Use setState updater to read current state for comparisons
        setState((prev) => {
          const leveledUp = gameState.level > prev.lvl;
          const streakIncreased = response.streak > prev.streak;
          const newLogEntries = [];

          if (milestoneBonusXp > 0) {
            spawnFloatingText(pointerX, pointerY - 80, `🏅 +${milestoneBonusXp} ${vocab?.xpLabel || "XP"}`, "text-cyan-300 text-sm font-bold");
          }
          if (milestoneSilver > 0) {
            const silverLabel = milestoneSilver === 1 ? (vocab?.silverSingular || "Silver") : (vocab?.silverPlural || "Silver");
            spawnFloatingText(pointerX, pointerY - 110, `🪙 +${milestoneSilver} ${silverLabel}`, "text-amber-300 text-sm font-bold");
          }
          if (habitMilestoneReached && habitMilestoneSilver > 0) {
            const silverLabel = habitMilestoneSilver === 1 ? (vocab?.silverSingular || "Silver") : (vocab?.silverPlural || "Silver");
            spawnFloatingText(pointerX, pointerY - 140, `🏆 +${habitMilestoneSilver} ${silverLabel}`, "text-emerald-300 text-sm font-bold");
            if (typeof setHabitMilestoneTitle === "function") {
              setHabitMilestoneTitle(quest.title);
            }
            if (typeof setHabitMilestoneSilver === "function") {
              setHabitMilestoneSilver(habitMilestoneSilver);
            }
            if (typeof setShowHabitMilestone === "function") {
              setShowHabitMilestone(true);
            }
          }

          if (streakIncreased) {
            spawnFloatingText(
              pointerX,
              pointerY - 50,
              (vocab?.streakGainFloating || "🔥 {label} +1! ({streak})")
                .replace("{label}", vocab?.streakUnit || "Streak")
                .replace("{streak}", String(response.streak)),
              "text-orange-300 text-lg font-bold"
            );
          }

          trackEvent("quest_completed", {
            questId,
            category: quest.category,
            xp: actualXpGain,
            milestoneBonusXp,
            milestoneSilver,
            habitMilestoneReached,
            streak: response.streak,
            silver: gameState.silver,
            level: gameState.level
          });

          if (leveledUp) {
            trackEvent("level_up", { from: prev.lvl, to: gameState.level });
            newLogEntries.push({
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

          // Server-detected tier crossing — slot mix or difficulty cap
          // changed because of this completion (level milestone or
          // streak hitting 14 for the first time). Mandatory popup so
          // the player notices what just unlocked.
          if (completionResult?.tierUnlock && typeof setTierUnlock === "function") {
            setTierUnlock(completionResult.tierUnlock);
          }

          const milestoneSuffix = milestoneBonusXp > 0
            ? (vocab?.milestoneSuffix || ", Milestone: +{xp} XP{silverPart}")
                .replace("{xp}", String(milestoneBonusXp))
                .replace(
                  "{silverPart}",
                  milestoneSilver > 0
                    ? (vocab?.milestoneSilverPart || ", +{count} {label}")
                        .replace("{count}", String(milestoneSilver))
                        .replace("{label}", milestoneSilver === 1 ? (vocab?.silverSingular || "silver") : (vocab?.silverPlural || "silver"))
                    : ""
                )
            : "";
          newLogEntries.push({
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

          return {
            ...prev,
            xp: gameState.xp,
            lvl: gameState.level,
            xpNext: gameState.xpNext,
            streak: response.streak,
            silver: gameState.silver,
            productivity: response?.productivity ?? prev.productivity,
            questSlots: response?.questSlots ?? prev.questSlots,
            pinnedQuestProgress21d: normalizePinnedQuestProgress(response?.pinnedQuestProgress21d),
            completed: prev.completed.includes(questId) ? prev.completed : [...prev.completed, questId],
            logs: [...prev.logs, ...newLogEntries]
          };
        });
        questRenderCountRef.current += 1;
      } finally {
        setPendingQuestIds((prev) => prev.filter((id) => id !== questId));
        completionInFlightRef.current.delete(questId);
      }
    };

    completionQueueRef.current.push(runCompletion);
    if (!completionRunningRef.current) {
      completionRunningRef.current = true;
      (async () => {
        while (completionQueueRef.current.length > 0) {
          const task = completionQueueRef.current.shift();
          try {
            await task();
          } catch (_) {
            // individual task errors are handled inside runCompletion
          }
        }
        completionRunningRef.current = false;
      })();
    }
  }

  async function doReroll(targetQuestIds) {
    const selectedQuestIds = [...new Set((Array.isArray(targetQuestIds) ? targetQuestIds : [targetQuestIds])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0))].slice(0, 3);

    if (selectedQuestIds.length === 0) {
      return;
    }

    setShowRerollConfirm(false);
    setRerollingQuestId(selectedQuestIds[0] || null);
    trackEvent("quest_reroll_requested", { targetQuestIds: selectedQuestIds });
    try {
      // Exclude categories already shown by non-pinned quests that stay locked (completed quests).
      const preferredQuestCount = Array.isArray(state.preferredQuestIds) && state.preferredQuestIds.length > 0 ? state.preferredQuestIds.length : 3;
      const currentOtherQuests = Array.isArray(quests) ? quests.slice(preferredQuestCount) : [];
      const completedSet = new Set(Array.isArray(state.completed) ? state.completed : []);
      const excludeCategories = currentOtherQuests
        .filter((quest) => completedSet.has(quest?.id))
        .map((quest) => quest?.category)
        .filter((category) => category && category.length > 0);
      const selectedQuestIdSet = new Set(selectedQuestIds);
      
      const keepQuestIds = currentOtherQuests
        .filter((q) => q && !selectedQuestIdSet.has(q.id))
        .map((q) => q.id);

      const result = await resetDaily(resolvedUsername, true, excludeCategories, selectedQuestIds, keepQuestIds);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      const nextCompleted = Array.isArray(result?.completedQuestIds) ? result.completedQuestIds : state.completed;
      
      // Since the server now accurately provides exactly the 3 random quests needed for a total of 90 XP,
      // and has already preserved the kept quests and replaced the target one, we can just use the results directly!
      setQuests(nextQuests);
      
      setState((prev) => ({
        ...prev,
        completed: nextCompleted,
        productivity: result?.productivity ?? prev.productivity,
        questSlots: result?.questSlots ?? prev.questSlots,
        pinnedQuestProgress21d: Array.isArray(result?.pinnedQuestProgress21d)
          ? normalizePinnedQuestProgress(result?.pinnedQuestProgress21d)
          : prev.pinnedQuestProgress21d,
        hasRerolledToday: result?.hasRerolledToday ?? prev.hasRerolledToday,
        extraRerollsToday: Number(result?.extraRerollsToday ?? result?.user?.extraRerollsToday ?? prev.extraRerollsToday),
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
    } catch (err) {
      trackEvent("quest_reroll_failed", { message: err?.message, targetQuestIds: selectedQuestIds });
      addLog(vocab?.rerollFailed || "Reroll failed. Please try again.", "text-red-400 font-bold");
    } finally {
      setRerollingQuestId(null);
    }
  }

  async function handleResetDaily() {
    if (!window.confirm(vocab?.resetDailyConfirm || "Reset daily quests? This will clear today's completed quests and give you a fresh set.")) return;
    try {
      // force: true — the explicit "Reset Day" user action always rotates,
      // unlike the auto-call on app mount which is idempotent per UTC day.
      const result = await resetDaily(resolvedUsername, false, [], [], [], true);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      setQuests(nextQuests);
      setState((prev) => ({
        ...prev,
        completed: [],
        productivity: result?.productivity ?? prev.productivity,
        questSlots: result?.questSlots ?? prev.questSlots,
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
      const result = await resetHard(resolvedUsername);
      if (typeof onServerTimeSync === "function") {
        onServerTimeSync(result);
      }
      const nextQuests = Array.isArray(result?.quests) ? result.quests.map(normalizeQuest) : [];
      setQuests(nextQuests);
      setState((prev) => ({
        lvl: 1,
        xp: 0,
        xpNext: 250,
        silver: 0,
        productivity: {
          xpToday: 0,
          tasksCompletedToday: 0,
          baseTasksCompletedToday: 0
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
        user: {
          ...prev.user,
          lastFreeTaskRerollAt: result?.user?.lastFreeTaskRerollAt ?? null
        },
        preferredQuestIds: Array.isArray(result?.preferredQuestIds) ? result.preferredQuestIds : prev.preferredQuestIds,
        pinnedQuestProgress21d: normalizePinnedQuestProgress(result?.pinnedQuestProgress21d)
      }));
      questRenderCountRef.current = 0;
    } catch {
      addLog(vocab?.hardResetFailed || "Hard reset failed. Please try again.", "text-red-400 font-bold");
    }
  }

    async function handleRerollPinned() {
    const isFree = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= FREE_PINNED_REROLL_INTERVAL_MS);
    if (!isFree && state.silver < 7) {
      addLog(vocab?.notEnoughSilverPinned || "Not enough silver to reroll pinned quests.", "text-red-400 font-bold");
      return;
    }
    
    setRerollingPinned(true);
    try {
      const result = await rerollPinned(authUser.uid, !isFree);
      trackEvent("pinned_quests_rerolled", { paid: !isFree, silver: result.silver });
      const costText = isFree ? (vocab?.freeLabel || "Free") : (vocab?.sevenSilver || "7 Silver");

      setQuests(Array.isArray(result.quests) ? result.quests.map(normalizeQuest) : []);
      setState(prev => ({
        ...prev,
        silver: result.silver,
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
    } finally {
      setRerollingPinned(false);
    }
  }


  // Coupon-based shop economy: buying a utility item creates a coupon
  // in user.couponInventory. The actual benefit (extraRerollsToday +=1
  // / streakFreezeCharges +=1 / xpBoostExpiresAt += 7d / city wipe)
  // happens when the user activates the coupon from inventory. So the
  // optimistic patch here only touches silver + couponInventory; the
  // benefit fields stay untouched until activation.
  async function handleBuyExtraReroll() {
    const resLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)));
    const discount = resLvl >= 5 ? 2 : resLvl >= 1 ? 1 : 0;
    const cost = Math.max(0, 3 - discount);
    setState((prev) => ({ ...prev, silver: Math.max(0, prev.silver - cost) }));
    try {
      const result = await buyExtraReroll(resolvedUsername);
      trackEvent("extra_reroll_purchased", { silver: result.silver });
      setState((prev) => ({
        ...prev,
        silver: result.silver,
        couponInventory: typeof result?.couponInventory === "string" ? result.couponInventory : prev.couponInventory,
        logs: [
          ...prev.logs,
          {
            msg: vocab?.couponPurchasedReroll || "🎫 Extra Reroll coupon added to inventory.",
            classes: "text-violet-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, silver: prev.silver + cost }));
      addLog(err?.message || vocab?.purchaseFailed || "Purchase failed. Please try again.", "text-red-400 font-bold");
    }
  }

  async function handleFreezeStreak() {
    if (freezeStreakPending) return;

    const prevSilver = state.silver;
    const resLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)));
    const discount = resLvl >= 5 ? 2 : resLvl >= 1 ? 1 : 0;
    const freezeCost = Math.max(0, 7 - discount);

    setFreezeStreakPending(true);
    setState((prev) => ({ ...prev, silver: Math.max(0, prev.silver - freezeCost) }));
    try {
      const result = await freezeStreak(resolvedUsername);
      trackEvent("streak_freeze_coupon_purchased", { silver: result.silver });
      setState((prev) => ({
        ...prev,
        silver: result.silver,
        couponInventory: typeof result?.couponInventory === "string" ? result.couponInventory : prev.couponInventory,
        user: {
          ...(prev.user || {}),
          lastFreezePurchaseWeekKey: result.lastFreezePurchaseWeekKey || prev.user?.lastFreezePurchaseWeekKey || ""
        },
        logs: [
          ...prev.logs,
          {
            msg: vocab?.couponPurchasedFreeze || "🎫 Streak Freeze coupon added to inventory.",
            classes: "text-cyan-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, silver: prevSilver }));
      addLog(err?.message || vocab?.purchaseFailed || "Purchase failed. Please try again.", "text-red-400 font-bold");
    } finally {
      setFreezeStreakPending(false);
    }
  }

  async function handleBuyXpBoost() {
    if (typeof buyXpBoost !== "function") return;
    const resLvl = Math.max(0, Math.min(5, Math.floor(Number(state.districtLevels?.[4]) || 0)));
    const discount = resLvl >= 5 ? 2 : resLvl >= 1 ? 1 : 0;
    const cost = Math.max(0, 15 - discount);
    const prevSilver = state.silver;
    setState((prev) => ({ ...prev, silver: Math.max(0, prev.silver - cost) }));
    try {
      const result = await buyXpBoost(resolvedUsername);
      trackEvent("xp_boost_coupon_purchased", { silver: result.silver });
      setState((prev) => ({
        ...prev,
        silver: result.silver,
        couponInventory: typeof result?.couponInventory === "string" ? result.couponInventory : prev.couponInventory,
        logs: [
          ...prev.logs,
          {
            msg: vocab?.couponPurchasedXpBoost || "🎫 XP Boost coupon added to inventory.",
            classes: "text-amber-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, silver: prevSilver }));
      addLog(err?.message || vocab?.purchaseFailed || "Purchase failed. Please try again.", "text-red-400 font-bold");
    }
  }

  return {
    floatingTexts,
    pendingQuestIds,
    addLog,
    completeQuest,
    doReroll,
    handleResetDaily,
    handleHardReset,
    handleRerollPinned,
    handleBuyExtraReroll,
    handleBuyXpBoost,
    handleFreezeStreak,
    freezeStreakPending,
    rerollingQuestId,
    rerollingPinned
  };
}

export default useGameplayActions;
