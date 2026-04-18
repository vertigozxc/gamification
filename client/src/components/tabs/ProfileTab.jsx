import themes from "../../themeConfig";

export default function ProfileTab({
  characterName, editingName, nameDraft, portraitData,
  state, xpPercent, profileStats,
  languageId, themeId, getThemeMeta, getLanguageMeta,
  avatarError, t,
  onAvatarClick, onAvatarErrorClear,
  onStartEditingName, onNameDraftChange, onSubmitNameEdit, onCancelEditingName,
  onOpenThemePicker, onOpenLanguagePicker, onLogout
}) {
  return (
    <div className="mobile-tab-panel flex flex-col gap-4">

      {/* Hero Card: Avatar + Name + Level */}
      <div className="relative overflow-hidden mobile-card top-screen-block shadow-[0_0_20px_rgba(234,179,8,0.08)]" style={{ background: "var(--card-bg)" }}>
        <div className="absolute inset-0 opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
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
              <div className="flex items-center gap-2">
                <h2 className="cinzel text-2xl truncate text-transparent bg-clip-text font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>
                  {characterName}
                </h2>
                <button
                  className="opacity-70 hover:opacity-100 transition-colors shrink-0" style={{ color: "var(--color-muted)" }}
                  onClick={onStartEditingName}
                  title="Edit name"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
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
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm" style={{ background: "var(--panel-bg)", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                {t.levelShort} {state.lvl}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm" style={{ background: "var(--panel-bg)", borderColor: "var(--color-primary)", color: "var(--color-text)" }}>
                {t.streakIcon} {state.streak}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm" style={{ background: "var(--panel-bg)", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}>
                {t.tokenIcon} {state.tokens}
              </span>
            </div>
          </div>
        </div>
        {avatarError && (
          <div className="relative z-10 mt-3 flex items-center gap-2 bg-red-900/40 border border-red-500/40 rounded-xl px-3 py-2 text-red-300 text-xs">
            <span>⚠️</span> {avatarError}
            <button className="ml-auto text-red-400 hover:text-red-200" onClick={onAvatarErrorClear}>✕</button>
          </div>
        )}
      </div>

      {/* XP Progress */}
      <div className="mobile-card" style={{ background: "var(--panel-bg)" }}>
        <div className="flex justify-between items-center mb-2">
          <p className="cinzel text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>{t.levelProgress}</p>
          <span className="cinzel text-xs opacity-80" style={{ color: "var(--color-text)" }}>{state.xp} / {state.xpNext} {t.xpLabel}</span>
        </div>
        <div className="w-full bg-black/50 rounded-full border border-yellow-700/30 overflow-hidden h-3">
          <div className="bar-fill h-full rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <span className="cinzel text-[10px]" style={{ color: "var(--color-primary)" }}>{t.levelShort} {state.lvl}</span>
          <span className="cinzel text-[10px] opacity-70" style={{ color: "var(--color-muted)" }}>{t.levelShort} {state.lvl + 1}</span>
        </div>
      </div>

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
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>Tokens</p>
        </div>
        <div className="mobile-card flex flex-col items-center py-4" style={{ background: "var(--panel-bg)" }}>
          <span className="text-2xl mb-1">🏆</span>
          <p className="cinzel text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{state.lvl}</p>
          <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>{t.levelLabel}</p>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="mobile-card flex flex-col gap-3" style={{ background: "var(--panel-bg)" }}>
        <p className="cinzel text-xs font-bold tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>Statistics</p>
        <div className="flex flex-col gap-2.5 text-[var(--color-text)]">
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">{t.habitsIcon}</span> Quests Completed</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.totalQuestsCompleted ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">{t.streakIcon}</span> Best Streak</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.maxStreak ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">💪</span> Habits Built <span className="text-[9px]" style={{ color: "var(--color-muted)" }}>(21+ days)</span></span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.builtHabits ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--panel-border)]">
            <span className="flex items-center gap-2 text-sm"><span className="text-lg">📅</span> Joined</span>
            <span className="cinzel font-bold text-sm" style={{ color: "var(--color-primary)" }}>{profileStats?.joinedAt ? new Date(profileStats.joinedAt).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="mobile-card flex flex-col gap-1" style={{ background: "var(--panel-bg)" }}>
        <p className="cinzel text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--color-primary)" }}>Settings</p>
        <button className="flex items-center gap-3 w-full rounded-xl px-3 py-3 transition-all hover:bg-[var(--card-hover)] active:scale-[0.98]" onClick={onOpenThemePicker}>
          <span className="text-xl w-8 text-center">{themes[themeId].icon}</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Theme</p>
            <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{getThemeMeta(themeId).label}</p>
          </div>
          <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
        </button>
        <button className="flex items-center gap-3 w-full rounded-xl px-3 py-3 transition-all hover:bg-[var(--card-hover)] active:scale-[0.98]" onClick={onOpenLanguagePicker}>
          <span className="text-xl w-8 text-center">🌐</span>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>Language</p>
            <p className="text-[11px] opacity-70" style={{ color: "var(--color-muted)" }}>{getLanguageMeta(languageId).nativeLabel}</p>
          </div>
          <span className="opacity-70 text-sm" style={{ color: "var(--color-muted)" }}>›</span>
        </button>
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
    </div>
  );
}
