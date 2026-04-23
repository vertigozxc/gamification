import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";
import { variantLabel } from "../utils/questGrouping";

// Clean card per quest family. Tier picker uses a stepper (◀ / readout / ▶)
// so it always fits regardless of how many tiers the family has. The dots
// under the readout double as both a carousel indicator (where you are in
// the tier list) and the difficulty read (since tiers are effort-sorted).
// A second DifficultyDots row sits next to the title so the user sees the
// effort level of the currently-picked tier at a glance.

function DifficultyDots({ level = 0, max = 5 }) {
  const safeLevel = Math.max(0, Math.min(max, Math.floor(Number(level) || 0)));
  return (
    <span
      aria-label={`Difficulty ${safeLevel} of ${max}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 3 }}
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < safeLevel;
        return (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: filled ? "var(--color-primary)" : "rgba(148,163,184,0.28)",
              display: "inline-block",
              transition: "background 160ms ease"
            }}
          />
        );
      })}
    </span>
  );
}

export default function QuestGroupCard({
  group,
  selectedVariantId = null,
  disabled = false,
  onPick,
  onUnpick,
  translateCategory
}) {
  const { t } = useTheme();
  const variants = Array.isArray(group?.variants) ? group.variants : [];
  const representative = group?.representative || variants[0];

  const selectedInGroup = useMemo(
    () => variants.find((q) => Number(q.id) === Number(selectedVariantId)) || null,
    [variants, selectedVariantId]
  );

  const [activeId, setActiveId] = useState(() => {
    if (selectedInGroup) return selectedInGroup.id;
    // Default to the easiest tier so the card never previews something
    // above the user's level cap.
    return variants[0]?.id || null;
  });

  useEffect(() => {
    if (selectedInGroup && Number(activeId) !== Number(selectedInGroup.id)) {
      setActiveId(selectedInGroup.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInGroup?.id]);

  if (!representative) return null;

  const activeQuest = variants.find((q) => Number(q.id) === Number(activeId)) || representative;
  const activeIndex = Math.max(0, variants.findIndex((q) => Number(q.id) === Number(activeQuest.id)));
  const isSelected = Boolean(selectedInGroup);
  const showTierStrip = variants.length > 1;
  const categoryLabel = translateCategory ? translateCategory(activeQuest.category) : String(activeQuest.category || "").toUpperCase();
  const activeLabel = variantLabel(activeQuest, t) || representative.title;

  const handleCardToggle = () => {
    if (disabled && !isSelected) return;
    if (isSelected) {
      onUnpick?.(selectedInGroup.id);
    } else {
      onPick?.(activeQuest.id);
    }
  };

  const handleTierPick = (variantId) => {
    const target = variants.find((q) => Number(q.id) === Number(variantId));
    if (!target) return;
    setActiveId(target.id);
    if (isSelected && Number(selectedInGroup.id) !== Number(target.id)) {
      onUnpick?.(selectedInGroup.id);
      onPick?.(target.id);
    }
  };

  const stepTier = (delta) => {
    const nextIndex = Math.max(0, Math.min(variants.length - 1, activeIndex + delta));
    if (nextIndex === activeIndex) return;
    handleTierPick(variants[nextIndex].id);
  };

  return (
    <div
      style={{
        position: "relative",
        padding: 0,
        borderRadius: 16,
        border: `1px solid ${isSelected ? "var(--color-primary)" : "var(--card-border-idle)"}`,
        background: isSelected
          ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
          : "rgba(255,255,255,0.03)",
        transition: "border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
        opacity: disabled && !isSelected ? 0.5 : 1,
        overflow: "hidden",
        boxShadow: isSelected
          ? "0 0 18px color-mix(in srgb, var(--color-primary) 25%, transparent)"
          : "none"
      }}
    >
      {/* Top tap zone — picks/unpicks the whole family */}
      <button
        type="button"
        onClick={handleCardToggle}
        disabled={disabled && !isSelected}
        className="mobile-pressable"
        style={{
          width: "100%",
          padding: "14px 14px 12px",
          background: "transparent",
          border: "none",
          color: "inherit",
          textAlign: "left",
          cursor: (disabled && !isSelected) ? "not-allowed" : "pointer",
          display: "block"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h4
                className="cinzel"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: "0.02em"
                }}
              >
                {representative.title}
              </h4>
              <DifficultyDots level={activeQuest.effortScore} max={5} />
            </div>
            <span
              className="cinzel"
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-primary)",
                fontWeight: 700
              }}
            >
              {categoryLabel}
            </span>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--color-muted)",
                margin: "8px 0 0",
                lineHeight: 1.4
              }}
            >
              {activeQuest.desc || activeQuest.description || ""}
            </p>
          </div>

          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 26,
              height: 26,
              borderRadius: 999,
              border: `2px solid ${isSelected ? "var(--color-primary)" : "rgba(148,163,184,0.35)"}`,
              background: isSelected ? "var(--color-primary)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              fontSize: 13,
              fontWeight: 900,
              marginTop: 1
            }}
          >
            {isSelected ? "✓" : ""}
          </span>
        </div>
      </button>

      {/* Tier stepper — full-width, wide arrow wings, swipe to change */}
      {showTierStrip ? (
        <TierStepper
          variants={variants}
          activeIndex={activeIndex}
          activeLabel={activeLabel}
          onStep={stepTier}
          onPickIndex={(idx) => handleTierPick(variants[idx]?.id)}
          prevLabel={t.tierPickerPrev || "Previous difficulty"}
          nextLabel={t.tierPickerNext || "Next difficulty"}
        />
      ) : null}
    </div>
  );
}

function TierStepper({ variants, activeIndex, activeLabel, onStep, onPickIndex, prevLabel, nextLabel }) {
  const prevDisabled = activeIndex === 0;
  const nextDisabled = activeIndex === variants.length - 1;

  // Swipe gesture state. Horizontal pan on the readout area maps to
  // stepping through tiers — one step per ~50px travelled.
  const swipeState = useSwipeGesture(onStep);

  return (
    <div
      style={{ padding: "0 10px 12px", position: "relative", zIndex: 1 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 0,
          background: "transparent",
          border: "1px solid var(--card-border-idle)",
          borderRadius: 14,
          overflow: "hidden",
          minHeight: 52
        }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!prevDisabled) onStep?.(-1); }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={prevDisabled}
          aria-label={prevLabel}
          className="mobile-pressable tier-stepper-arrow"
          style={{
            flexShrink: 0,
            width: 56,
            border: "none",
            borderRight: "1px solid var(--card-border-idle)",
            background: prevDisabled ? "transparent" : "rgba(255,255,255,0.04)",
            color: prevDisabled ? "rgba(148,163,184,0.3)" : "var(--color-primary)",
            fontSize: 18,
            fontWeight: 700,
            cursor: prevDisabled ? "not-allowed" : "pointer",
            WebkitTapHighlightColor: "transparent",
            transition: "background 140ms ease, color 140ms ease"
          }}
        >
          ‹
        </button>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 10px",
            touchAction: "pan-y",
            userSelect: "none",
            cursor: "grab"
          }}
          onPointerDown={swipeState.onPointerDown}
          onPointerMove={swipeState.onPointerMove}
          onPointerUp={swipeState.onPointerUp}
          onPointerCancel={swipeState.onPointerUp}
        >
          <p
            className="cinzel"
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: "var(--color-text)",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%"
            }}
          >
            {activeLabel}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              marginTop: 6
            }}
            aria-label={`Tier ${activeIndex + 1} of ${variants.length}`}
          >
            {variants.map((variant, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPickIndex?.(i); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={`Tier ${i + 1}`}
                  className="tier-stepper-dot"
                  style={{
                    width: active ? 22 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: active ? "var(--color-primary)" : "rgba(148,163,184,0.4)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "width 180ms cubic-bezier(.2,.8,.2,1), background 160ms ease",
                    WebkitTapHighlightColor: "transparent"
                  }}
                />
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (!nextDisabled) onStep?.(1); }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={nextDisabled}
          aria-label={nextLabel}
          className="mobile-pressable tier-stepper-arrow"
          style={{
            flexShrink: 0,
            width: 56,
            border: "none",
            borderLeft: "1px solid var(--card-border-idle)",
            background: nextDisabled ? "transparent" : "rgba(255,255,255,0.04)",
            color: nextDisabled ? "rgba(148,163,184,0.3)" : "var(--color-primary)",
            fontSize: 18,
            fontWeight: 700,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            WebkitTapHighlightColor: "transparent",
            transition: "background 140ms ease, color 140ms ease"
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// Horizontal-only swipe, 1 step per ~50px travelled while held. Left-swipe
// advances to the next tier (feels like dragging the current pill out to
// expose the one on the right), right-swipe retreats.
function useSwipeGesture(onStep) {
  const state = useRef({ active: false, startX: 0, startY: 0, consumed: 0, stepPx: 50, lockedAxis: null });

  const onPointerDown = (e) => {
    state.current.active = true;
    state.current.startX = e.clientX;
    state.current.startY = e.clientY;
    state.current.consumed = 0;
    state.current.lockedAxis = null;
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  };
  const onPointerMove = (e) => {
    if (!state.current.active) return;
    const totalX = e.clientX - state.current.startX;
    const totalY = e.clientY - state.current.startY;
    if (state.current.lockedAxis == null) {
      if (Math.abs(totalX) < 6 && Math.abs(totalY) < 6) return;
      state.current.lockedAxis = Math.abs(totalX) > Math.abs(totalY) ? "x" : "y";
    }
    if (state.current.lockedAxis !== "x") return;
    const dx = totalX - state.current.consumed;
    while (Math.abs(dx) >= state.current.stepPx) {
      const sign = Math.sign(dx);
      // Drag right (positive dx) → previous tier.
      onStep?.(-sign);
      state.current.consumed += sign * state.current.stepPx;
      const remaining = e.clientX - state.current.startX - state.current.consumed;
      if (Math.abs(remaining) < state.current.stepPx) break;
    }
  };
  const onPointerUp = () => {
    state.current.active = false;
    state.current.lockedAxis = null;
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
