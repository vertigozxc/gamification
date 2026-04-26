import { useEffect, useRef, useState } from "react";
import { searchUsers, fetchFriendRelation } from "../../api";
import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import FramedAvatar from "./FramedAvatar";
import Screen from "./Screen";
import { IconClose, IconFlame } from "../icons/Icons";

// Badge meta per friend-relation state. Labels fall back to English so a
// brand-new install still reads sensibly before i18n strings land.
const RELATION_BADGE = {
  friends: { key: "friend", fallback: "Friend" },
  outgoing_pending: { key: "pendingOut", fallback: "Request sent" },
  incoming_pending: { key: "pendingIn", fallback: "Wants to be friend" },
  declined_by_them: { key: "declined", fallback: "Declined" }
};

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
  const [relations, setRelations] = useState({});
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

  // Fan out relation lookups for every result that isn't the current user
  // or already cached. Kept simple (one request per row); search batches
  // are typically ≤10 so this is fine without a bulk endpoint.
  useEffect(() => {
    if (!meUid || !Array.isArray(results) || results.length === 0) return;
    let cancelled = false;
    const toFetch = results.filter((u) => u.username !== meUid && relations[u.username] == null);
    if (toFetch.length === 0) return;
    Promise.all(toFetch.map((u) =>
      fetchFriendRelation(meUid, u.username)
        .then((rel) => ({ username: u.username, state: rel?.state || "none" }))
        .catch(() => ({ username: u.username, state: "none" }))
    )).then((entries) => {
      if (cancelled) return;
      setRelations((prev) => {
        const next = { ...prev };
        for (const e of entries) next[e.username] = e.state;
        return next;
      });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, meUid]);

  return (
    <Screen
      title={t.arenaScoutTitle || "Find friends"}
      subtitle={t.arenaScoutSubtitle || "Search by name or @username"}
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
              style={{ width: 22, height: 22, borderRadius: 11, border: "none", background: "rgba(120,120,128,0.5)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" }}
            >
              <IconClose size={12} strokeWidth={2.4} />
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
          {results.map((u) => {
            const state = u.username === meUid ? "self" : relations[u.username];
            const badge = RELATION_BADGE[state];
            const blocked = state === "declined_by_them";
            const badgeLabel = badge
              ? (t[`arenaRelation_${badge.key}`] || badge.fallback)
              : null;
            return (
              <button
                key={u.username}
                type="button"
                onClick={() => { if (!blocked) onOpenProfile(u.username); }}
                disabled={blocked}
                className="sb-list-row press"
                style={blocked ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
              >
                <FramedAvatar
                  photoUrl={u.photoUrl}
                  displayName={u.displayName}
                  size={40}
                  ringWidth={2}
                  streak={u.streak}
                  activeCosmetics={u.activeCosmetics}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="sb-body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.displayName || u.username}{u.username === meUid ? ` (${t.arenaYou || "you"})` : ""}
                  </p>
                  <p className="sb-caption" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span>{t.arenaLvlShort || "Lv"} {u.level}</span>
                    <span>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><IconFlame size={11} /> {u.streak}</span>
                  </p>
                </div>
                {badgeLabel ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: state === "friends"
                        ? "color-mix(in srgb, #10b981 22%, transparent)"
                        : state === "declined_by_them"
                          ? "rgba(148,163,184,0.18)"
                          : state === "incoming_pending"
                            ? "color-mix(in srgb, var(--color-primary) 22%, transparent)"
                            : "rgba(148,163,184,0.18)",
                      color: state === "friends"
                        ? "#6ee7b7"
                        : state === "declined_by_them"
                          ? "var(--color-muted)"
                          : state === "incoming_pending"
                            ? "var(--color-primary)"
                            : "var(--color-muted)",
                      border: `1px solid ${state === "friends" ? "rgba(16,185,129,0.45)" : state === "incoming_pending" ? "color-mix(in srgb, var(--color-primary) 45%, transparent)" : "var(--card-border-idle)"}`
                    }}
                  >
                    {badgeLabel}
                  </span>
                ) : (
                  <span style={{ color: "var(--color-muted)", fontSize: 16, flexShrink: 0 }}>›</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
