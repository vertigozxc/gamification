import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";

function buildEmptyItems(count, mechanic) {
  return Array.from({ length: count }, () =>
    mechanic === "words" ? { word: "", translation: "" } : { text: "" }
  );
}

export default function QuestNoteModal({ open, quest, onClose, onSubmit, submitting = false, errorMessage = "" }) {
  const { t } = useTheme();
  const mechanic = quest?.mechanic === "words" ? "words" : "note";
  const itemsCount = mechanic === "words"
    ? Math.max(1, Number(quest?.targetCount) || 1)
    : Math.max(1, Number(quest?.minItems) || 1);
  const minLength = Math.max(1, Number(quest?.noteMinLength) || 10);
  const [kind, setKind] = useState("reflection");
  const [items, setItems] = useState(() => buildEmptyItems(itemsCount, mechanic));
  const firstInputRef = useRef(null);

  const itemsCountKey = `${quest?.id || ""}:${itemsCount}:${mechanic}`;
  useEffect(() => {
    if (!open) return;
    setItems(buildEmptyItems(itemsCount, mechanic));
    setKind("reflection");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsCountKey, open]);

  useEffect(() => {
    if (!open) return;
    // Autofocus the first input on open — iOS Safari needs a short tick
    // after the portal mounts before the keyboard pops up reliably.
    const id = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 120);
    return () => clearTimeout(id);
  }, [open]);

  const completedCount = useMemo(() => {
    if (mechanic === "words") {
      return items.filter((pair) => String(pair.word || "").trim() && String(pair.translation || "").trim()).length;
    }
    return items.filter((item) => String(item.text || "").trim().length >= minLength).length;
  }, [items, mechanic, minLength]);

  const valid = completedCount === itemsCount;
  const progressPercent = Math.round((completedCount / itemsCount) * 100);

  if (!open || !quest) return null;

  const title = mechanic === "words"
    ? (t.wordsModalTitle || "English words")
    : (t.noteModalTitle || "Daily notes");

  const kindLabel = (value) => {
    if (value === "gratitude") return t.noteKindGratitude || "Gratitude";
    return t.noteKindReflection || "Takeaway";
  };

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = () => {
    if (!valid || submitting) return;
    onSubmit?.({ kind: mechanic === "words" ? "words" : kind, items });
  };

  return (
    <div
      className="logout-confirm-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{
        zIndex: 85,
        alignItems: "stretch",
        justifyContent: "stretch",
        padding: 0,
        background: "rgba(0,0,0,0.72)"
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxWidth: "100vw",
          maxHeight: "100dvh",
          background: "var(--panel-bg, #0f172a)",
          border: "none",
          borderRadius: 0,
          boxShadow: "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 14px) 16px 12px",
            borderBottom: "1px solid var(--card-border-idle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 20 }}>{mechanic === "words" ? "🔤" : "📝"}</span>
                <h2
                  className="cinzel"
                  style={{
                    color: "var(--color-accent)",
                    fontSize: 18,
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {title}
                </h2>
              </div>
              <p className="truncate" style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {quest.title}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label={t.closeLabel || "Close"}
              className="ui-close-x"
            >
              ✕
            </button>
          </div>
          {/* Progress */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] cinzel" style={{ color: "var(--color-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {mechanic === "words"
                  ? (t.wordsModalHelpShort || "{count} pairs").replace("{count}", String(itemsCount))
                  : (t.noteModalHelpShort || "{count} entries · {min}+ chars").replace("{count}", String(itemsCount)).replace("{min}", String(minLength))}
              </span>
              <span className="text-[11px] font-bold" style={{ color: valid ? "var(--color-accent)" : "var(--color-muted)" }}>
                {completedCount}/{itemsCount}
              </span>
            </div>
            <div className="qb-progress-track">
              <div
                className="qb-progress-fill"
                style={{
                  width: `${progressPercent}%`,
                  background: valid
                    ? "linear-gradient(90deg, #22d3ee, #fde047)"
                    : "linear-gradient(90deg, #60a5fa, #a78bfa)"
                }}
              />
            </div>
          </div>

          {mechanic === "note" ? (
            <div className="flex gap-1.5 mt-2.5">
              {["reflection", "gratitude"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className="cinzel mobile-pressable"
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${kind === option ? "var(--color-primary)" : "var(--card-border-idle)"}`,
                    background: kind === option ? "rgba(250, 204, 21, 0.14)" : "transparent",
                    color: kind === option ? "var(--color-accent)" : "var(--color-muted)",
                    cursor: "pointer"
                  }}
                >
                  {option === "gratitude" ? "🙏" : "💡"} {kindLabel(option)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px 12px",
            WebkitOverflowScrolling: "touch"
          }}
          className="flex flex-col gap-3"
        >
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            if (mechanic === "words") {
              const filled = String(item.word || "").trim() && String(item.translation || "").trim();
              return (
                <div
                  key={index}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${filled ? "var(--color-primary-dim, var(--card-border-idle))" : "var(--card-border-idle)"}`,
                    borderRadius: 14,
                    padding: 12,
                    transition: "border-color 160ms ease"
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="cinzel text-[11px]" style={{ color: "var(--color-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {(t.wordsPairLabel || "Pair {n}").replace("{n}", String(index + 1))}
                    </span>
                    {filled ? <span style={{ fontSize: 14, color: "var(--color-accent)" }}>✓</span> : null}
                  </div>
                  <input
                    ref={index === 0 ? firstInputRef : null}
                    type="text"
                    inputMode="text"
                    value={item.word}
                    onChange={(e) => updateItem(index, { word: e.target.value })}
                    placeholder={t.wordsWordPlaceholder || "word"}
                    maxLength={120}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.28)",
                      border: "1px solid var(--card-border-idle)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      color: "var(--color-text)",
                      fontSize: 16,
                      marginBottom: 8,
                      boxSizing: "border-box"
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                    <span style={{ color: "var(--color-muted)", fontSize: 14 }}>→</span>
                    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                      {t.wordsTranslationLabel || "translation"}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="text"
                    value={item.translation}
                    onChange={(e) => updateItem(index, { translation: e.target.value })}
                    placeholder={t.wordsTranslationPlaceholder || "translation"}
                    maxLength={240}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.28)",
                      border: "1px solid var(--card-border-idle)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      color: "var(--color-text)",
                      fontSize: 16,
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              );
            }

            const text = String(item.text || "");
            const charsLeft = Math.max(0, minLength - text.trim().length);
            const done = text.trim().length >= minLength;
            return (
              <div
                key={index}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${done ? "var(--color-primary-dim, var(--card-border-idle))" : "var(--card-border-idle)"}`,
                  borderRadius: 14,
                  padding: 12,
                  transition: "border-color 160ms ease"
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="cinzel text-[11px]" style={{ color: "var(--color-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {(t.noteItemLabel || "Entry {n}").replace("{n}", String(index + 1))}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: done ? "var(--color-accent)" : "var(--color-muted)" }}>
                    {done ? "✓" : `−${charsLeft}`}
                  </span>
                </div>
                <textarea
                  ref={index === 0 ? firstInputRef : null}
                  value={text}
                  onChange={(e) => updateItem(index, { text: e.target.value })}
                  placeholder={t.notePlaceholderItem || "Write here..."}
                  maxLength={2000}
                  rows={isLast ? 4 : 3}
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.28)",
                    border: "1px solid var(--card-border-idle)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "var(--color-text)",
                    fontSize: 15,
                    lineHeight: 1.45,
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            );
          })}

          {errorMessage ? (
            <p className="text-[12px]" style={{ color: "#f87171", textAlign: "center" }}>{errorMessage}</p>
          ) : null}
        </div>

        {/* Sticky submit bar */}
        <div
          style={{
            padding: "10px 18px 14px",
            borderTop: "1px solid var(--card-border-idle)",
            background: "var(--panel-bg)",
            paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0))"
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="cinzel mobile-pressable"
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 14,
              background: !valid || submitting
                ? "rgba(255,255,255,0.06)"
                : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
              border: "none",
              color: !valid || submitting ? "#64748b" : "#0b1120",
              fontSize: 14,
              fontWeight: 800,
              cursor: !valid || submitting ? "not-allowed" : "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: !valid || submitting ? "none" : "0 8px 22px rgba(250, 204, 21, 0.22)"
            }}
          >
            {submitting
              ? (t.submittingLabel || "Submitting...")
              : valid
                ? (t.noteSubmitLabel || "Submit & complete")
                : `${completedCount}/${itemsCount} ${t.noteFillRemaining || "filled"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
