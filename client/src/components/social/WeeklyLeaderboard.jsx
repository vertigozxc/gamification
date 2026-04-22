import { useEffect, useState } from "react";
import { fetchWeeklyLeaderboard, searchUsers } from "../../api";
import StreakFrame from "./StreakFrame";
import Avatar from "./Avatar";

function useDebounced(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

export default function WeeklyLeaderboard({ authUser, t, onOpenProfile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debouncedSearch = useDebounced(search, 250);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklyLeaderboard()
      .then((data) => {
        if (!cancelled) setUsers(data?.users || []);
      })
      .catch(() => { if (!cancelled) setUsers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchUsers(debouncedSearch.trim())
      .then((d) => { if (!cancelled) setSearchResults(d?.users || []); })
      .catch(() => { if (!cancelled) setSearchResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const meUid = String(authUser?.uid || "").slice(0, 128);
  const showSearch = search.trim().length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Search input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.55rem 0.75rem",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid var(--panel-border)",
          borderRadius: "0.65rem"
        }}
      >
        <span style={{ fontSize: "0.9rem", opacity: 0.7 }}>🔍</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.socialSearchPlaceholder || "Search player by nickname…"}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--color-text)",
            fontSize: "0.88rem"
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t.close || "Clear"}
            style={{ background: "transparent", border: "none", color: "var(--color-muted)", cursor: "pointer" }}
          >
            ✕
          </button>
        )}
      </div>

      {showSearch ? (
        <SearchResults
          results={searchResults}
          searching={searching}
          t={t}
          onOpenProfile={onOpenProfile}
          meUid={meUid}
        />
      ) : (
        <>
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(0,0,0,0.18)",
              border: "1px solid var(--panel-border)",
              borderRadius: "0.65rem",
              display: "flex",
              alignItems: "center",
              gap: "0.65rem"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>📅</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
                {t.socialWeeklyLabel || "Active players · this week"}
              </p>
              <p style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 1 }}>
                {t.socialWeeklyHint || "Resets every Monday at 00:00 UTC"}
              </p>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", padding: "2rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
          ) : users.length === 0 ? (
            <p style={{ textAlign: "center", padding: "2rem 0.75rem", color: "var(--color-muted)" }}>
              {t.socialWeeklyEmpty || "No one has earned XP this week yet. Be the first."}
            </p>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {users.map((u, idx) => (
                <LeaderboardRow
                  key={u.username}
                  rank={idx + 1}
                  user={u}
                  isMe={u.username === meUid}
                  t={t}
                  onOpenProfile={onOpenProfile}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardRow({ rank, user, isMe, t, onOpenProfile }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.6rem 0.75rem",
        borderRadius: "0.65rem",
        background: isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.12)" : "rgba(0,0,0,0.2)",
        border: `1px solid ${isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.45)" : "var(--panel-border)"}`
      }}
    >
      <span
        style={{
          width: 28,
          textAlign: "center",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          color: rank <= 3 ? "var(--color-primary)" : "var(--color-muted)",
          fontSize: rank <= 3 ? "1rem" : "0.85rem"
        }}
      >
        {rank}
      </span>

      <button
        type="button"
        onClick={() => onOpenProfile(user.username)}
        aria-label={t.socialOpenProfile || "Open profile"}
        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
      >
        <StreakFrame streak={user.streak} size={36} ringWidth={2}>
          <Avatar photoUrl={user.photoUrl} displayName={user.displayName} size={36} />
        </StreakFrame>
      </button>

      <button
        type="button"
        onClick={() => onOpenProfile(user.username)}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "transparent",
          border: "none",
          color: "var(--color-text)",
          padding: 0,
          cursor: "pointer"
        }}
      >
        <p style={{ fontWeight: 600, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.displayName || user.username}
        </p>
        <p style={{ fontSize: "0.68rem", color: "var(--color-muted)", display: "flex", gap: "0.55rem" }}>
          <span>{t.socialLevelLabel || "Lv"} {user.level}</span>
          <span>🔥 {user.streak}</span>
        </p>
      </button>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: "0.92rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}>
          {user.weeklyXp}
        </p>
        <p style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 600 }}>
          {t.socialWeekXpLabel || "XP"}
        </p>
      </div>
    </li>
  );
}

function SearchResults({ results, searching, t, onOpenProfile, meUid }) {
  if (searching) {
    return <p style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Searching…"}</p>;
  }
  if (results.length === 0) {
    return (
      <p style={{ textAlign: "center", padding: "1.5rem 0.75rem", color: "var(--color-muted)" }}>
        {t.socialSearchEmpty || "No players found"}
      </p>
    );
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {results.map((u) => (
        <li
          key={u.username}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.6rem 0.75rem",
            borderRadius: "0.65rem",
            background: "rgba(0,0,0,0.2)",
            border: "1px solid var(--panel-border)",
            cursor: "pointer"
          }}
          onClick={() => onOpenProfile(u.username)}
        >
          <StreakFrame streak={u.streak} size={36} ringWidth={2}>
            <Avatar photoUrl={u.photoUrl} displayName={u.displayName} size={36} />
          </StreakFrame>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {u.displayName || u.username}{u.username === meUid ? ` (${t.socialYou || "you"})` : ""}
            </p>
            <p style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>
              {t.socialLevelLabel || "Lv"} {u.level} · 🔥 {u.streak}
            </p>
          </div>
          <span style={{ color: "var(--color-muted)", fontSize: "1rem" }}>›</span>
        </li>
      ))}
    </ul>
  );
}
