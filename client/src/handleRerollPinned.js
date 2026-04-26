  async function handleRerollPinned(questId) {
    const isFree = !state.user?.lastFreeTaskRerollAt || (Date.now() - new Date(state.user.lastFreeTaskRerollAt).getTime() >= 30 * 24 * 60 * 60 * 1000);
    if (!isFree && state.silver < 5) {
      addLog("Not enough silver to swap pinned task.", "text-red-400 font-bold");
      return;
    }
    const costText = isFree ? "FREE (1/month)" : "5 TOKENS";
    if (!window.confirm(`Reroll this pinned task? Cost: ${costText}`)) return;

    try {
      const response = await fetch("http://localhost:4000/api/quests/reroll-pinned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUser.uid, questIdToReroll: questId, useSilver: !isFree })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setQuests(result.quests);
      setState(prev => ({
        ...prev,
        silver: result.silver,
        preferredQuestIds: result.preferredQuestIds,
        user: {
          ...prev.user,
          lastFreeTaskRerollAt: result.lastFreeTaskRerollAt || prev.user?.lastFreeTaskRerollAt
        },
        logs: [
          ...prev.logs,
          {
            msg: `⟳ Pinned task rerolled! (${costText})`,
            classes: "text-cyan-300 font-bold cinzel",
            timestamp: getTimestamp()
          }
        ]
      }));
    } catch (err) {
      addLog(err?.message || "Reroll pinned failed.", "text-red-400 font-bold");
    }
  }
