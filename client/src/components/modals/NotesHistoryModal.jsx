import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../ThemeContext";
import { fetchNotesHistory } from "../../api";

function formatDate(dayKey, languageId) {
  if (!dayKey) return "";
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function NotesHistoryModal({ open, username, onClose }) {
  const { t, languageId } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !username) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchNotesHistory(username)
      .then((resp) => {
        if (cancelled) return;
        setEntries(Array.isArray(resp?.entries) ? resp.entries : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message || (t.notesHistoryFailed || "Failed to load notes.")));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, username, t]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const entry of entries) {
      const key = entry.dayKey || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return [...groups.entries()];
  }, [entries]);

  if (!open) return null;

  const kindLabel = (kind) => {
    if (kind === "gratitude") return t.noteKindGratitude || "Gratitude";
    if (kind === "words") return t.noteKindWords || "English words";
    return t.noteKindReflection || "Takeaway";
  };

  return (
    <div className="logout-confirm-overlay" onClick={onClose}>
      <div
        className="logout-confirm-card"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "640px", width: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div className="text-4xl mb-2">📚</div>
        <h2 className="cinzel logout-confirm-title" style={{ color: "var(--color-accent)" }}>
          {t.notesHistoryTitle || "My notes"}
        </h2>
        <p className="text-[12px]" style={{ color: "var(--color-muted)", marginBottom: 10 }}>
          {t.notesHistoryHelp || "Your saved reflections, gratitude, and vocabulary."}
        </p>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }} className="flex flex-col gap-3">
          {loading ? (
            <p className="text-center text-sm" style={{ color: "var(--color-muted)" }}>
              {t.loadingLabel || "Loading..."}
            </p>
          ) : error ? (
            <p className="text-center text-sm" style={{ color: "#f87171" }}>{error}</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-sm" style={{ color: "var(--color-muted)" }}>
              {t.notesHistoryEmpty || "No notes yet — complete a note quest to start your journal."}
            </p>
          ) : (
            grouped.map(([dayKey, group]) => (
              <div
                key={dayKey}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border-idle)",
                  borderRadius: 12,
                  padding: 12
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="cinzel text-[12px] font-bold tracking-wider uppercase" style={{ color: "var(--color-primary)" }}>
                    {formatDate(dayKey, languageId)}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                    {group.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.map((entry) => (
                    <div
                      key={entry.id}
                      style={{ background: "var(--panel-bg)", border: "1px solid var(--card-border-idle)", borderRadius: 10, padding: 10 }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "rgba(250, 204, 21, 0.14)",
                            color: "var(--color-accent)",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase"
                          }}
                        >
                          {kindLabel(entry.kind)}
                        </span>
                      </div>
                      {entry.kind === "words" ? (
                        <div className="flex flex-col gap-1">
                          {(entry.items || []).map((pair, i) => (
                            <div key={i} className="flex gap-2 items-baseline">
                              <span className="text-[13px] font-bold" style={{ color: "var(--color-text)" }}>
                                {pair.word}
                              </span>
                              <span className="text-[13px]" style={{ color: "var(--color-muted)" }}>
                                — {pair.translation}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {(entry.items || []).map((item, i) => (
                            <p key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--color-text)" }}>
                              {item.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="logout-confirm-actions mt-4">
          <button className="logout-confirm-cancel cinzel" onClick={onClose}>
            {t.closeLabel || "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
