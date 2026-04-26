import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { citySpin } from "../api";
import { IconClose } from "./icons/Icons";

const REWARDS = [
  { id: 1,  type: "xp",    amount: 25,  emoji: "✨", darkText: false },
  { id: 2,  type: "silver", amount: 1,   emoji: "🪙", darkText: true  },
  { id: 3,  type: "silver", amount: 3,   emoji: "🪙", darkText: false },
  { id: 4,  type: "xp",    amount: 50,  emoji: "⭐", darkText: false },
  { id: 5,  type: "xp",    amount: 75,  emoji: "💫", darkText: false },
  { id: 6,  type: "xp",    amount: 100, emoji: "💎", darkText: false },
  { id: 7,  type: "silver", amount: 5,   emoji: "🪙", darkText: false },
  { id: 8,  type: "silver", amount: 10,  emoji: "🪙", darkText: false },
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
// SVG viewBox is 340×340; the wheel element itself scales responsively
// inside the modal card via CSS aspect-ratio.
const CX = 170, CY = 170, R = 158, R_TEXT = 115;

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
  // Silver segments already show 🪙 as the emoji above the label — don't
  // duplicate the coin in the number itself. XP shows the unit, level is
  // a one-off string.
  if (r.type === "xp") return `+${r.amount} XP`;
  if (r.type === "silver") return `+${r.amount}`;
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
  const [phase, setPhase] = useState("idle"); // idle | loading | spinning | result | cooldown
  const [rotation, setRotation] = useState(0);
  const [spinResult, setSpinResult] = useState(null);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

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
    if (!username) {
      setError(t.spinNoProfile || "Profile is not ready yet. Please try again.");
      return;
    }
    setPhase("loading");
    setError(null);
    try {
      const result = await citySpin(username);

      if (!result.ok) {
        setSpinResult(result);
        setPhase("cooldown");
        return;
      }

      // Calculate final wheel rotation to land on winning segment
      const rewardIndex = result.reward.id - 1;
      const segCenter = rewardIndex * SEG_DEG + SEG_DEG / 2;
      const EXTRA_SPINS = 5;
      const finalRot = EXTRA_SPINS * 360 - segCenter;

      setSpinResult(result);
      setRotation(finalRot);
      setPhase("spinning");

      // Notify the parent immediately so the user's silver/xp/level in the
      // header update in sync with the wheel result — the reward has already
      // been applied server-side, even if the user closes the modal mid-anim.
      onRewardClaimed?.(result);

      setTimeout(() => setPhase("result"), SPIN_DURATION_MS + 200);
    } catch (e) {
      setPhase("idle");
      setError(e?.message || t.spinNetworkError || "Request failed. Please try again.");
    }
  }, [phase, t.spinNetworkError, t.spinNoProfile, username, onRewardClaimed]);

  if (!open) return null;

  const wonReward = spinResult?.reward ? REWARDS.find(r => r.id === spinResult.reward.id) : null;

  return createPortal(
    <div
      className="logout-confirm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.spinTitle || "CITY FORTUNE"}
    >
      <div
        className="logout-confirm-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          borderColor: "color-mix(in srgb, var(--color-primary) 55%, transparent)",
          boxShadow: "0 0 40px rgba(167,139,250,0.2), 0 25px 50px rgba(0, 0, 0, 0.6)",
          padding: "1.5rem 1.25rem 1.25rem",
          position: "relative"
        }}
      >
        {/* Close X */}
        <button
          type="button"
          aria-label={t.closeLabel || "Close"}
          onClick={onClose}
          className="ui-close-x"
          style={{ position: "absolute", top: 12, right: 12 }}
        >
          <IconClose size={16} strokeWidth={2.4} />
        </button>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <h2
            className="cinzel"
            style={{
              color: "var(--color-primary, #a78bfa)",
              fontSize: 22,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "0.06em",
              textShadow: "0 0 20px var(--color-primary, #a78bfa)"
            }}
          >
            {t.spinTitle || "CITY FORTUNE"}
          </h2>
          <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>
            {t.spinSubtitle || "Spin to win daily rewards!"}
          </p>
        </div>

        {/* Wheel stage: fixed aspect ratio so clicking the Spin button
            never causes layout shift, responsive so the wheel never
            overflows the card on narrow phones. */}
        <div style={{
          position: "relative",
          width: "min(100%, 340px)",
          aspectRatio: "1 / 1",
          margin: "0 auto 16px"
        }}>
          {/* Pointer arrow at top */}
          <div style={{
            position: "absolute", top: -16, left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "12px solid transparent",
            borderRight: "12px solid transparent",
            borderTop: "24px solid var(--color-primary, #a78bfa)",
            zIndex: 10,
            filter: "drop-shadow(0 0 8px var(--color-primary, #a78bfa))"
          }} />

          {/* Spinning wheel */}
          <div
            style={{
              width: "100%", height: "100%",
              transform: `rotate(${rotation}deg)`,
              transition: phase === "spinning"
                ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                : "none",
              willChange: "transform"
            }}
          >
            <svg viewBox="0 0 340 340" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
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
                      x={x} y={y - 10}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="19"
                      transform={`rotate(${rotate}, ${x}, ${y})`}
                      style={{ userSelect: "none" }}
                    >{r.emoji}</text>
                    <text
                      x={x} y={y + 12}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={r.darkText ? "#1a1a1a" : "#ffffff"}
                      transform={`rotate(${rotate}, ${x}, ${y})`}
                      style={{ userSelect: "none" }}
                    >{rewardLabel(r)}</text>
                  </g>
                );
              })}
              {/* Center cap */}
              <circle cx={CX} cy={CY} r={22} fill="#0f172a" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
              <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="16" style={{ userSelect: "none" }}>🎆</text>
            </svg>
          </div>

          {/* Outer glow ring */}
          <div style={{
            position: "absolute", inset: -3,
            border: "3px solid var(--color-primary, #a78bfa)",
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow: "0 0 24px var(--color-primary, #a78bfa), 0 0 60px rgba(167,139,250,0.2)"
          }} />
        </div>

        {/* Result banner — rendered in-flow below the wheel so the wheel
            never shifts when it appears. */}
        {phase === "result" && spinResult && wonReward && (
          <div
            style={{
              margin: "0 4px 14px",
              padding: "14px 16px",
              background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(192,132,252,0.08))",
              border: "1.5px solid var(--color-primary, #a78bfa)",
              borderRadius: 16,
              textAlign: "center",
              boxShadow: "0 0 24px rgba(167,139,250,0.22)",
              animation: "spin-result-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both"
            }}
          >
            <style>{`
              @keyframes spin-result-in {
                from { transform: translateY(12px) scale(0.96); opacity: 0; }
                to   { transform: translateY(0)    scale(1);    opacity: 1; }
              }
            `}</style>
            {/* Big reward emoji above the "You won!" label — skipped for
                silver rewards because the 🪙 character is already present
                in the amount line below and duplicating it reads as
                cluttered. XP and level rewards keep the emoji since
                their amount line doesn't carry it. */}
            {spinResult.reward.type !== "silver" && (
              <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 4 }}>{wonReward.emoji}</div>
            )}
            <p className="cinzel" style={{
              color: "var(--color-primary, #a78bfa)",
              fontSize: 14,
              margin: "0 0 2px",
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}>
              {t.spinWinTitle || "You won!"}
            </p>
            <p style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 900, margin: 0 }}>
              {spinResult.reward.type === "xp"
                ? `+${spinResult.reward.amount} XP`
                : spinResult.reward.type === "silver"
                  ? `+${spinResult.reward.amount} 🪙`
                  : "+1 LEVEL 🎉"}
            </p>
          </div>
        )}

        {/* Cooldown state */}
        {phase === "cooldown" && spinResult && (
          <div style={{
            margin: "0 4px 14px",
            padding: "14px 16px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 30, marginBottom: 4 }}>⏳</div>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 2px" }}>
              {t.spinAlreadyUsed || "Already spun today!"}
            </p>
            <p style={{
              color: "var(--color-primary, #a78bfa)",
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              fontVariantNumeric: "tabular-nums"
            }}>
              {timeLeft !== null ? msToHMS(timeLeft) : "—"}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", margin: "0 0 10px" }}>{error}</p>
        )}

        {/* Bottom action slot — fixed min-height so the popup card doesn't
            visibly shrink when we swap the SPIN button for the tiny
            "Spinning…" label mid-animation. Without this the card
            collapsed by ~30 px right as the wheel started moving, which
            read as a glitch. */}
        {phase === "idle" || phase === "loading" ? (
          <button
            type="button"
            onClick={handleSpin}
            disabled={phase !== "idle"}
            className="cinzel mobile-pressable"
            style={{
              width: "100%",
              padding: "14px 20px",
              minHeight: 52,
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: "0.15em",
              color: "#0f172a",
              background: phase === "idle"
                ? "linear-gradient(135deg, var(--color-primary, #a78bfa), #c084fc)"
                : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 14,
              cursor: phase === "idle" ? "pointer" : "default",
              boxShadow: phase === "idle" ? "0 0 24px rgba(167,139,250,0.45)" : "none",
              transition: "background 0.3s ease, box-shadow 0.3s ease"
            }}
          >
            {phase === "idle" ? (t.spinButtonLabel || "🎰 SPIN!") : "⏳"}
          </button>
        ) : phase === "spinning" ? (
          <div
            className="cinzel"
            style={{
              width: "100%",
              padding: "14px 20px",
              minHeight: 52,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "#94a3b8",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 14,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box"
            }}
          >
            {t.spinSpinning || "Spinning..."}
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="cinzel mobile-pressable"
            style={{
              width: "100%",
              padding: "14px 20px",
              minHeight: 52,
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: "0.15em",
              color: "#0f172a",
              background: "linear-gradient(135deg, var(--color-primary, #a78bfa), #c084fc)",
              border: "none",
              borderRadius: 14,
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(167,139,250,0.45)"
            }}
          >
            {t.closeLabel || "Close"}
          </button>
        )}

        {phase === "result" && spinResult?.nextSpinAt && (
          <p style={{ color: "#475569", fontSize: 11, textAlign: "center", marginTop: 8 }}>
            {t.spinNextReset || "Next spin available later — check back!"}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
