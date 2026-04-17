import themes from "../themeConfig";

export default function AppHeader({
  portraitUploadRef,
  portraitData,
  characterName,
  authUser,
  themeId,
  t,
  languageShortLabel,
  onOpenThemePicker,
  onOpenLanguagePicker,
  onLogout
}) {
  return (
    <>
      <div className="w-full flex items-center justify-end gap-2 user-auth-widget flex-wrap">
        <div className="flex items-center gap-1">
          <div className="theme-selector" style={{ position: "relative" }}>
            <button className="theme-picker-trigger" onClick={onOpenThemePicker}>
              <span>{themes[themeId].icon}</span> {t.chooseThemeButtonLabel}
              <span className="ml-1 text-xs opacity-60">▾</span>
            </button>
          </div>
          <div className="theme-selector" style={{ position: "relative" }}>
            <button className="theme-picker-trigger" onClick={onOpenLanguagePicker}>
              <span>🌐</span> {languageShortLabel}
              <span className="ml-1 text-xs opacity-60">▾</span>
            </button>
          </div>
        </div>
        <div 
          className="flex items-center gap-2 bg-slate-900/70 rounded-full pl-1 pr-3 py-1 cursor-pointer hover:opacity-80 transition-colors"
          style={{ color: "var(--color-text)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--panel-border)" }}
          onClick={() => portraitUploadRef.current?.click()}
          title={t.changeAvatar}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center border" style={{ borderColor: "var(--panel-border)" }}>
            {portraitData ? (
              <img src={portraitData} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-60">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </div>
          <span className="text-xs font-semibold max-w-[100px] truncate">{characterName || authUser.displayName || authUser.email}</span>
        </div>
        <button className="logout-btn" onClick={onLogout}>{t.logoutConfirm}</button>
      </div>
      <div className="w-full flex items-center justify-center gap-4">
        <div className="hidden sm:flex flex-1 items-center gap-2">
          <div className="h-px flex-1 opacity-60" style={{ background: `linear-gradient(to right, transparent, var(--color-primary))` }} />
        </div>
        <div className="text-center">
          <h1 className="cinzel text-2xl md:text-3xl font-bold text-transparent bg-clip-text tracking-widest leading-tight" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.appTitle}</h1>
          <p className="cinzel text-[10px] tracking-[0.25em] uppercase mt-0.5" style={{ color: "var(--color-primary-dim)" }}>{t.appSubtitle}</p>
        </div>
        <div className="hidden sm:flex flex-1 items-center gap-2">
          <div className="h-px flex-1 opacity-60" style={{ background: `linear-gradient(to left, transparent, var(--color-primary))` }} />
        </div>
      </div>
    </>
  );
}
