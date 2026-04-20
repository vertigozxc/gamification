import { useCallback, useEffect, useState } from "react";
import { citySpin } from "../api";

const REWARDS = [
  { id: 1,  type: "xp",    amount: 10,  emoji: "✨", darkText: false },
  { id: 2,  type: "token", amount: 1,   emoji: "🪙", darkText: true  },
  { id: 3,  type: "token", amount: 3,   emoji: "🪙", darkText: false },
  { id: 4,  type: "xp",    amount: 20,  emoji: "⭐", darkText: false },
  { id: 5,  type: "xp",    amount: 50,  emoji: "💫", darkText: false },
  { id: 6,  type: "xp",    amount: 100, emoji: "💎", darkText: false },
  { id: 7,  type: "token", amount: 5,   emoji: "🪙", darkText: false },
  { id: 8,  type: "token", amount: 10,  emoji: "🪙", darkText: false },
  { id: 9,  type: "xp",    amount: 300, emoji: "🌟", darkText: true  },
  { id: 10, type: "level", amount: 1,   emoji: "👑", darkText: false },
];

const SEG_COLORS = [
  "#22c55e", "#eab308", "#f97316", "#06b6d4",
  "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f59e0b", "#ef4444",
];

const SEG_COUNT = REWARDS.length;
const SEG_DEG = 360 / SEG_COUNT; // 36°
const CX = 150, CY = 150, R = 138, R_TEXT = 100;

function toRad(deg) { return (deg * Math.PI) / 180; }

function segPath(i) {
  const start = i * SEG_DEG;
  const end = start + SEG_DEG;
  const x1 = CX + R * Math.sin(toRad(start));
  const y1 = CY - R * Math.cos(toRad(start));
  const x2 = CX + R * Math.sin(toRad(end));
  const y2 = CY - R * Math.cos(toRad(end));
  return `M${CX},${CY} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z`;
}

function textPos(i) {
  const angleDeg = i * SEG_DEG + SEG_DEG / 2;
  return {
    x: CX + R_TEXT * Math.sin(toRad(angleDeg)),
    y: CY - R_TEXT * Math.cos(toRad(angleDeg)),
    rotate: angleDeg,
  };
}

function rewardLabel(r) {
  if (r.type === "xp") return `+${r.amount} XP`;
  if (r.type === "token") return `+${r.amount}🪙`;
  return "+1 LVL";
}

function msToHMS(ms) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

const SPIN_DURATION_MS = 5200;

export default function SpinWheelModal({ open, username, t, onClose, onRewardClaimed }) {
  const [phase, setPhase] = useState("idle"); // idle | loading | spinning | result
  const [rotation, setRotation] = useState(0);
  const [spinResult, setSpinResult] = useState(null);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null); // ms until next spin

  // Reset when opened
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setRotation(0);
      setSpinResult(null);
      setError(null);
      setTimeLeft(null);
    }
  }, [open]);

  // Countdown timer for next spin
  useEffect(() => {
    if (!open || !spinResult?.nextSpinAt) return;
    const tick = () => {
      const ms = new Date(spinResult.nextSpinAt) - Date.now();
      setTimeLeft(Math.max(0, ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, spinResult]);

  const handleSpin = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("loading");
    setError(null);
    try {
      const result = await citySpin(username);

      if (!result.ok) {
        // Already spun today
        setSpinResult(result);
        setPhase("cooldown");
        return;
      }

      // Calculate final wheel rotation to land on winning segment
      const rewardIndex = result.reward.id - 1;
      const segCenter = rewardIndex * SEG_DEG + SEG_DEG / 2;
      const EXTRA_SPINS = 5;
      const finalRot = EXTRA_SPINS * 360 + segCenter;

      setSpinResult(result);
      setRotation(finalRot);
      setPhase("spinning");

      setTimeout(() => setPhase("result"), SPIN_DURATION_MS + 300);
    } catch {
      setPhase("idle");
      setError("Network error. Please try again.");
    }
  }, [phase, username]);

  if (!open) return null;

  const wonReward = spinResult?.reward ? REWARDS.find(r => r.id === spinResult.reward.id) : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(2, 6, 23, 0.95)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 18, right: 18,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#94a3b8", fontSize: 16, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >✕</button>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{
          color: "var(--color-primary, #a78bfa)",
          fontFamily: "Cinzel, Georgia, serif",
          fontSize: 22, fontWeight: 900,
          margin: 0, letterSpacing: "0.06em",
          textShadow: "0 0 20px var(--color-primary, #a78bfa)",
        }}>
          {t.spinTitle || "CITY FORTUNE"}
        </h2>
        <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>
          {t.spinSubtitle || "Spin to win daily rewards!"}
        </p>
      </div>

      {/* Wheel */}
      <div style={{ position: "relative", marginBottom: 24 }}>
        {/* Pointer arrow at top */}
        <div style={{
          position: "absolute", top: -14, left: "50%",
          transform: "translateX(-50%)",
          width: 0, height: 0,
          borderLeft: "11px solid transparent",
          borderRight: "11px solid transparent",
          borderTop: "22px solid var(--color-primary, #a78bfa)",
          zIndex: 10,
          filter: "drop-shadow(0 0 8px var(--color-primary, #a78bfa))",
        }} />

        {/* Spinning wheel */}
        <div
          style={{
            width: 300, height: 300,
            transform: `rotate(${rotation}deg)`,
            transition: phase === "spinning"
              ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
              : "none",
            willChange: "transform",
          }}
        >
          <svg viewBox="0 0 300 300" width="300" height="300">
            {REWARDS.map((r, i) => {
              const { x, y, rotate } = textPos(i);
              return (
                <g key={r.id}>
                  <path
                    d={segPath(i)}
                    fill={SEG_COLORS[i]}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x} y={y - 9}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="17"
                    transform={`rotate(${rotate}, ${x}, ${y})`}
                    style={{ userSelect: "none" }}
                  >{r.emoji}</text>
                  <text
                    x={x} y={y + 11}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill={r.darkText ? "#1a1a1a" : "#ffffff"}
                    transform={`rotate(${rotate}, ${x}, ${y})`}
                    style={{ userSelect: "none" }}
                  >{rewardLabel(r)}</text>
                </g>
              );
            })}
            {/* Center cap */}
            <circle cx={CX} cy={CY} r={20} fill="#0f172a" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="14" style={{ userSelect: "none" }}>🎆</text>
          </svg>
        </div>

        {/* Outer glow ring */}
        <div style={{
          position: "absolute", inset: -3,
          border: "3px solid var(--color-primary, #a78bfa)",
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: "0 0 24px var(--color-primary, #a78bfa), 0 0 60px rgba(167,139,250,0.2)",
        }} />
      </div>

      {/* Spin button (idle & loading states) */}
      {(phase === "idle" || phase === "loading") && (
        <button
          onClick={handleSpin}
          disabled={phase !== "idle"}
          style={{
            padding: "15px 52px",
            fontSize: 18, fontWeight: 900,
            fontFamily: "Cinzel, Georgia, serif",
            letterSpacing: "0.15em",
            color: "#0f172a",
            background: phase === "idle"
              ? "linear-gradient(135deg, var(--color-primary, #a78bfa), #c084fc)"
              : "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 16,
            cursor: phase === "idle" ? "pointer" : "default",
            boxShadow: phase === "idle" ? "0 0 28px rgba(167,139,250,0.5)" : "none",
            transition: "all 0.3s ease",
            minWidth: 160,
          }}
        >
          {phase === "idle" ? (t.spinButtonLabel || "🎰 SPIN!") : "⏳"}
        </button>
      )}

      {/* Spinning status */}
      {phase === "spinning" && (
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, letterSpacing: "0.1em" }}>
          {t.spinSpinning || "Spinning..."}
        </p>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "#f87171", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</p>
      )}

      {/* Already spun cooldown */}
      {phase === "cooldown" && spinResult && (
        <div style={{
          marginTop: 8, textAlign: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14, padding: "16px 24px",
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 4px" }}>
            {t.spinAlreadyUsed || "Already spun today!"}
          </p>
          <p style={{ color: "var(--color-primary, #a78bfa)", fontSize: 20, fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>
            {timeLeft !== null ? msToHMS(timeLeft) : "—"}
          </p>
          <p style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>
            {t.spinNextReset || "Resets at midnight (UTC)"}
          </p>
        </div>
      )}

      {/* Result popup */}
      {phase === "result" && spinResult && wonReward && (
        <div
          style={{
            position: "absolute",
            bottom: 32, left: 16, right: 16,
            background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))",
            border: "1.5px solid var(--color-primary, #a78bfa)",
            borderRadius: 22,
            padding: "28px 24px 20px",
            textAlign: "center",
            boxShadow: "0 0 40px rgba(167,139,250,0.35), 0 24px 60px rgba(0,0,0,0.6)",
            animation: "spin-result-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <style>{`
            @keyframes spin-result-in {
              from { transform: translateY(40px) scale(0.9); opacity: 0; }
              to   { transform: translateY(0)    scale(1);   opacity: 1; }
            }
          `}</style>

          <div style={{ fontSize: 52, marginBottom: 6, lineHeight: 1 }}>{wonReward.emoji}</div>
          <h3 style={{
            color: "var(--color-primary, #a78bfa)",
            fontFamily: "Cinzel, Georgia, serif",
            fontSize: 18, margin: "0 0 6px",
          }}>
            {t.spinWinTitle || "You won!"}
          </h3>
          <p style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 900, margin: "0 0 18px" }}>
            {spinResult.reward.type === "xp"
              ? `+${spinResult.reward.amount} XP`
              : spinResult.reward.type === "token"
                ? `+${spinResult.reward.amount} 🪙`
                : "+1 LEVEL! 🎉"}
          </p>

          <button
            onClick={() => { onRewardClaimed?.(spinResult); onClose(); }}
            style={{
              padding: "13px 40px",
              background: "linear-gradient(135deg, var(--color-primary, #a78bfa), #c084fc)",
              border: "none", borderRadius: 14,
              color: "#0f172a", fontSize: 16, fontWeight: 900,
              cursor: "pointer", width: "100%",
              boxShadow: "0 0 20px rgba(167,139,250,0.4)",
            }}
          >
            {t.spinClose || "Claim! 🎉"}
          </button>

          {spinResult.nextSpinAt && (
            <p style={{ color: "#475569", fontSize: 11, marginTop: 12 }}>
              {t.spinNextReset || "Next spin resets at midnight (UTC)"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
