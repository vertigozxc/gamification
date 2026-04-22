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

function formatRange(weekStartDayKey, weekDayCount, languageId) {
  if (!weekStartDayKey) return "";
  try {
    const start = new Date(`${weekStartDayKey}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = new Intl.DateTimeFormat(languageId === "ru" ? "ru-RU" : "en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC"
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
  const weekRange = useMemo(
    () => formatRange(data?.weekStartDayKey, data?.weekDayCount, languageId),
    [data?.weekStartDayKey, data?.weekDayCount, languageId]
  );

  const podium = users.slice(0, 3);
  const rest = users.slice(3);
  const meInTopShown = me ? users.some((u) => u.username === me.username) : false;
  const showSearch = search.trim().length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <SearchBar search={search} onChange={setSearch} t={t} />

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
          {/* Week header */}
          <div
            style={{
              padding: "0.75rem 0.9rem",
              background: "rgba(0,0,0,0.2)",
              border: "1px solid var(--panel-border)",
              borderRadius: "0.7rem",
              display: "flex",
              alignItems: "center",
              gap: "0.7rem"
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>📅</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
                {t.socialWeeklyLabel || "This week"}
              </p>
              <p style={{ fontSize: "0.88rem", color: "var(--color-text)", fontWeight: 600, marginTop: 1 }}>
                {weekRange || "—"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
                {t.socialRankedCount || "Ranked"}
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                {data?.totalRanked || 0}
              </p>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: "center", padding: "2rem 0", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
          ) : users.length === 0 ? (
            <EmptyWeekly t={t} />
          ) : (
            <>
              {podium.length > 0 && <Podium entries={podium} t={t} meUid={meUid} onOpenProfile={onOpenProfile} />}
              {rest.length > 0 && (
                <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {rest.map((u) => (
                    <Row key={u.username} entry={u} isMe={u.username === meUid} t={t} onOpenProfile={onOpenProfile} />
                  ))}
                </ol>
              )}
            </>
          )}

          {/* Sticky "your rank" card when user is outside the shown top */}
          {me && !meInTopShown && (
            <>
              <div style={{ padding: "0.35rem 0", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700, textAlign: "center" }}>
                {t.socialYourRank || "Your rank"}
              </div>
              <Row entry={me} isMe meHighlight t={t} onOpenProfile={onOpenProfile} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------ sub-pieces ------ */

function SearchBar({ search, onChange, t }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        padding: "0.6rem 0.8rem",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.7rem"
      }}
    >
      <span style={{ fontSize: "0.95rem", opacity: 0.75 }}>🔍</span>
      <input
        type="search"
        value={search}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.socialSearchPlaceholder || "Search player by nickname…"}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--color-text)",
          fontSize: "0.9rem"
        }}
      />
      {search && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t.close || "Clear"}
          style={{ background: "transparent", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: "1rem" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Podium({ entries, t, meUid, onOpenProfile }) {
  // Position order on screen: 2nd, 1st, 3rd (classic podium).
  const [first, second, third] = entries;
  const slots = [second, first, third].filter(Boolean);
  const heights = slots.map((e) => (e === first ? 100 : e === second ? 80 : 64));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${slots.length}, 1fr)`,
        alignItems: "end",
        gap: "0.55rem",
        padding: "0.85rem 0.5rem 0.5rem",
        background: "linear-gradient(180deg, rgba(var(--color-primary-rgb,251,191,36),0.1), rgba(0,0,0,0.25))",
        border: "1px solid var(--panel-border)",
        borderRadius: "0.8rem"
      }}
    >
      {slots.map((e, i) => (
        <PodiumSlot
          key={e.username}
          entry={e}
          place={e === first ? 1 : e === second ? 2 : 3}
          height={heights[i]}
          isMe={e.username === meUid}
          t={t}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}

function PodiumSlot({ entry, place, height, isMe, t, onOpenProfile }) {
  const meta = {
    1: { medal: "🥇", bg: "linear-gradient(180deg, rgba(251,191,36,0.35), rgba(251,191,36,0.08))", border: "rgba(251,191,36,0.6)" },
    2: { medal: "🥈", bg: "linear-gradient(180deg, rgba(209,213,219,0.32), rgba(209,213,219,0.08))", border: "rgba(209,213,219,0.55)" },
    3: { medal: "🥉", bg: "linear-gradient(180deg, rgba(217,119,6,0.32), rgba(217,119,6,0.08))", border: "rgba(217,119,6,0.55)" }
  }[place];

  const avatarSize = place === 1 ? 58 : 48;

  return (
    <button
      type="button"
      onClick={() => onOpenProfile(entry.username)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--color-text)"
      }}
    >
      <span style={{ fontSize: place === 1 ? "1.5rem" : "1.2rem", lineHeight: 1 }}>{meta.medal}</span>
      <StreakFrame streak={entry.streak} size={avatarSize} ringWidth={3}>
        <Avatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={avatarSize} />
      </StreakFrame>
      <p
        style={{
          fontSize: place === 1 ? "0.82rem" : "0.74rem",
          fontWeight: 700,
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
          marginTop: -2
        }}
      >
        {entry.displayName || entry.username}
        {isMe && <span style={{ color: "var(--color-primary)", fontWeight: 700 }}> · {t.socialYou || "you"}</span>}
      </p>
      <div
        style={{
          width: "100%",
          height,
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          borderRadius: "0.55rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.3rem",
          gap: 2
        }}
      >
        <p style={{ fontSize: place === 1 ? "1.35rem" : "1.1rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--color-primary)", lineHeight: 1 }}>
          {entry.weeklyXp}
        </p>
        <p style={{ fontSize: "0.54rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
          {t.socialWeekXpLabel || "XP"}
        </p>
      </div>
    </button>
  );
}

function Row({ entry, isMe, meHighlight, t, onOpenProfile }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.6rem 0.7rem",
        borderRadius: "0.65rem",
        background: meHighlight
          ? "rgba(var(--color-primary-rgb,251,191,36),0.16)"
          : isMe
            ? "rgba(var(--color-primary-rgb,251,191,36),0.09)"
            : "rgba(0,0,0,0.2)",
        border: `1px solid ${meHighlight ? "rgba(var(--color-primary-rgb,251,191,36),0.6)" : isMe ? "rgba(var(--color-primary-rgb,251,191,36),0.35)" : "var(--panel-border)"}`
      }}
    >
      <span
        style={{
          width: 28,
          textAlign: "center",
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          color: entry.rank && entry.rank <= 3 ? "var(--color-primary)" : "var(--color-muted)",
          fontSize: "0.82rem"
        }}
      >
        {entry.rank ? `#${entry.rank}` : "—"}
      </span>

      <button type="button" onClick={() => onOpenProfile(entry.username)} style={btnReset}>
        <StreakFrame streak={entry.streak} size={38} ringWidth={2}>
          <Avatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={38} />
        </StreakFrame>
      </button>

      <button
        type="button"
        onClick={() => onOpenProfile(entry.username)}
        style={{ ...btnReset, flex: 1, minWidth: 0, textAlign: "left" }}
      >
        <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.displayName || entry.username}
          {isMe && <span style={{ color: "var(--color-primary)" }}> · {t.socialYou || "you"}</span>}
        </p>
        <p style={{ fontSize: "0.66rem", color: "var(--color-muted)", display: "flex", gap: "0.5rem", marginTop: 1 }}>
          <span>{t.socialLevelLabel || "Lv"} {entry.level}</span>
          <span>🔥 {entry.streak}</span>
          {typeof entry.weeklyTasks === "number" && (
            <span>✓ {entry.weeklyTasks}</span>
          )}
        </p>
      </button>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--color-primary)", lineHeight: 1 }}>
          {entry.weeklyXp}
        </p>
        <p style={{ fontSize: "0.56rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700, marginTop: 2 }}>
          {t.socialWeekXpLabel || "XP"}
        </p>
      </div>
    </li>
  );
}

function EmptyWeekly({ t }) {
  return (
    <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
      <div style={{ fontSize: "2.4rem", marginBottom: "0.5rem" }}>🔥</div>
      <p style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: "0.25rem" }}>
        {t.socialWeeklyEmptyTitle || "Fresh week, zero points."}
      </p>
      <p style={{ fontSize: "0.82rem", color: "var(--color-muted)" }}>
        {t.socialWeeklyEmpty || "Complete a task today and you're on the board."}
      </p>
    </div>
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
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
      {results.map((u) => (
        <li
          key={u.username}
          onClick={() => onOpenProfile(u.username)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.7rem",
            padding: "0.55rem 0.7rem",
            borderRadius: "0.65rem",
            background: "rgba(0,0,0,0.2)",
            border: "1px solid var(--panel-border)",
            cursor: "pointer"
          }}
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

const btnReset = { background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--color-text)" };
