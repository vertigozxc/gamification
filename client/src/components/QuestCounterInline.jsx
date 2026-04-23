import { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext";

function msToClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function QuestCounterInline({
  quest,
  count = 0,
  target = 1,
  lastTickAt = null,
  cooldownMin = 15,
  maxPerTick = 3,
  isDone = false,
  pending = false,
  onTick,
  unitLabel
}) {
  const { t } = useTheme();
  const cooldownMs = Math.max(0, Number(cooldownMin) || 0) * 60_000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastTickAt || cooldownMs <= 0) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastTickAt, cooldownMs]);

  const lastMs = lastTickAt ? new Date(lastTickAt).getTime() : 0;
  const remainingMs = lastMs && cooldownMs > 0 ? Math.max(0, lastMs + cooldownMs - now) : 0;
  const cooldownActive = remainingMs > 0 && !isDone;
  const safeTarget = Math.max(1, Number(target) || 1);
  const safeCount = Math.max(0, Math.min(safeTarget, Number(count) || 0));
  const percent = (safeCount / safeTarget) * 100;
  const unit = unitLabel || t.counterGlassUnit || "glass";

  return (
    <div
      className="mt-3 pl-9 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] cinzel tracking-wider uppercase" style={{ color: "var(--color-primary)" }}>
          {t.counterProgressLabel || "Progress"}
        </span>
        <span className="cinzel text-xs font-bold" style={{ color: "var(--color-text)" }}>
          {safeCount}/{safeTarget} {unit}
        </span>
      </div>
      <div className="qb-progress-track">
        <div
          className="qb-progress-fill"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, #60a5fa, #22d3ee)"
          }}
        />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {[1, 2, 3].slice(0, Math.max(1, Math.min(3, Number(maxPerTick) || 1))).map((delta) => {
          const wouldOverflow = safeCount + delta > safeTarget && safeCount + 1 <= safeTarget;
          const disabled = isDone || pending || cooldownActive || safeCount >= safeTarget || (delta > 1 && safeCount + delta > safeTarget && safeCount + 1 <= safeTarget && false);
          const clampedDelta = Math.min(delta, safeTarget - safeCount);
          const actuallyDisabled = isDone || pending || cooldownActive || clampedDelta < delta;
          return (
            <button
              key={delta}
              type="button"
              disabled={actuallyDisabled}
              onClick={(e) => {
                e.stopPropagation();
                if (actuallyDisabled) return;
                onTick?.(delta);
              }}
              className="mobile-pressable"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 10,
                border: `1px solid ${actuallyDisabled ? "rgba(148,163,184,0.35)" : "rgba(34,211,238,0.55)"}`,
                background: actuallyDisabled ? "rgba(15,23,42,0.45)" : "rgba(34,211,238,0.12)",
                color: actuallyDisabled ? "var(--color-muted)" : "var(--color-text)",
                cursor: actuallyDisabled ? "not-allowed" : "pointer",
                letterSpacing: "0.02em"
              }}
            >
              +{delta} 💧
            </button>
          );
        })}
        {cooldownActive ? (
          <span className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>
            ⏳ {msToClock(remainingMs)}
          </span>
        ) : !isDone && safeCount < safeTarget ? (
          <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            {(t.counterCooldownHint || "Cooldown {min} min between sips").replace("{min}", String(cooldownMin))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
