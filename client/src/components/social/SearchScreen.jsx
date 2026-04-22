import { useEffect, useRef, useState } from "react";
import { searchUsers } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import Screen from "./Screen";

function useDebounced(value, delay = 220) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return v;
}

export default function SearchScreen({ meUid, t, onClose, onOpenProfile }) {
  const [q, setQ] = useState("");
  const d = useDebounced(q, 250);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => { inputRef.current && inputRef.current.focus(); }, 300);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    const term = d.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setTouched(true);
    let cancelled = false;
    searchUsers(term)
      .then((r) => { if (!cancelled) setResults(r?.users || []); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [d]);

  return (
    <Screen
      title={t.arenaScoutTitle || "Find friends"}
      subtitle={t.arenaScoutSubtitle || "Search by nickname"}
      onClose={onClose}
      headerExtra={
        <div className="sb-search">
          <span style={{ fontSize: 16, opacity: 0.6 }}>🔍</span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.arenaScoutPlaceholder || "Type a nickname…"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label={t.arenaCancel || "Clear"}
              className="press"
              style={{ width: 22, height: 22, borderRadius: 11, border: "none", background: "rgba(120,120,128,0.5)", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" }}
            >
              ✕
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <div className="sb-spinner" />
        </div>
      ) : !touched || q.trim().length < 2 ? (
        <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-muted)" }}>
          {t.arenaScoutHint || "Type at least 2 characters."}
        </p>
      ) : results.length === 0 ? (
        <p style={{ textAlign: "center", padding: "24px 12px", color: "var(--color-muted)" }}>
          {t.arenaScoutEmpty || "No players found."}
        </p>
      ) : (
        <div className="sb-list">
          {results.map((u) => (
            <button
              key={u.username}
              type="button"
              onClick={() => { onOpenProfile(u.username); onClose(); }}
              className="sb-list-row press"
            >
              <StreakFrame streak={u.streak} size={40} ringWidth={2}>
                <Avatar photoUrl={u.photoUrl} displayName={u.displayName} size={40} />
              </StreakFrame>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="sb-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {u.displayName || u.username}{u.username === meUid ? ` (${t.arenaYou || "you"})` : ""}
                </p>
                <p className="sb-caption">{t.arenaLvlShort || "Lv"} {u.level} · 🔥 {u.streak}</p>
              </div>
              <span style={{ color: "var(--color-muted)", fontSize: 16, flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
