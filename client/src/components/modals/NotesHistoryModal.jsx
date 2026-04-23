import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../ThemeContext";
import { fetchNotesHistory, createPersonalNote, deletePersonalNote } from "../../api";
import { fuzzyMatch } from "../../utils/fuzzySearch";
import InputWithClear from "../InputWithClear";

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

const KIND_META = {
  all: { emoji: "📚", key: "all" },
  personal: { emoji: "✏️", key: "personal" },
  reflection: { emoji: "💡", key: "reflection" },
  gratitude: { emoji: "🙏", key: "gratitude" },
  words: { emoji: "🔤", key: "words" }
};

export default function NotesHistoryModal({ open, username, onClose }) {
  const { t, languageId } = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composeSaving, setComposeSaving] = useState(false);
  const [composeError, setComposeError] = useState("");

  useEffect(() => {
    if (!open || !username) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setFilter("all");
    setQuery("");
    setExpanded(new Set());
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

  const counts = useMemo(() => {
    const c = { all: entries.length, personal: 0, reflection: 0, gratitude: 0, words: 0 };
    for (const entry of entries) {
      if (c[entry.kind] != null) c[entry.kind] += 1;
    }
    return c;
  }, [entries]);

  const handleCreatePersonal = async () => {
    const text = composeText.trim();
    if (!text || composeSaving || !username) return;
    setComposeSaving(true);
    setComposeError("");
    try {
      const resp = await createPersonalNote(username, text);
      if (resp?.entry) {
        setEntries((prev) => [resp.entry, ...prev]);
      }
      setComposeText("");
      setComposeOpen(false);
      setFilter("personal");
    } catch (err) {
      setComposeError(String(err?.message || (t.noteSubmitFailed || "Submission failed.")));
    } finally {
      setComposeSaving(false);
    }
  };

  const handleDeletePersonal = async (id) => {
    if (!username || !id) return;
    const confirmMsg = t.notesHistoryDeleteConfirm || "Delete this note?";
    if (typeof window !== "undefined" && !window.confirm(confirmMsg)) return;
    try {
      await deletePersonalNote(username, id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(String(err?.message || (t.notesHistoryFailed || "Failed to delete note.")));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    return entries.filter((entry) => {
      if (filter !== "all" && entry.kind !== filter) return false;
      if (!q) return true;
      const haystack = entry.kind === "words"
        ? (entry.items || []).map((p) => `${p.word || ""} ${p.translation || ""}`).join(" ")
        : (entry.items || []).map((item) => item.text || "").join(" ");
      return fuzzyMatch(q, haystack);
    });
  }, [entries, filter, query]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const entry of filtered) {
      const key = entry.dayKey || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return [...groups.entries()];
  }, [filtered]);

  if (!open) return null;

  const kindLabel = (kind) => {
    if (kind === "personal") return t.noteKindPersonal || "Personal";
    if (kind === "gratitude") return t.noteKindGratitude || "Gratitude";
    if (kind === "words") return t.noteKindWords || "Foreign words";
    if (kind === "reflection") return t.noteKindReflection || "Takeaway";
    return t.notesHistoryFilterAll || "All";
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const FilterPill = ({ kindKey }) => {
    const active = filter === kindKey;
    const meta = KIND_META[kindKey];
    const count = counts[kindKey] || 0;
    const label = kindKey === "all"
      ? (t.notesHistoryFilterAll || "All")
      : kindLabel(kindKey);
    return (
      <button
        type="button"
        onClick={() => setFilter(kindKey)}
        className="cinzel mobile-pressable"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 999,
          border: `1px solid ${active ? "var(--color-primary)" : "var(--card-border-idle)"}`,
          background: active
            ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
            : "rgba(255,255,255,0.03)",
          color: active ? "var(--color-primary)" : "var(--color-muted)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          flexShrink: 0
        }}
      >
        <span>{meta.emoji}</span>
        <span>{label}</span>
        <span
          style={{
            background: active
              ? "color-mix(in srgb, var(--color-primary) 22%, transparent)"
              : "rgba(148,163,184,0.14)",
            padding: "1px 7px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            color: active ? "var(--color-primary)" : "var(--color-muted)"
          }}
        >
          {count}
        </span>
      </button>
    );
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
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 14px) 16px 12px",
            borderBottom: "1px solid var(--card-border-idle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 22 }}>📚</span>
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
                  {t.notesHistoryTitle || "My notes"}
                </h2>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                {t.notesHistoryHelp || "Your saved reflections, gratitude, and vocabulary."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeLabel || "Close"}
              className="ui-close-x"
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <InputWithClear
              value={query}
              onChange={setQuery}
              placeholder={t.notesHistorySearchPlaceholder || "Search your notes..."}
              clearAriaLabel={t.clearLabel || "Clear"}
              inputStyle={{
                padding: "10px 14px",
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--card-border-idle)",
                borderRadius: 12,
                color: "var(--color-text)",
                fontSize: 14
              }}
            />
          </div>

          <div
            className="no-scrollbar"
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              overflowX: "auto",
              paddingBottom: 0,
              WebkitOverflowScrolling: "touch"
            }}
          >
            <FilterPill kindKey="all" />
            <FilterPill kindKey="personal" />
            <FilterPill kindKey="reflection" />
            <FilterPill kindKey="gratitude" />
            <FilterPill kindKey="words" />
          </div>

          <button
            type="button"
            onClick={() => { setComposeError(""); setComposeText(""); setComposeOpen(true); }}
            className="mobile-pressable cinzel"
            style={{
              marginTop: 10,
              width: "100%",
              minHeight: 44,
              borderRadius: 12,
              border: "1px dashed var(--color-primary)",
              background: "rgba(250, 204, 21, 0.06)",
              color: "var(--color-accent)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <span style={{ fontSize: 18 }}>＋</span>
            {t.notesHistoryNewPersonal || "New personal note"}
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 16px calc(140px + env(safe-area-inset-bottom, 0px))",
            WebkitOverflowScrolling: "touch"
          }}
        >
          {loading ? (
            <p className="text-center text-sm" style={{ color: "var(--color-muted)", padding: "40px 0" }}>
              {t.loadingLabel || "Loading..."}
            </p>
          ) : error ? (
            <p className="text-center text-sm" style={{ color: "#f87171", padding: "40px 0" }}>{error}</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <div style={{ fontSize: 56, opacity: 0.5, marginBottom: 10 }}>📝</div>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                {entries.length === 0
                  ? (t.notesHistoryEmpty || "No notes yet — complete a note quest to start your journal.")
                  : (t.notesHistoryNoMatch || "No notes match the current filter.")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.map(([dayKey, group]) => (
                <div key={dayKey}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      paddingLeft: 4
                    }}
                  >
                    <span
                      className="cinzel"
                      style={{
                        color: "var(--color-primary)",
                        fontSize: 11,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        fontWeight: 700
                      }}
                    >
                      {formatDate(dayKey, languageId)}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--card-border-idle)" }} />
                    <span style={{ fontSize: 11, color: "var(--color-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {group.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {group.map((entry) => {
                      const isExpanded = expanded.has(entry.id);
                      const meta = KIND_META[entry.kind] || KIND_META.reflection;
                      const itemCount = (entry.items || []).length;
                      const preview = entry.kind === "words"
                        ? (entry.items || []).slice(0, 2).map((p) => p.word).filter(Boolean).join(", ")
                        : String((entry.items || [])[0]?.text || "").slice(0, 90);
                      return (
                        <div
                          key={entry.id}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--card-border-idle)",
                            borderRadius: 14,
                            overflow: "hidden"
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpanded(entry.id)}
                            className="mobile-pressable"
                            style={{
                              width: "100%",
                              padding: "12px 14px",
                              background: "transparent",
                              border: "none",
                              color: "inherit",
                              textAlign: "left",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 10
                            }}
                          >
                            <span style={{ fontSize: 20, flexShrink: 0 }}>{meta.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span
                                  className="cinzel"
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
                                <span style={{ fontSize: 10, color: "var(--color-muted)" }}>
                                  {itemCount} {entry.kind === "words"
                                    ? (t.notesHistoryPairs || "pairs")
                                    : (t.notesHistoryEntries || "entries")}
                                </span>
                              </div>
                              <p
                                className="truncate"
                                style={{
                                  fontSize: 13,
                                  color: "var(--color-text)",
                                  lineHeight: 1.35,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  margin: 0
                                }}
                              >
                                {preview || <span style={{ color: "var(--color-muted)" }}>—</span>}
                              </p>
                            </div>
                            <span
                              style={{
                                color: "var(--color-muted)",
                                fontSize: 14,
                                transition: "transform 160ms ease",
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                flexShrink: 0
                              }}
                            >
                              ›
                            </span>
                          </button>

                          {isExpanded ? (
                            <div
                              style={{
                                padding: "0 14px 14px 44px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8
                              }}
                            >
                              {entry.kind === "personal" ? (
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePersonal(entry.id)}
                                    className="mobile-pressable"
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "5px 10px",
                                      borderRadius: 8,
                                      border: "1px solid rgba(248,113,113,0.4)",
                                      background: "rgba(248,113,113,0.08)",
                                      color: "#f87171",
                                      cursor: "pointer",
                                      letterSpacing: "0.05em",
                                      textTransform: "uppercase"
                                    }}
                                  >
                                    🗑 {t.notesHistoryDelete || "Delete"}
                                  </button>
                                </div>
                              ) : null}
                              {entry.kind === "words" ? (
                                (entry.items || []).map((pair, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      background: "rgba(0,0,0,0.22)",
                                      border: "1px solid rgba(148,163,184,0.14)"
                                    }}
                                  >
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                                      {pair.word}
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 2 }}>
                                      → {pair.translation}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                (entry.items || []).map((item, i) => (
                                  <p
                                    key={i}
                                    style={{
                                      fontSize: 14,
                                      lineHeight: 1.5,
                                      color: "var(--color-text)",
                                      margin: 0,
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      background: "rgba(0,0,0,0.22)",
                                      border: "1px solid rgba(148,163,184,0.14)",
                                      whiteSpace: "pre-wrap"
                                    }}
                                  >
                                    {item.text}
                                  </p>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {composeOpen ? (
        <div
          className="logout-confirm-overlay"
          onClick={(event) => { if (event.target === event.currentTarget && !composeSaving) setComposeOpen(false); }}
          style={{ zIndex: 90, background: "rgba(0,0,0,0.72)", padding: 16 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "var(--panel-bg)",
              border: "1px solid var(--card-border-idle)",
              borderRadius: 18,
              padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 22 }}>✏️</span>
                <h3 className="cinzel" style={{ color: "var(--color-accent)", fontSize: 16, fontWeight: 700, margin: 0 }}>
                  {t.notesHistoryNewPersonalTitle || "New personal note"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { if (!composeSaving) setComposeOpen(false); }}
                aria-label={t.closeLabel || "Close"}
                className="ui-close-x"
              >
                ✕
              </button>
            </div>
            <textarea
              autoFocus
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder={t.notesHistoryPersonalPlaceholder || "What's on your mind?"}
              maxLength={4000}
              rows={6}
              style={{
                width: "100%",
                minHeight: 140,
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--card-border-idle)",
                borderRadius: 12,
                padding: "12px 14px",
                color: "var(--color-text)",
                fontSize: 15,
                lineHeight: 1.5,
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit"
              }}
            />
            {composeError ? (
              <p className="text-[12px]" style={{ color: "#f87171", textAlign: "center", margin: 0 }}>{composeError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleCreatePersonal}
              disabled={!composeText.trim() || composeSaving}
              className="cinzel mobile-pressable"
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: 12,
                background: (!composeText.trim() || composeSaving)
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                border: "none",
                color: (!composeText.trim() || composeSaving) ? "#64748b" : "#0b1120",
                fontSize: 13,
                fontWeight: 800,
                cursor: (!composeText.trim() || composeSaving) ? "not-allowed" : "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase"
              }}
            >
              {composeSaving
                ? (t.submittingLabel || "Saving...")
                : (t.notesHistorySaveLabel || "Save note")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
