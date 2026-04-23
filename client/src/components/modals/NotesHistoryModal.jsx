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

const KIND_META = {
  all: { emoji: "📚", key: "all" },
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
    const c = { all: entries.length, reflection: 0, gratitude: 0, words: 0 };
    for (const entry of entries) {
      if (c[entry.kind] != null) c[entry.kind] += 1;
    }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== "all" && entry.kind !== filter) return false;
      if (!q) return true;
      if (entry.kind === "words") {
        return (entry.items || []).some((pair) =>
          String(pair.word || "").toLowerCase().includes(q)
          || String(pair.translation || "").toLowerCase().includes(q)
        );
      }
      return (entry.items || []).some((item) => String(item.text || "").toLowerCase().includes(q));
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
          background: active ? "rgba(250, 204, 21, 0.14)" : "rgba(255,255,255,0.03)",
          color: active ? "var(--color-accent)" : "var(--color-muted)",
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
            background: active ? "rgba(250,204,21,0.18)" : "rgba(148,163,184,0.14)",
            padding: "1px 7px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            color: active ? "var(--color-accent)" : "var(--color-muted)"
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
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.notesHistorySearchPlaceholder || "Search your notes..."}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--card-border-idle)",
                borderRadius: 12,
                color: "var(--color-text)",
                fontSize: 14,
                boxSizing: "border-box"
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              overflowX: "auto",
              paddingBottom: 2,
              WebkitOverflowScrolling: "touch"
            }}
          >
            <FilterPill kindKey="all" />
            <FilterPill kindKey="reflection" />
            <FilterPill kindKey="gratitude" />
            <FilterPill kindKey="words" />
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 16px calc(28px + env(safe-area-inset-bottom, 0px) + var(--mobile-safe-bottom, 80px))",
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
    </div>
  );
}
