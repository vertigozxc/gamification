import { useEffect, useMemo, useState } from "react";
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

  const itemsCountKey = `${quest?.id || ""}:${itemsCount}:${mechanic}`;
  useEffect(() => {
    if (!open) return;
    setItems(buildEmptyItems(itemsCount, mechanic));
    setKind("reflection");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsCountKey, open]);

  const valid = useMemo(() => {
    if (mechanic === "words") {
      return items.every((pair) => String(pair.word || "").trim().length >= 1 && String(pair.translation || "").trim().length >= 1);
    }
    return items.every((item) => String(item.text || "").trim().length >= minLength);
  }, [items, mechanic, minLength]);

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
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div
        className="logout-confirm-card"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "560px", width: "95vw" }}
      >
        <div className="text-4xl mb-2">{mechanic === "words" ? "🔤" : "📝"}</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>
          {title}
        </h2>
        <p className="logout-confirm-msg" style={{ marginBottom: 10 }}>
          {quest.title}
        </p>
        <p className="text-[12px]" style={{ color: "var(--color-muted)", marginBottom: 12 }}>
          {mechanic === "words"
            ? (t.wordsModalHelp || "Enter {count} word pairs (English → your language).").replace("{count}", String(itemsCount))
            : (t.noteModalHelp || "Write {count} entries, at least {min} characters each.")
                .replace("{count}", String(itemsCount))
                .replace("{min}", String(minLength))}
        </p>

        {mechanic === "note" ? (
          <div className="flex gap-2 mb-3 justify-center">
            {["reflection", "gratitude"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className="cinzel"
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: `1px solid ${kind === option ? "var(--color-primary)" : "var(--card-border-idle)"}`,
                  background: kind === option ? "rgba(250, 204, 21, 0.14)" : "transparent",
                  color: kind === option ? "var(--color-accent)" : "var(--color-muted)",
                  cursor: "pointer"
                }}
              >
                {kindLabel(option)}
              </button>
            ))}
          </div>
        ) : null}

        <div
          style={{ maxHeight: "55vh", overflowY: "auto", paddingRight: 4 }}
          className="flex flex-col gap-2"
        >
          {items.map((item, index) => (
            <div key={index} className="flex flex-col gap-1">
              <span className="text-[11px] cinzel" style={{ color: "var(--color-muted)" }}>
                {mechanic === "words"
                  ? (t.wordsPairLabel || "Pair {n}").replace("{n}", String(index + 1))
                  : (t.noteItemLabel || "Entry {n}").replace("{n}", String(index + 1))}
              </span>
              {mechanic === "words" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={item.word}
                    onChange={(e) => updateItem(index, { word: e.target.value })}
                    placeholder={t.wordsWordPlaceholder || "word"}
                    maxLength={120}
                    className="flex-1 rounded-lg px-3 py-2 text-slate-200"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)", fontSize: 14 }}
                  />
                  <input
                    type="text"
                    value={item.translation}
                    onChange={(e) => updateItem(index, { translation: e.target.value })}
                    placeholder={t.wordsTranslationPlaceholder || "translation"}
                    maxLength={240}
                    className="flex-1 rounded-lg px-3 py-2 text-slate-200"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--card-border-idle)", fontSize: 14 }}
                  />
                </div>
              ) : (
                <textarea
                  value={item.text}
                  onChange={(e) => updateItem(index, { text: e.target.value })}
                  placeholder={t.notePlaceholderItem || "Write here..."}
                  maxLength={2000}
                  className="w-full rounded-lg px-3 py-2 text-slate-200 resize-y"
                  style={{
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border-idle)",
                    fontSize: 14,
                    minHeight: 70
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {errorMessage ? (
          <p className="text-[12px] mt-2" style={{ color: "#f87171" }}>{errorMessage}</p>
        ) : null}

        <div className="logout-confirm-actions mt-4">
          <button className="logout-confirm-cancel cinzel" onClick={onClose} disabled={submitting}>
            {t.closeLabel || "Close"}
          </button>
          <button
            className="logout-confirm-proceed cinzel"
            onClick={handleSubmit}
            disabled={!valid || submitting}
            style={{ opacity: !valid || submitting ? 0.55 : 1 }}
          >
            {submitting ? (t.submittingLabel || "Submitting...") : (t.noteSubmitLabel || "Submit & complete")}
          </button>
        </div>
      </div>
    </div>
  );
}
