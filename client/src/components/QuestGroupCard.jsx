import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { variantLabel } from "../utils/questGrouping";

// Clean card per quest family. The whole top zone is the select target.
// The tier row sits inside the card as an iOS-style segmented control —
// no native dropdown, no chip glitter, just a quiet strip where the
// active segment has a solid pill behind it.

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
              width: 5,
              height: 5,
              borderRadius: 999,
              background: filled ? "var(--color-primary)" : "rgba(148,163,184,0.3)",
              display: "inline-block"
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
  const isSelected = Boolean(selectedInGroup);
  const showTierStrip = variants.length > 1;
  const categoryLabel = translateCategory ? translateCategory(activeQuest.category) : String(activeQuest.category || "").toUpperCase();

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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
                flexWrap: "wrap"
              }}
            >
              <span
                className="cinzel"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-primary)",
                  fontWeight: 700
                }}
              >
                {categoryLabel}
              </span>
              <span style={{ color: "var(--card-border-idle)", fontSize: 10 }}>·</span>
              <DifficultyDots level={activeQuest.effortScore} max={5} />
            </div>
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

      {/* Segmented tier control */}
      {showTierStrip ? (
        <div
          style={{
            padding: "0 10px 10px",
            position: "relative",
            zIndex: 1
          }}
        >
          <div
            role="tablist"
            aria-label={t.tierPickerLabel || "Difficulty"}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${variants.length}, minmax(0, 1fr))`,
              gap: 2,
              padding: 3,
              background: "rgba(0,0,0,0.28)",
              border: "1px solid var(--card-border-idle)",
              borderRadius: 12
            }}
          >
            {variants.map((variant) => {
              const active = Number(variant.id) === Number(activeId);
              const label = variantLabel(variant) || (t.tierPickerFallback || "Tier");
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTierPick(variant.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="cinzel"
                  style={{
                    minHeight: 34,
                    padding: "4px 6px",
                    borderRadius: 9,
                    border: "none",
                    background: active ? "var(--color-primary)" : "transparent",
                    color: active ? "#0b1120" : "var(--color-muted)",
                    fontSize: 11,
                    fontWeight: active ? 800 : 600,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    transition: "background 140ms ease, color 140ms ease",
                    WebkitTapHighlightColor: "transparent",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
