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
  windowStartAt = null,
  windowTicks = 0,
  cooldownMin = 15,
  maxInWindow = 3,
  isDone = false,
  pending = false,
  onTick,
  unitLabel
}) {
  const { t } = useTheme();
  const windowMs = Math.max(0, Number(cooldownMin) || 0) * 60_000;
  const [now, setNow] = useState(() => Date.now());

  const windowStartMs = windowStartAt ? new Date(windowStartAt).getTime() : 0;
  const windowEndsMs = windowStartMs ? windowStartMs + windowMs : 0;
  const windowOpen = windowStartMs > 0 && now < windowEndsMs;
  const windowFull = windowOpen && Number(windowTicks) >= Number(maxInWindow);
  const cooldownActive = windowFull && !isDone;
  const remainingMs = cooldownActive ? Math.max(0, windowEndsMs - now) : 0;

  useEffect(() => {
    if (!cooldownActive) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

  const safeTarget = Math.max(1, Number(target) || 1);
  const safeCount = Math.max(0, Math.min(safeTarget, Number(count) || 0));
  const percent = (safeCount / safeTarget) * 100;
  const unit = unitLabel || t.counterGlassUnit || "gl";
  const disabled = isDone || pending || cooldownActive || safeCount >= safeTarget;

  return (
    <div
      className="mt-3 pl-9 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-1.5">
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
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            onTick?.();
          }}
          className="mobile-pressable cinzel counter-tick-btn"
          style={{
            flex: 1,
            minHeight: 40,
            fontSize: 13,
            fontWeight: 800,
            padding: "9px 14px",
            borderRadius: 12,
            border: `1px solid ${disabled ? "rgba(148,163,184,0.35)" : "rgba(34,211,238,0.65)"}`,
            background: disabled
              ? "rgba(15,23,42,0.45)"
              : "linear-gradient(90deg, rgba(34,211,238,0.22), rgba(96,165,250,0.22))",
            color: disabled ? "var(--color-muted)" : "var(--color-text)",
            cursor: disabled ? "not-allowed" : "pointer",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow: disabled ? "none" : "0 4px 14px rgba(34,211,238,0.18)"
          }}
        >
          💧 +1 {unit}
        </button>
        {cooldownActive ? (
          <span
            className="font-mono"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-muted)",
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(148,163,184,0.08)",
              whiteSpace: "nowrap"
            }}
          >
            ⏳ {msToClock(remainingMs)}
          </span>
        ) : null}
      </div>
      {!isDone && safeCount < safeTarget ? (
        <p className="text-[11px] mt-2" style={{ color: "var(--color-muted)", lineHeight: 1.4 }}>
          {cooldownActive
            ? (t.counterCooldownActiveHint || "Window full — wait out the cooldown.")
            : (t.counterWindowHint || "Up to {max} per {min} min").replace("{max}", String(maxInWindow)).replace("{min}", String(cooldownMin))}
        </p>
      ) : null}
    </div>
  );
}
