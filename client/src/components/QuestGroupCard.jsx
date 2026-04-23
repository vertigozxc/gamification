import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { variantLabel } from "../utils/questGrouping";

// Single card that represents a quest family (e.g. Step Goal with tiers
// 2k/4k/7k/10k/12k). User first taps the card to "pick" it, then can
// switch tiers via chips without having to re-pick. Difficulty dots
// reflect the currently-active tier.

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
    // Default to middle tier on first render so the user sees a
    // meaningful preview of the group without committing to the easiest.
    const midIdx = Math.min(variants.length - 1, Math.floor(variants.length / 2));
    return variants[midIdx]?.id || variants[0]?.id;
  });

  useEffect(() => {
    // When selection changes externally (parent state), mirror it on the card.
    if (selectedInGroup && Number(activeId) !== Number(selectedInGroup.id)) {
      setActiveId(selectedInGroup.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInGroup?.id]);

  if (!representative) return null;

  const activeQuest = variants.find((q) => Number(q.id) === Number(activeId)) || representative;
  const isSelected = Boolean(selectedInGroup);
  const showTierChips = variants.length > 1;
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
    // If the group was already selected, swap to the newly-picked tier.
    if (isSelected && Number(selectedInGroup.id) !== Number(target.id)) {
      onUnpick?.(selectedInGroup.id);
      onPick?.(target.id);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${isSelected ? "var(--color-primary)" : "var(--card-border-idle)"}`,
        background: isSelected ? "var(--color-accent-dim, rgba(250,204,21,0.08))" : "rgba(255,255,255,0.03)",
        transition: "border-color 160ms ease, background 160ms ease",
        opacity: disabled && !isSelected ? 0.5 : 1
      }}
    >
      <button
        type="button"
        onClick={handleCardToggle}
        disabled={disabled && !isSelected}
        className="mobile-pressable"
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          borderRadius: 14,
          cursor: (disabled && !isSelected) ? "not-allowed" : "pointer",
          zIndex: 0
        }}
        aria-label={representative.title}
      />

      <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            className="cinzel"
            style={{
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              padding: "2px 6px",
              borderRadius: 999,
              border: "1px solid var(--card-border-idle)"
            }}
          >
            {categoryLabel}
          </span>
          <DifficultyDots level={activeQuest.effortScore} max={5} />
          <span
            aria-hidden
            style={{
              marginLeft: "auto",
              width: 22,
              height: 22,
              borderRadius: 999,
              border: `2px solid ${isSelected ? "var(--color-primary)" : "rgba(255,255,255,0.2)"}`,
              background: isSelected ? "var(--color-primary)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f172a",
              fontSize: 12,
              fontWeight: 900
            }}
          >
            {isSelected ? "✓" : ""}
          </span>
        </div>

        <p className="cinzel" style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1.3 }}>
          {representative.title}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "4px 0 0", lineHeight: 1.35 }}>
          {activeQuest.desc || activeQuest.description || ""}
        </p>
      </div>

      {showTierChips ? (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            marginTop: 10,
            pointerEvents: "auto"
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label
            className="cinzel"
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              marginBottom: 4
            }}
          >
            {t.tierPickerLabel || "Difficulty"}
          </label>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center"
            }}
          >
            <select
              value={String(activeId)}
              onChange={(e) => handleTierPick(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="cinzel"
              style={{
                flex: 1,
                minHeight: 40,
                padding: "8px 32px 8px 12px",
                borderRadius: 10,
                border: `1px solid ${isSelected ? "var(--color-primary)" : "var(--card-border-idle)"}`,
                background: "rgba(0,0,0,0.28)",
                color: "var(--color-text)",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                cursor: "pointer",
                boxSizing: "border-box"
              }}
            >
              {variants.map((variant) => {
                const label = variantLabel(variant) || (t.tierPickerFallback || "Tier");
                const dots = "•".repeat(Math.max(1, Math.min(5, Number(variant.effortScore) || 1)));
                return (
                  <option key={variant.id} value={String(variant.id)}>
                    {label}  {dots}
                  </option>
                );
              })}
            </select>
            <span
              aria-hidden
              style={{
                position: "absolute",
                right: 12,
                color: "var(--color-muted)",
                fontSize: 12,
                pointerEvents: "none"
              }}
            >
              ▾
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
