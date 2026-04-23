import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { variantLabel } from "../utils/questGrouping";

// Clean card per quest family. Tier picker uses a stepper (◀ / readout / ▶)
// so it always fits regardless of how many tiers the family has. The dots
// under the readout double as both a carousel indicator (where you are in
// the tier list) and the difficulty read (since tiers are effort-sorted).

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
  const activeLabel = variantLabel(activeQuest) || representative.title;

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
        background: isSelected ? "var(--color-accent-dim, rgba(250,204,21,0.06))" : "rgba(255,255,255,0.03)",
        transition: "border-color 180ms ease, background 180ms ease, box-shadow 180ms ease",
        opacity: disabled && !isSelected ? 0.5 : 1,
        overflow: "hidden",
        boxShadow: isSelected ? "0 0 18px rgba(250,204,21,0.08)" : "none"
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

      {/* Tier stepper — always fits, scales to any number of tiers */}
      {showTierStrip ? (
        <div
          style={{ padding: "0 10px 12px", position: "relative", zIndex: 1 }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 6px",
              background: "rgba(0,0,0,0.28)",
              border: "1px solid var(--card-border-idle)",
              borderRadius: 12
            }}
          >
            <StepperArrow
              direction="left"
              disabled={activeIndex === 0}
              onClick={() => stepTier(-1)}
              ariaLabel={t.tierPickerPrev || "Previous difficulty"}
            />
            <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
              <p
                className="cinzel"
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--color-text)",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {activeLabel}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  aria-label={`Tier ${activeIndex + 1} of ${variants.length}`}
                >
                  {variants.map((variant, i) => {
                    const active = i === activeIndex;
                    const effort = Math.max(1, Math.min(5, Number(variant.effortScore) || 1));
                    // Each dot's size scales with its own difficulty so the
                    // row doubles as a compact difficulty read — easy tier
                    // = small dot, hardest = noticeably bigger.
                    const size = 4 + effort;
                    return (
                      <span
                        key={variant.id}
                        style={{
                          width: size,
                          height: size,
                          borderRadius: 999,
                          background: active ? "var(--color-primary)" : "rgba(148,163,184,0.35)",
                          display: "inline-block",
                          transition: "background 160ms ease, transform 160ms ease",
                          transform: active ? "scale(1.15)" : "scale(1)"
                        }}
                      />
                    );
                  })}
                </span>
                <span
                  className="cinzel"
                  style={{
                    fontSize: 10,
                    color: "var(--color-muted)",
                    letterSpacing: "0.08em",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  {activeIndex + 1}/{variants.length}
                </span>
              </div>
            </div>
            <StepperArrow
              direction="right"
              disabled={activeIndex === variants.length - 1}
              onClick={() => stepTier(1)}
              ariaLabel={t.tierPickerNext || "Next difficulty"}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepperArrow({ direction = "left", disabled = false, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={disabled}
      aria-label={ariaLabel}
      className="mobile-pressable"
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid var(--card-border-idle)",
        background: disabled ? "transparent" : "rgba(255,255,255,0.05)",
        color: disabled ? "rgba(148,163,184,0.35)" : "var(--color-text)",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        WebkitTapHighlightColor: "transparent"
      }}
    >
      {direction === "left" ? "◀" : "▶"}
    </button>
  );
}
