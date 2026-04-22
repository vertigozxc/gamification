import { useEffect, useRef, useState } from "react";
import { searchUsers } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import Screen from "./Screen";

function useDebounced(value, delay = 220) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen({ meUid, t, onClose, onOpenProfile }) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 250);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Autofocus after open-animation settles
    const timer = setTimeout(() => { inputRef.current && inputRef.current.focus(); }, 340);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setTouched(true);
    let cancelled = false;
    searchUsers(term)
      .then((r) => { if (!cancelled) setResults(r?.users || []); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  return (
    <Screen title={t.socialSearchTitle || "Find players"} leftLabel={t.cancel || "Cancel"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="search">
          <span style={{ fontSize: 16, opacity: 0.6 }}>🔍</span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.socialSearchPlaceholder || "Search player by nickname…"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label={t.close || "Clear"}
              className="icon-btn press"
              style={{ width: 22, height: 22, fontSize: 11, background: "rgba(120,120,128,0.4)", color: "#fff" }}
            >
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
            <div className="spinner" />
          </div>
        ) : !touched || q.trim().length < 2 ? (
          <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-muted)" }}>
            {t.socialSearchHint || "Type at least 2 characters to search."}
          </p>
        ) : results.length === 0 ? (
          <p style={{ textAlign: "center", padding: "24px 12px", color: "var(--color-muted)" }}>
            {t.socialSearchEmpty || "No players found"}
          </p>
        ) : (
          <div className="list">
            {results.map((u) => (
              <button
                key={u.username}
                type="button"
                onClick={() => { onOpenProfile(u.username); onClose(); }}
                className="list-row press"
              >
                <StreakFrame streak={u.streak} size={40} ringWidth={2}>
                  <Avatar photoUrl={u.photoUrl} displayName={u.displayName} size={40} />
                </StreakFrame>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.displayName || u.username}{u.username === meUid ? ` (${t.socialYou || "you"})` : ""}
                  </p>
                  <p className="caption">{t.socialLevelLabel || "Lv"} {u.level} · 🔥 {u.streak}</p>
                </div>
                <span style={{ color: "var(--color-muted)", fontSize: 16, flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
