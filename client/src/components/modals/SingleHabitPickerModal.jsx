import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";

// Dedicated screen for filling ONE unlocked habit slot (triggered from the
// "New Habit Unlocked" card). Distinct from PinnedReplacementModal which
// replaces ALL pinned habits at once.
export default function SingleHabitPickerModal({
  open,
  onClose,
  availableQuests = [],
  onPick,
  saving = false,
  errorMessage = ""
}) {
  const { t, themeId } = useTheme();
  const isLight = themeId === "light";
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [sheetAnim, setSheetAnim] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedId(null);
      setSheetAnim(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setSheetAnim(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredQuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableQuests;
    return availableQuests.filter((quest) => {
      const hay = `${String(quest?.title || "").toLowerCase()} ${String(quest?.desc || quest?.description || "").toLowerCase()}`;
      return hay.includes(term);
    });
  }, [availableQuests, search]);

  if (!open) return null;

  const heading = t.singleHabitPickerHeading || "Pick a new habit";
  const subtitle = t.singleHabitPickerSubtitle || "One habit fills your newly unlocked slot.";
  const placeholder = t.onboardingSearch || "Search habits…";
  const confirmLabel = t.singleHabitPickerConfirm || "Add habit";
  const empty = t.singleHabitPickerEmpty || "No matching habits.";

  return createPortal(
    <div
      className="logout-confirm-overlay"
      style={{ zIndex: 86, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.76)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--panel-bg)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: sheetAnim ? "translateY(0)" : "translateY(8px)",
          opacity: sheetAnim ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease"
        }}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--panel-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(74,222,128,0.25), rgba(16,185,129,0.12))",
                border: "1px solid rgba(74,222,128,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20
              }}
            >
              ✨
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cinzel" style={{ color: "#bbf7d0", fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                {heading}
              </h2>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.cancelLabel || "Close"}
              style={{
                width: 40, height: 40, borderRadius: 999,
                background: isLight ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.75)" : "var(--card-border-idle, var(--panel-border))"}`,
                color: isLight ? "#f8fafc" : "#e2e8f0",
                cursor: "pointer", fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: isLight ? "0 2px 8px rgba(15,23,42,0.25)" : "none"
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--card-border-idle)",
                color: "#e2e8f0",
                fontSize: 16,
                minHeight: 44,
                outline: "none"
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px 100px" }}>
          {filteredQuests.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: 13, marginTop: 24 }}>{empty}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredQuests.map((quest) => {
                const isSelected = selectedId === quest.id;
                return (
                  <li key={quest.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(quest.id)}
                      className="shp-option mobile-pressable"
                      data-selected={isSelected ? "true" : "false"}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "14px",
                        borderRadius: 14,
                        cursor: "pointer",
                        transition: "border-color 150ms ease, background 150ms ease, transform 120ms ease",
                        background: isSelected
                          ? "color-mix(in srgb, #4ade80 15%, var(--panel-bg))"
                          : "color-mix(in srgb, var(--panel-bg) 88%, rgba(255,255,255,0.03))",
                        border: `2px solid ${isSelected ? "#4ade80" : "var(--panel-border)"}`,
                        color: "var(--color-text)",
                        boxShadow: isSelected ? "0 0 18px rgba(74,222,128,0.25)" : "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            border: `2px solid ${isSelected ? "#4ade80" : "rgba(148,163,184,0.45)"}`,
                            background: isSelected ? "#4ade80" : "transparent",
                            color: isSelected ? "#064e3b" : "transparent",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 800,
                            flexShrink: 0,
                            marginTop: 2,
                            transition: "all 150ms ease"
                          }}
                        >
                          ✓
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                            <span
                              className="cinzel"
                              style={{
                                fontSize: 10.5,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: "var(--color-primary)",
                                fontWeight: 700
                              }}
                            >
                              {String(quest.category || "").toUpperCase()}
                            </span>
                            {quest.needsTimer ? (
                              <span style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.04em" }}>
                                ⏱ {quest.timeEstimateMin} min
                              </span>
                            ) : null}
                          </div>
                          <h4 className="cinzel" style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px", color: "var(--color-text)", lineHeight: 1.3 }}>
                            {quest.title}
                          </h4>
                          <p style={{ fontSize: 12.5, margin: 0, color: "var(--color-muted)", lineHeight: 1.4 }}>
                            {quest.desc || quest.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid var(--panel-border)",
            background: "color-mix(in srgb, var(--panel-bg) 96%, transparent)",
            backdropFilter: "blur(8px)"
          }}
        >
          {errorMessage ? (
            <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 8px" }}>{errorMessage}</p>
          ) : null}
          <button
            type="button"
            disabled={!selectedId || saving}
            onClick={() => selectedId && onPick?.(selectedId)}
            className="cinzel"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.08em",
              border: "1px solid rgba(34,197,94,0.65)",
              background: selectedId
                ? "linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.7))"
                : "rgba(148,163,184,0.18)",
              color: selectedId ? "#ffffff" : "#94a3b8",
              cursor: selectedId ? "pointer" : "not-allowed",
              boxShadow: selectedId ? "0 6px 18px rgba(22,163,74,0.35)" : "none",
              transition: "background 150ms ease, box-shadow 150ms ease"
            }}
          >
            {saving ? (t.onboardingSaving || "Saving…") : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
