import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchAchievements } from "../../api";
import { ACHIEVEMENT_ICONS } from "./icons";

// Ordered for display. Keep in sync with server/src/achievements.js.
const ACHIEVEMENT_ORDER = [
  "week_warrior",
  "month_monk",
  "hundred_club",
  "first_handshake",
  "champion",
  "mentor",
  "first_coin",
  "high_roller",
  "polyglot",
  "phoenix"
];

function getMeta(code, t) {
  const names = {
    week_warrior: t.achWeekWarriorName,
    month_monk: t.achMonthMonkName,
    hundred_club: t.achHundredClubName,
    first_handshake: t.achFirstHandshakeName,
    champion: t.achChampionName,
    mentor: t.achMentorName,
    first_coin: t.achFirstCoinName,
    high_roller: t.achHighRollerName,
    polyglot: t.achPolyglotName,
    phoenix: t.achPhoenixName
  };
  const descs = {
    week_warrior: t.achWeekWarriorDesc,
    month_monk: t.achMonthMonkDesc,
    hundred_club: t.achHundredClubDesc,
    first_handshake: t.achFirstHandshakeDesc,
    champion: t.achChampionDesc,
    mentor: t.achMentorDesc,
    first_coin: t.achFirstCoinDesc,
    high_roller: t.achHighRollerDesc,
    polyglot: t.achPolyglotDesc,
    phoenix: t.achPhoenixDesc
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

export default function AchievementsSection({ username, t, languageId, onModalOpenChange, prefetched }) {
  const [data, setData] = useState(prefetched || null);
  const [loading, setLoading] = useState(!prefetched);
  const [focused, setFocused] = useState(null);

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

  const byCode = new Map((data?.achievements || []).map((a) => [a.code, a]));
  const ordered = ACHIEVEMENT_ORDER.map((code) => byCode.get(code) || { code, unlocked: false, unlockedAt: null });
  const unlockedCount = ordered.filter((a) => a.unlocked).length;
  const total = ordered.length;

  return (
    <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
      <div className="flex items-center justify-between">
        <p className="cinzel text-xs font-bold tracking-widest uppercase m-0" style={{ color: "var(--color-primary)" }}>
          🏅 {t.achievementsTitle || "Achievements"}
        </p>
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
      </div>

      <div className="grid grid-cols-5 gap-2">
        {ordered.map((item) => {
          const Icon = ACHIEVEMENT_ICONS[item.code];
          const meta = getMeta(item.code, t);
          const locked = !item.unlocked;
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
            </button>
          );
        })}
      </div>

      {loading && !data ? (
        <p className="text-[11px] text-center opacity-60" style={{ color: "var(--color-muted)" }}>…</p>
      ) : null}

      {focused && createPortal(
        <AchievementModal
          code={focused}
          entry={ordered.find((a) => a.code === focused)}
          t={t}
          languageId={languageId}
          onClose={() => setFocused(null)}
        />,
        document.body
      )}
    </div>
  );
}

function AchievementModal({ code, entry, t, languageId, onClose }) {
  const Icon = ACHIEVEMENT_ICONS[code];
  const meta = getMeta(code, t);
  const locked = !entry?.unlocked;

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

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
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
          padding: 22,
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          boxShadow: locked ? "none" : "0 0 30px color-mix(in srgb, var(--color-primary) 35%, transparent)"
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            filter: locked ? "grayscale(1) brightness(0.35)" : "none",
            opacity: locked ? 0.55 : 1
          }}
        >
          {Icon ? <Icon /> : null}
        </div>
        <h3 className="cinzel text-lg font-bold text-center m-0" style={{ color: locked ? "var(--color-muted)" : "var(--color-primary)" }}>
          {locked ? (t.achievementLockedTitle || "Locked") : meta.name}
        </h3>
        <p className="text-sm text-center m-0" style={{ color: "var(--color-text)", lineHeight: 1.5 }}>
          {meta.description}
        </p>
        {entry?.unlocked && entry.unlockedAt ? (
          <p className="text-[11px] m-0" style={{ color: "var(--color-muted)" }}>
            {t.achievementUnlockedOn || "Unlocked on"} {formatDate(entry.unlockedAt, languageId)}
          </p>
        ) : null}
        <button
          type="button"
          className="mobile-pressable cinzel text-xs font-bold px-4 py-2 rounded-full mt-1"
          style={{
            background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
            color: "var(--color-primary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}
          onClick={onClose}
        >
          {t.closeLabel || t.cancelLabel || "Close"}
        </button>
      </div>
    </div>
  );
}
