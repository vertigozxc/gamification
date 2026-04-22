import { useEffect, useMemo, useState } from "react";
import { fetchWeeklyLeaderboard, searchUsers } from "../../api";
import StreakFrame from "./StreakFrame";
import Avatar from "./Avatar";

function useDebounced(value, delay = 220) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function formatRange(weekStartDayKey, languageId) {
  if (!weekStartDayKey) return "";
  try {
    const start = new Date(`${weekStartDayKey}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = new Intl.DateTimeFormat(languageId === "ru" ? "ru-RU" : "en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  } catch {
    return "";
  }
}

export default function WeeklyLeaderboard({ authUser, t, languageId, onOpenProfile }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debouncedSearch = useDebounced(search, 250);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklyLeaderboard(meUid)
      .then((d) => { if (!cancelled) setData(d || null); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [meUid]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    let cancelled = false;
    setSearching(true);
    searchUsers(q)
      .then((r) => { if (!cancelled) setSearchResults(r?.users || []); })
      .catch(() => { if (!cancelled) setSearchResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const users = data?.users || [];
  const me = data?.me || null;
  const weekRange = useMemo(() => formatRange(data?.weekStartDayKey, languageId), [data?.weekStartDayKey, languageId]);

  const podium = users.slice(0, 3);
  const rest = users.slice(3);
  const meInTopShown = me ? users.some((u) => u.username === me.username) : false;
  const showSearch = search.trim().length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SearchBar search={search} onChange={setSearch} t={t} />

      {showSearch ? (
        <SearchResults results={searchResults} searching={searching} t={t} onOpenProfile={onOpenProfile} meUid={meUid} />
      ) : (
        <>
          <div
            style={{
              padding: "12px 14px",
              background: "var(--panel-bg)",
              border: "1px solid var(--panel-border)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(var(--color-primary-rgb,251,191,36),0.18)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              📅
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="caption" style={{ fontWeight: 500 }}>{t.socialWeeklyLabel || "This week"}</p>
              <p className="headline" style={{ marginTop: 1 }}>{weekRange || "—"}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p className="caption">{t.socialRankedCount || "Ranked"}</p>
              <p className="headline" style={{ color: "var(--color-primary)", marginTop: 1 }}>{data?.totalRanked || 0}</p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 0" }}>
              <div className="spinner" />
            </div>
          ) : users.length === 0 ? (
            <EmptyWeekly t={t} />
          ) : (
            <>
              {podium.length > 0 && <Podium entries={podium} t={t} meUid={meUid} onOpenProfile={onOpenProfile} />}
              {rest.length > 0 && (
                <div className="list">
                  {rest.map((u) => (
                    <Row key={u.username} entry={u} isMe={u.username === meUid} t={t} onOpenProfile={onOpenProfile} />
                  ))}
                </div>
              )}
            </>
          )}

          {me && !meInTopShown && (
            <>
              <h3 className="section-header" style={{ marginTop: 18 }}>{t.socialYourRank || "Your rank"}</h3>
              <div className="list">
                <Row entry={me} isMe meHighlight t={t} onOpenProfile={onOpenProfile} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SearchBar({ search, onChange, t }) {
  return (
    <div className="search">
      <span style={{ fontSize: 16, opacity: 0.6 }}>🔍</span>
      <input
        type="search"
        value={search}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.socialSearchPlaceholder || "Search player by nickname…"}
      />
      {search && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t.close || "Clear"}
          className="icon-btn press"
          style={{ width: 22, height: 22, fontSize: 11, background: "rgba(120,120,128,0.4)", color: "#fff" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Podium({ entries, t, meUid, onOpenProfile }) {
  const [first, second, third] = entries;
  const slots = [second, first, third].filter(Boolean);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${slots.length}, 1fr)`,
        alignItems: "end",
        gap: 8,
        padding: "14px 8px 10px",
        background: "var(--panel-bg)",
        border: "1px solid var(--panel-border)",
        borderRadius: 16,
      }}
    >
      {slots.map((e) => (
        <PodiumSlot
          key={e.username}
          entry={e}
          place={e === first ? 1 : e === second ? 2 : 3}
          isMe={e.username === meUid}
          t={t}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}

function PodiumSlot({ entry, place, isMe, t, onOpenProfile }) {
  const meta = {
    1: { medal: "🥇", accent: "#fbbf24", height: 96 },
    2: { medal: "🥈", accent: "#d1d5db", height: 76 },
    3: { medal: "🥉", accent: "#d97706", height: 60 },
  }[place];
  const avatarSize = place === 1 ? 58 : 48;
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(entry.username)}
      className="press"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 8,
        borderRadius: 12,
        background: "transparent",
        border: "none",
        color: "var(--color-text)",
      }}
    >
      <span style={{ fontSize: place === 1 ? 22 : 18, lineHeight: 1 }}>{meta.medal}</span>
      <StreakFrame streak={entry.streak} size={avatarSize} ringWidth={3}>
        <Avatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={avatarSize} />
      </StreakFrame>
      <p
        className="body"
        style={{
          fontSize: place === 1 ? 14 : 13,
          fontWeight: 600,
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
          marginTop: -2,
          letterSpacing: "-0.01em",
        }}
      >
        {entry.displayName || entry.username}
        {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.socialYou || "you"}</span>}
      </p>
      <div
        style={{
          width: "100%",
          height: meta.height,
          background: `linear-gradient(180deg, ${meta.accent}44, ${meta.accent}10)`,
          border: `1px solid ${meta.accent}66`,
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          gap: 1,
        }}
      >
        <p style={{ fontSize: place === 1 ? 22 : 18, fontWeight: 700, color: meta.accent, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {entry.weeklyXp}
        </p>
        <p className="caption" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {t.socialWeekXpLabel || "XP"}
        </p>
      </div>
    </button>
  );
}

function Row({ entry, isMe, meHighlight, t, onOpenProfile }) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(entry.username)}
      className="list-row press"
      style={{
        background: meHighlight
          ? "rgba(var(--color-primary-rgb,251,191,36),0.14)"
          : isMe
            ? "rgba(var(--color-primary-rgb,251,191,36),0.06)"
            : "transparent",
      }}
    >
      <span
        style={{
          width: 26,
          textAlign: "center",
          fontWeight: 700,
          color: entry.rank && entry.rank <= 3 ? "var(--color-primary)" : "var(--color-muted)",
          fontSize: 13,
          flexShrink: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {entry.rank ? entry.rank : "—"}
      </span>
      <StreakFrame streak={entry.streak} size={40} ringWidth={2}>
        <Avatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={40} />
      </StreakFrame>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="body" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
          {entry.displayName || entry.username}
          {isMe && <span style={{ color: "var(--color-primary)", fontWeight: 600 }}> · {t.socialYou || "you"}</span>}
        </p>
        <p className="caption" style={{ display: "flex", gap: 8, marginTop: 1 }}>
          <span>{t.socialLevelLabel || "Lv"} {entry.level}</span>
          <span>🔥 {entry.streak}</span>
          {typeof entry.weeklyTasks === "number" && <span>✓ {entry.weeklyTasks}</span>}
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "var(--color-primary)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {entry.weeklyXp}
        </p>
        <p className="caption" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {t.socialWeekXpLabel || "XP"}
        </p>
      </div>
    </button>
  );
}

function EmptyWeekly({ t }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔥</div>
      <p className="headline" style={{ marginBottom: 4 }}>
        {t.socialWeeklyEmptyTitle || "Fresh week, zero points."}
      </p>
      <p className="subhead">{t.socialWeeklyEmpty || "Complete a task today and you're on the board."}</p>
    </div>
  );
}

function SearchResults({ results, searching, t, onOpenProfile, meUid }) {
  if (searching) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
        <div className="spinner" />
      </div>
    );
  }
  if (results.length === 0) {
    return <p style={{ textAlign: "center", padding: "24px 12px", color: "var(--color-muted)" }}>{t.socialSearchEmpty || "No players found"}</p>;
  }
  return (
    <div className="list">
      {results.map((u) => (
        <button
          key={u.username}
          type="button"
          onClick={() => onOpenProfile(u.username)}
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
  );
}
