import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import themes from "../../themeConfig";
import AchievementsSection from "../achievements/AchievementsSection";

function ChevronToggle({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function ProfileTab({
  characterName, editingName, nameDraft, portraitData,
  state, xpPercent, profileStats,
  languageId, themeId, getThemeMeta, getLanguageMeta,
  avatarError, t,
  onAvatarClick, onAvatarErrorClear,
  onStartEditingName, onNameDraftChange, onSubmitNameEdit, onCancelEditingName,
  onOpenThemePicker, onOpenLanguagePicker, onLogout, onDeleteProfile,
  username, onFreezeUsed,
  onOpenAbout,
  onOpenNotesHistory,
  onDeleteConfirmStateChange,
  onAchievementModalChange,
  onRestartTour
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (typeof onDeleteConfirmStateChange === "function") {
      onDeleteConfirmStateChange(showDeleteConfirm);
    }
  }, [showDeleteConfirm, onDeleteConfirmStateChange]);

  useEffect(() => {
    if (!showDeleteConfirm || typeof document === "undefined") return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!showDeleteConfirm || typeof window === "undefined") return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowDeleteConfirm(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showDeleteConfirm]);

  return (
    <div className="mobile-tab-panel flex flex-col gap-4">

      {/* Hero Card: Avatar + Name + Level */}
      <div data-tour="profile-hero" className="city-hero-surface mobile-card top-screen-block p-4 shadow-[0_0_20px_rgba(234,179,8,0.08)]">
        <div className="absolute inset-0 opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative group">
            <button
              type="button"
              className="w-24 h-24 rounded-[1.8rem] overflow-hidden border-2 flex items-center justify-center shrink-0 mobile-pressable transition-all group-hover:border-yellow-500/70"
              style={{ borderColor: "var(--color-primary-dim)", background: "var(--panel-bg)", color: "var(--color-muted)" }}
              onClick={onAvatarClick}
              title={t.changeAvatar}
            >
              {portraitData ? (
                <img src={portraitData} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 opacity-50 text-current">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              )}
            </button>
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shadow-lg" style={{ background: "var(--panel-bg)", borderColor: "var(--card-border-idle)", color: "var(--color-muted)" }}>
              📷
            </div>
          </div>
          <div className="min-w-0 flex-1">
            {!editingName ? (
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="cinzel text-2xl truncate text-transparent bg-clip-text font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>
                    {characterName}
                  </h2>
                  <button
                    className="opacity-70 hover:opacity-100 transition-colors shrink-0" style={{ color: "var(--color-muted)" }}
                    onClick={onStartEditingName}
                    title={t.profileEditNameLabel}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                </div>
                {state.user?.handle ? (
                  <div className="text-xs font-semibold tracking-wide mt-0.5 truncate" style={{ color: "var(--color-muted)" }}>
                    @{state.user.handle}
                  </div>
                ) : null}
              </div>
            ) : (
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => onNameDraftChange(event.target.value)}
                className="w-full max-w-[220px] cinzel text-lg border rounded-xl px-3 py-2"
                style={{ borderColor: "var(--color-primary)" }}
                maxLength={15}
                autoFocus
                onBlur={onSubmitNameEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSubmitNameEdit();
                  if (event.key === "Escape") onCancelEditingName();
                }}
              />
            )}
          </div>
        </div>
        {avatarError && (
          <div className="relative z-10 mt-3 flex items-center gap-2 bg-red-900/40 border border-red-500/40 rounded-xl px-3 py-2 text-red-300 text-xs">
            <span>⚠️</span> {avatarError}
            <button className="ml-auto text-red-400 hover:text-red-200" onClick={onAvatarErrorClear}>✕</button>
          </div>
        )}
      </div>

      {/* Streak Freeze inventory — read-only: charges auto-consume when a
          daily miss would otherwise burn the streak. */}
      <StreakFreezeCard
        t={t}
        charges={Number(state.user?.streakFreezeCharges) || 0}
        streak={state.streak}
        languageId={languageId}
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
          <span className="text-2xl mb-1">{t.logsIcon}</span>
          <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{(() => { 
            let total = state.xp; 
            let threshold = 300; 
            let l = 1;
            while(l < state.lvl && l < 1000) { 
              total += threshold; 
              threshold = Math.floor(threshold * 1.2); 
              l++;
            } 
            return total.toLocaleString(); 
          })()}</p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.totalXpLabel}</p>
        </div>
        <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
          <span className="text-2xl mb-1">{t.streakIcon}</span>
          <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.streak}</p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.currentStreak}</p>
        </div>
        <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
          <span className="text-2xl mb-1">{t.tokenIcon}</span>
          <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.tokens}</p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.tokensLabel}</p>
        </div>
        <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
          <span className="text-2xl mb-1">🏆</span>
          <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.lvl}</p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.levelLabel}</p>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
        <p className="cinzel text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.profileStatisticsTitle}</p>
        <div className="flex flex-col gap-2.5 text-[var(--color-text)]">
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">{t.habitsIcon}</span> {t.profileQuestsCompletedLabel}</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.totalQuestsCompleted ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">{t.streakIcon}</span> {t.profileBestStreakLabel}</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.maxStreak ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">💪</span> {t.profileHabitsBuiltLabel} <span className="text-[9px]" style={{ color: "var(--color-muted)" }}>({t.profileHabitsBuiltHint})</span></span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.builtHabits ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">🤝</span> {t.profileGroupChallengesLabel || "Group challenges completed"}</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.completedGroupChallenges ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">📅</span> {t.profileJoinedLabel}</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.joinedAt ? new Date(profileStats.joinedAt).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Achievements — lives between stats and settings so it's a
          first-class feature, not buried deep. */}
      <div data-tour="profile-achievements">
        <AchievementsSection username={username} t={t} languageId={languageId} onModalOpenChange={onAchievementModalChange} />
      </div>

      {/* Settings — iOS-style grouped table: rows share a card, separated
          by hairline dividers; the card keeps its rounded corners. */}
      <div data-tour="profile-settings" className="mobile-card flex flex-col" style={{ background: "var(--panel-bg)", padding: "12px 0" }}>
        <p className="cinzel text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "var(--color-primary)", padding: "0 16px 8px" }}>{t.profileSettingsTitle}</p>
        <div className="profile-settings-list">
          <button className="profile-settings-row" onClick={onOpenThemePicker}>
            <span className="text-xl w-8 text-center">{themes[themeId].icon}</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{t.themeLabel}</p>
              <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{getThemeMeta(themeId).label}</p>
            </div>
            <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
          </button>
          <button className="profile-settings-row" onClick={onOpenLanguagePicker}>
            <span className="text-xl w-8 text-center">🌐</span>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{t.languageLabel}</p>
              <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{getLanguageMeta(languageId).nativeLabel}</p>
            </div>
            <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
          </button>
          {onOpenNotesHistory ? (
            <button className="profile-settings-row" onClick={onOpenNotesHistory}>
              <span className="text-xl w-8 text-center">📚</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{t.notesHistoryLabel || "My notes"}</p>
                <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{t.notesHistoryHint || "Reflections, gratitude, vocabulary"}</p>
              </div>
              <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
            </button>
          ) : null}
          {onOpenAbout ? (
            <button className="profile-settings-row" onClick={onOpenAbout}>
              <span className="text-xl w-8 text-center">📖</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{t.aboutAppLabel || "About the app"}</p>
                <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{t.aboutAppHint || "Rules, mechanics, formulas"}</p>
              </div>
              <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="mobile-card mobile-pressable flex items-center justify-center gap-2 py-3.5 border border-red-500/30 transition-all hover:bg-red-900/20 active:scale-[0.98]"
        style={{ background: "rgba(127,29,29,0.15)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-400"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        <span className="cinzel font-bold text-sm text-red-400 tracking-wider uppercase">{t.logoutConfirm}</span>
      </button>

      {/* Delete Profile */}
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="mobile-card mobile-pressable w-full flex items-center justify-center gap-2 py-3.5 border border-red-900/40 transition-all hover:bg-red-950/30 active:scale-[0.98]"
        style={{ background: "rgba(60,0,0,0.18)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-700"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
        <span className="cinzel font-bold text-sm text-red-700/80 tracking-wider uppercase">{t.deleteProfileButton || "Delete My Profile"}</span>
      </button>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div
          className="logout-confirm-overlay logout-session-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="logout-confirm-card logout-session-card"
            role="dialog"
            aria-modal="true"
            aria-label={t.deleteProfileTitle || "Delete Profile Permanently?"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="logout-session-halo" aria-hidden="true">
              <div className="logout-confirm-icon logout-session-icon">🗑️</div>
            </div>
            <h3 className="cinzel logout-confirm-title logout-session-title">
              {t.deleteProfileTitle || "Delete Profile Permanently?"}
            </h3>
            <p className="logout-confirm-msg logout-session-msg">
              {t.deleteProfileCannotUndo || "After deletion, recovery is not possible."}
            </p>

            <div className="logout-confirm-actions logout-session-actions">
              <button
                className="logout-confirm-cancel logout-session-cancel cinzel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {languageId === "ru" ? "Оставить" : "Keep"}
              </button>
              <button
                className="logout-confirm-proceed logout-session-proceed cinzel"
                onClick={() => { setShowDeleteConfirm(false); onDeleteProfile && onDeleteProfile(); }}
              >
                {languageId === "ru" ? "Удалить" : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Compact read-only Streak Freeze card. No manual activation — charges
// auto-consume on missed days. Shows current balance with a localized
// days suffix ("20 days" / "20 дней") and an explainer of the automatic
// behavior. No freeze-period card, no activation buttons.
function StreakFreezeCard({ t, charges, streak, languageId }) {
  const safeCharges = Math.max(0, Math.floor(Number(charges) || 0));
  const daysWord = pluralizeDaysLocal(safeCharges, languageId, t);
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <div className="mobile-card" style={{ background: "var(--panel-bg)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="cinzel text-xs font-bold tracking-widest uppercase m-0" style={{ color: "var(--color-primary)" }}>
          ❄️ {t.streakFreezeTitle || "Streak Freeze"}
        </p>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
          {t.streakIcon} {streak}
        </span>
      </div>

      <button
        type="button"
        className="mobile-pressable"
        onClick={() => setHintOpen((v) => !v)}
        aria-expanded={hintOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          width: "100%",
          background: "color-mix(in srgb, #5ba0e0 12%, transparent)",
          border: "1px solid color-mix(in srgb, #5ba0e0 45%, transparent)",
          borderRadius: 12,
          textAlign: "left",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>❄️</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 700 }}>
            {t.streakFreezeCharges || "Charges"}
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#5ba0e0", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {safeCharges}{" "}
            <span style={{ fontSize: 14, fontWeight: 600, color: "color-mix(in srgb, #5ba0e0 70%, var(--color-text))" }}>
              {daysWord}
            </span>
          </span>
        </div>
        <span style={{ flexShrink: 0, color: "color-mix(in srgb, #5ba0e0 80%, var(--color-text))", display: "flex", alignItems: "center" }}>
          <ChevronToggle open={hintOpen} />
        </span>
      </button>

      <div
        style={{
          maxHeight: hintOpen ? 240 : 0,
          opacity: hintOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease, margin-top 260ms cubic-bezier(0.4, 0, 0.2, 1)",
          marginTop: hintOpen ? 12 : 0,
          willChange: "max-height, opacity",
        }}
        aria-hidden={!hintOpen}
      >
        <p
          className="m-0"
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: "var(--color-muted)",
            padding: "10px 12px",
            background: "color-mix(in srgb, #5ba0e0 6%, transparent)",
            borderRadius: 10,
            borderLeft: "3px solid color-mix(in srgb, #5ba0e0 55%, transparent)",
          }}
        >
          {t.streakFreezeAutoHint
            || "If you miss a day, 1 charge is spent automatically and your streak survives — no action needed. When charges hit 0, the next miss burns the streak."}
        </p>
      </div>
    </div>
  );
}

// Russian-aware day pluralizer, local to this file — avoids pulling
// the global pluralize helper into this tab bundle just for one label.
function pluralizeDaysLocal(n, languageId, t) {
  if (languageId === "ru") {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t.daysFormOne || "день";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t.daysFormFew || "дня";
    return t.daysFormMany || "дней";
  }
  return n === 1 ? (t.daysFormOne || "day") : (t.daysFormMany || "days");
}
