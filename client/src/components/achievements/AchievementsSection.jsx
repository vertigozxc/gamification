import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchAchievements, claimAchievement, fetchAchievementStats } from "../../api";
import { ACHIEVEMENT_ICONS } from "./icons";

// Ordered for display. Keep in sync with server/src/achievements.js.
// Level / streak milestones come first (clearest "I made it that far"
// signal), then social, spending, language, and the city/quiz endcaps.
const ACHIEVEMENT_ORDER = [
  "week_warrior",
  "month_monk",
  "hundred_club",
  "lvl_10",
  "lvl_30",
  "lvl_100",
  "first_handshake",
  "champion",
  "mentor",
  "first_coin",
  "high_roller",
  "polyglot",
  "phoenix",
  "scholar"
];

// Format a percent for the popup. Below 0.1% we collapse the noise to
// a single "rare achievement" callout per the design.
function formatPercent(p, t) {
  const num = Number(p);
  if (!Number.isFinite(num) || num <= 0) {
    return t.achievementStatRare || "Less than 0.1% of players";
  }
  if (num < 0.1) return t.achievementStatRare || "Less than 0.1% of players";
  if (num < 10) {
    const fixed = num.toFixed(1).replace(/\.0$/, "");
    const tpl = t.achievementStatPercent || "Unlocked by {percent}% of players";
    return tpl.replace("{percent}", fixed);
  }
  const tpl = t.achievementStatPercent || "Unlocked by {percent}% of players";
  return tpl.replace("{percent}", String(Math.round(num)));
}

function getMeta(code, t) {
  const names = {
    week_warrior: t.achWeekWarriorName,
    month_monk: t.achMonthMonkName,
    hundred_club: t.achHundredClubName,
    lvl_10: t.achLvl10Name,
    lvl_30: t.achLvl30Name,
    lvl_100: t.achLvl100Name,
    first_handshake: t.achFirstHandshakeName,
    champion: t.achChampionName,
    mentor: t.achMentorName,
    first_coin: t.achFirstCoinName,
    high_roller: t.achHighRollerName,
    polyglot: t.achPolyglotName,
    phoenix: t.achPhoenixName,
    scholar: t.achScholarName
  };
  const descs = {
    week_warrior: t.achWeekWarriorDesc,
    month_monk: t.achMonthMonkDesc,
    hundred_club: t.achHundredClubDesc,
    lvl_10: t.achLvl10Desc,
    lvl_30: t.achLvl30Desc,
    lvl_100: t.achLvl100Desc,
    first_handshake: t.achFirstHandshakeDesc,
    champion: t.achChampionDesc,
    mentor: t.achMentorDesc,
    first_coin: t.achFirstCoinDesc,
    high_roller: t.achHighRollerDesc,
    polyglot: t.achPolyglotDesc,
    phoenix: t.achPhoenixDesc,
    scholar: t.achScholarDesc
  };
  return { name: names[code] || code, description: descs[code] || "" };
}

function formatDate(value, languageId) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "";
  }
}

export default function AchievementsSection({ username, t, languageId, onModalOpenChange, prefetched, onTokensClaimed }) {
  const [data, setData] = useState(prefetched || null);
  const [loading, setLoading] = useState(!prefetched);
  const [focused, setFocused] = useState(null);
  const [expanded, setExpanded] = useState(false);
  // Per-code unlock-rate stats from /api/achievements/stats. Loaded
  // lazily on first popup open to avoid an extra request on profile
  // tab mount when nobody opens the popup at all.
  const [stats, setStats] = useState(null);

  // Report modal open/close upstream so the native shell can hide the
  // bottom tab bar, matching theme/language picker behavior.
  useEffect(() => {
    if (typeof onModalOpenChange === "function") onModalOpenChange(Boolean(focused));
    return () => {
      if (typeof onModalOpenChange === "function") onModalOpenChange(false);
    };
  }, [focused, onModalOpenChange]);

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetchAchievements(username);
      setData(res);
    } catch {
      setData({ achievements: [], unlockedCount: 0, total: ACHIEVEMENT_ORDER.length });
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    // If data was prefetched upstream (e.g. ProfileScreen holds the load
    // until both profile + achievements resolve), skip the internal fetch
    // and just mirror the incoming value on change.
    if (prefetched) {
      setData(prefetched);
      setLoading(false);
      return;
    }
    load();
  }, [load, prefetched]);

  // Fetch stats on first popup open (or when expanded). The /achievements/stats
  // endpoint is cached server-side for 10 minutes so this is cheap, but we
  // don't fire it on every mount of the Profile tab.
  useEffect(() => {
    if (!focused && !expanded) return undefined;
    if (stats) return undefined;
    let cancelled = false;
    fetchAchievementStats()
      .then((resp) => {
        if (!cancelled) setStats(resp || null);
      })
      .catch(() => {
        if (!cancelled) setStats({ stats: {} });
      });
    return () => { cancelled = true; };
  }, [focused, expanded, stats]);

  const handleClaim = useCallback(async (code) => {
    if (!username) return null;
    try {
      const resp = await claimAchievement(username, code);
      const granted = Number(resp?.tokensGranted) || 0;
      // Optimistic local update so the popup transitions to "claimed"
      // without waiting for a refetch round-trip.
      setData((prev) => {
        if (!prev?.achievements) return prev;
        return {
          ...prev,
          achievements: prev.achievements.map((a) =>
            a.code === code ? { ...a, claimedAt: resp?.claimedAt || new Date().toISOString() } : a
          )
        };
      });
      if (granted > 0 && typeof onTokensClaimed === "function") {
        onTokensClaimed(granted);
      }
      return resp;
    } catch (err) {
      return { error: err?.data?.error || err?.message || "Failed" };
    }
  }, [username, onTokensClaimed]);

  const byCode = new Map((data?.achievements || []).map((a) => [a.code, a]));
  const ordered = ACHIEVEMENT_ORDER.map((code) => byCode.get(code) || { code, unlocked: false, unlockedAt: null });
  const unlockedCount = ordered.filter((a) => a.unlocked).length;
  const total = ordered.length;

  return (
    <div className="mobile-card flex flex-col" style={{ background: "var(--panel-bg)" }}>
      <button
        type="button"
        className="mobile-pressable flex items-center justify-between w-full"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "inherit", textAlign: "left" }}
      >
        <p className="cinzel text-xs font-bold tracking-widest uppercase m-0" style={{ color: "var(--color-primary)" }}>
          🏅 {t.achievementsTitle || "Achievements"}
        </p>
        <span className="flex items-center gap-2">
          <span
            className="cinzel text-[11px] font-bold px-2 py-0.5 rounded-full border"
            style={{
              color: "var(--color-primary)",
              borderColor: "var(--color-primary-dim)",
              background: "color-mix(in srgb, var(--color-primary) 10%, transparent)"
            }}
          >
            {unlockedCount}/{total}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", color: "var(--color-muted)" }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <div
        style={{
          // 14 achievements in a 5-col grid → 3 rows. ~74px row + 8px gap
          // → ~250px content + 12px paddingTop = 262px. Bumped to 480 to
          // leave headroom for one extra row if we add more later.
          maxHeight: expanded ? 480 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease, padding-top 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          paddingTop: expanded ? 12 : 0,
          willChange: "max-height, opacity",
        }}
        aria-hidden={!expanded}
      >
      <div className="grid grid-cols-5 gap-2">
        {ordered.map((item) => {
          const Icon = ACHIEVEMENT_ICONS[item.code];
          const meta = getMeta(item.code, t);
          const locked = !item.unlocked;
          const claimed = !!item.claimedAt;
          return (
            <button
              key={item.code}
              type="button"
              className="mobile-pressable relative flex flex-col items-center gap-1 rounded-xl p-1.5 border transition-all"
              style={{
                background: locked
                  ? "color-mix(in srgb, var(--panel-bg) 80%, #000 20%)"
                  : "color-mix(in srgb, var(--color-primary) 10%, var(--panel-bg))",
                borderColor: locked
                  ? "var(--panel-border)"
                  : "color-mix(in srgb, var(--color-primary) 55%, transparent)",
                boxShadow: locked ? "none" : "0 0 12px color-mix(in srgb, var(--color-primary) 25%, transparent)"
              }}
              onClick={() => setFocused(item.code)}
              aria-label={locked ? (t.achievementLockedHint || "Locked") : meta.name}
            >
              <span
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  display: "block",
                  filter: locked ? "grayscale(1) brightness(0.35) contrast(0.85)" : "none",
                  opacity: locked ? 0.55 : 1
                }}
              >
                {Icon ? <Icon /> : null}
              </span>
              {claimed ? (
                // Top-left ✓ badge — fires only when the user actually
                // claimed the token reward, not just when the achievement
                // is unlocked. Apple-style green check on a soft chip.
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 4,
                    left: 4,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #4ade80, #16a34a)",
                    border: "1.5px solid #bbf7d0",
                    boxShadow: "0 2px 6px rgba(22,163,74,0.45)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#04201a",
                    pointerEvents: "none"
                  }}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 8.5 6.5 12 13 5" />
                  </svg>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      </div>

      {expanded && loading && !data ? (
        <p className="text-[11px] text-center opacity-60" style={{ color: "var(--color-muted)" }}>…</p>
      ) : null}

      {focused && createPortal(
        <AchievementModal
          code={focused}
          entry={ordered.find((a) => a.code === focused)}
          stats={stats?.stats?.[focused] || null}
          t={t}
          languageId={languageId}
          onClaim={handleClaim}
          onClose={() => setFocused(null)}
        />,
        document.body
      )}
    </div>
  );
}

function AchievementModal({ code, entry, stats, t, languageId, onClaim, onClose }) {
  const Icon = ACHIEVEMENT_ICONS[code];
  const meta = getMeta(code, t);
  const locked = !entry?.unlocked;
  const claimed = !!entry?.claimedAt;
  const reward = Number(entry?.tokensReward) || 0;
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [justClaimedAt, setJustClaimedAt] = useState(null);

  // Effective claimedAt — prefer the local optimistic timestamp set
  // right after a successful Claim click, otherwise fall back to the
  // server-supplied value. Lets the popup transition state in-place
  // without waiting for a refetch.
  const effectiveClaimedAt = entry?.claimedAt || justClaimedAt;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleClaimClick = async () => {
    if (claiming || locked || effectiveClaimedAt) return;
    setClaiming(true);
    setClaimError("");
    const resp = await onClaim?.(code);
    if (resp?.error) {
      setClaimError(resp.error);
    } else {
      setJustClaimedAt(resp?.claimedAt || new Date().toISOString());
    }
    setClaiming(false);
  };

  const showClaimCta = !locked && !effectiveClaimedAt && reward > 0;
  const showClaimedRow = !locked && !!effectiveClaimedAt && reward > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.74)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="mobile-card"
        style={{
          background: "var(--card-bg, var(--panel-bg))",
          border: `1px solid ${locked ? "var(--panel-border)" : "color-mix(in srgb, var(--color-primary) 55%, transparent)"}`,
          borderRadius: 20,
          padding: "20px 20px 18px",
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 12,
          boxShadow: locked ? "none" : "0 0 30px color-mix(in srgb, var(--color-primary) 35%, transparent)",
          position: "relative"
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.closeLabel || "Close"}
          className="ui-close-x"
          style={{ position: "absolute", top: 10, right: 10 }}
        >
          ✕
        </button>

        {/* Icon hero with optional claimed-corner ✓ */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
          <div style={{ position: "relative", width: 116, height: 116 }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                filter: locked ? "grayscale(1) brightness(0.35)" : "none",
                opacity: locked ? 0.55 : 1
              }}
            >
              {Icon ? <Icon /> : null}
            </div>
            {showClaimedRow ? (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #4ade80, #16a34a)",
                  border: "2px solid #bbf7d0",
                  boxShadow: "0 4px 12px rgba(22,163,74,0.55)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#04201a"
                }}
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 8.5 6.5 12 13 5" />
                </svg>
              </span>
            ) : null}
          </div>
        </div>

        <h3 className="cinzel text-lg font-bold text-center m-0" style={{ color: locked ? "var(--color-muted)" : "var(--color-primary)" }}>
          {locked ? (t.achievementLockedTitle || "Locked") : meta.name}
        </h3>
        <p className="text-sm text-center m-0" style={{ color: "var(--color-text)", lineHeight: 1.5 }}>
          {meta.description}
        </p>

        {/* Stats line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 12,
            background: "color-mix(in srgb, var(--panel-bg) 70%, rgba(255,255,255,0.04))",
            border: "1px solid var(--panel-border)",
            color: "var(--color-muted)",
            fontSize: 12,
            fontWeight: 600
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18" />
            <path d="M12 3a14 14 0 0 0 0 18" />
          </svg>
          <span>{stats ? formatPercent(stats.percent, t) : (t.achievementStatLoading || "Loading…")}</span>
        </div>

        {/* Reward / claim CTA / claimed row */}
        {reward > 0 ? (
          <>
            {locked ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "color-mix(in srgb, var(--panel-bg) 70%, rgba(255,255,255,0.04))",
                  border: "1px dashed var(--panel-border)",
                  opacity: 0.7
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted)" }}>
                  {t.achievementRewardLabel || "Reward"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>
                  +{reward} {t.tokenIcon || "🪙"}
                </span>
              </div>
            ) : showClaimCta ? (
              <button
                type="button"
                onClick={handleClaimClick}
                disabled={claiming}
                className="mobile-pressable cinzel"
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: 14,
                  border: "1.5px solid color-mix(in srgb, var(--color-primary) 65%, transparent)",
                  background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 28%, transparent), color-mix(in srgb, var(--color-primary) 18%, transparent))",
                  color: "var(--color-primary)",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: claiming ? "wait" : "pointer",
                  opacity: claiming ? 0.7 : 1,
                  boxShadow: "0 4px 18px color-mix(in srgb, var(--color-primary) 25%, transparent)"
                }}
              >
                {claiming
                  ? (t.achievementClaiming || "Claiming…")
                  : `${t.achievementClaimCta || "Claim"} +${reward} ${t.tokenIcon || "🪙"}`}
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "color-mix(in srgb, #4ade80 12%, transparent)",
                  border: "1px solid color-mix(in srgb, #4ade80 50%, transparent)",
                  color: "#bbf7d0",
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 8.5 6.5 12 13 5" />
                </svg>
                <span>
                  {(t.achievementClaimedLabel || "Claimed")} · +{reward} {t.tokenIcon || "🪙"}
                </span>
              </div>
            )}
          </>
        ) : null}

        {claimError ? (
          <p className="text-[11px] m-0" style={{ color: "#fca5a5", textAlign: "center" }}>
            {claimError}
          </p>
        ) : null}

        {/* Footer dates */}
        {(entry?.unlockedAt || effectiveClaimedAt) ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginTop: 2 }}>
            {entry?.unlockedAt ? (
              <p className="text-[11px] m-0" style={{ color: "var(--color-muted)" }}>
                {t.achievementUnlockedOn || "Unlocked on"} {formatDate(entry.unlockedAt, languageId)}
              </p>
            ) : null}
            {effectiveClaimedAt ? (
              <p className="text-[11px] m-0" style={{ color: "var(--color-muted)" }}>
                {t.achievementClaimedOn || "Claimed on"} {formatDate(effectiveClaimedAt, languageId)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
