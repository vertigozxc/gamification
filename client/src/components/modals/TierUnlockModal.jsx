import { useEffect } from "react";
import { useTheme } from "../../ThemeContext";

// Mandatory tier-progression popup. Fires when a quest completion
// crossed a level / streak boundary that changed the user's slot mix
// or difficulty cap. Server (server/src/index.js → awardQuestCompletion)
// computes the diff and ships it back as `tierUnlock`; the client
// simply renders the rows that actually changed.
//
// Interaction: no click-outside dismiss, no Escape — the player must
// acknowledge by tapping the primary button. Reasoning: the unlock
// changes how the daily board looks and what difficulty appears, so
// a player ignoring it would be confused tomorrow when their board
// suddenly has more slots.
function TierUnlockModal({ tier, onAcknowledge }) {
  const { t } = useTheme();
  useEffect(() => {
    if (!tier || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [tier]);

  if (!tier) return null;
  const diff = tier.diff || {};
  const fill = (template, vars) =>
    String(template).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));

  const lines = [];
  if (Number(diff.pinned) > 0) {
    lines.push({
      icon: "📌",
      text: fill(
        t.tierUnlockPinnedSlots || "+{count} pinned habit slot — keep more habits running daily.",
        { count: diff.pinned }
      )
    });
  }
  if (Number(diff.random) > 0) {
    lines.push({
      icon: "🎲",
      text: fill(
        t.tierUnlockRandomSlots || "+{count} daily quest — bigger board, more XP per day.",
        { count: diff.random }
      )
    });
  }
  if (Number(diff.maxEffort) > 0) {
    if (tier.current && tier.current.maxEffort >= 5) {
      lines.push({
        icon: "🔥",
        text: t.tierUnlockEffort5 || "Maximum-difficulty quests (effort 5) now appear in your pool — biggest XP rewards in the game."
      });
    } else {
      lines.push({
        icon: "⚔️",
        text: fill(
          t.tierUnlockHigherDifficulty || "Harder quests unlocked — difficulty cap raised to {level}.",
          { level: tier.current?.maxEffort || diff.maxEffort }
        )
      });
    }
  }

  // Headline: prefer streak-driven framing when only effort changed and
  // the level didn't move; otherwise use the level milestone.
  const onlyEffortChanged = !Number(diff.pinned) && !Number(diff.random) && Number(diff.maxEffort) > 0;
  const headline = onlyEffortChanged
    ? fill(
        t.tierUnlockHeadlineStreak || "Streak {streak}",
        { streak: tier.reachedStreak || 0 }
      )
    : fill(
        t.tierUnlockHeadlineLevel || "Level {level}",
        { level: tier.reachedLevel || 0 }
      );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mobile-card"
        style={{
          background: "var(--card-bg, var(--panel-bg))",
          border: "1px solid color-mix(in srgb, var(--color-primary) 60%, transparent)",
          borderRadius: 22,
          padding: "22px 22px 20px",
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 0 50px color-mix(in srgb, var(--color-primary) 35%, transparent), 0 25px 50px rgba(0,0,0,0.55)"
        }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              background: "color-mix(in srgb, var(--color-primary) 22%, transparent)",
              border: "2px solid color-mix(in srgb, var(--color-primary) 65%, transparent)",
              boxShadow: "0 0 26px color-mix(in srgb, var(--color-primary) 45%, transparent)",
              marginBottom: 4
            }}
            aria-hidden="true"
          >
            🌟
          </div>
          <span
            className="cinzel"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              fontWeight: 700
            }}
          >
            {t.tierUnlockKicker || "New stage unlocked"}
          </span>
          <h2
            className="cinzel"
            style={{
              color: "var(--color-primary)",
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase"
            }}
          >
            {headline}
          </h2>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--color-text)",
            textAlign: "center",
            opacity: 0.85
          }}
        >
          {t.tierUnlockBody || "You just unlocked a new progression stage. Here's what's new:"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)"
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.1 }} aria-hidden="true">{line.icon}</span>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: "var(--color-text)", fontWeight: 600 }}>
                {line.text}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          className="mobile-pressable cinzel"
          style={{
            marginTop: 4,
            padding: "13px 18px",
            borderRadius: 999,
            border: "1.5px solid color-mix(in srgb, var(--color-primary) 70%, transparent)",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 35%, transparent), color-mix(in srgb, var(--color-primary) 22%, transparent))",
            color: "var(--color-primary)",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: "0 6px 22px color-mix(in srgb, var(--color-primary) 28%, transparent)"
          }}
        >
          {t.tierUnlockAck || "Got it"}
        </button>
      </div>
    </div>
  );
}

export default TierUnlockModal;
