import CityIllustration from "./CityIllustration";
import LanguageSelector from "./LanguageSelector";

export default function LoginScreen({ t, handleGoogleLogin, authError, languageId, languageIds, getLanguageMeta, setLanguageId }) {
  return (
    <div className="auth-shell relative w-full h-[100dvh] overflow-hidden flex flex-col" style={{ background: "var(--bg-color)" }}>
      {/* Ambient Background with City Illustration */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-yellow-500/10 rounded-full blur-[100px] opacity-50" />
        <div className="absolute top-[10%] inset-x-0 bottom-0 opacity-[0.15] scale-[1.35] origin-top md:scale-[1.1] md:top-[15%] transition-transform duration-1000 ease-out">
          <CityIllustration height="100%" stage={25} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent h-[60%] top-auto" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent h-[30%]" />
      </div>

      {/* Top Content: Branding */}
      <div className="relative z-10 flex-col items-center justify-start pt-16 flex-none px-6">
        <div className="animate-slide-down text-center">
          <p className="cinzel text-xs tracking-[0.4em] uppercase mb-3" style={{ color: "var(--color-primary-dim)" }}>
            {t.appTagline || "Journey to Greatness"}
          </p>
          <h1 className="cinzel text-5xl md:text-6xl font-black text-transparent bg-clip-text tracking-widest leading-tight" style={{ backgroundImage: "var(--heading-gradient)" }}>
            {t.appTitle}
          </h1>
        </div>
      </div>

      {/* Middle Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center animate-fade-in" style={{ animationDelay: "200ms" }}>
        <p className="text-slate-300 text-lg md:text-xl font-light max-w-md mx-auto leading-relaxed shadow-sm">
          {t.loginHeroTagline || "Turn your daily tasks into an epic adventure. Level up, build habits, and grow your empire."}
        </p>
        <div className="flex gap-4 mt-8 opacity-60">
          <div className="flex flex-col items-center gap-1"><span className="text-2xl">{t.habitsIcon}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Habits</span></div>
          <div className="flex flex-col items-center gap-1"><span className="text-2xl">{t.levelIcon}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Levels</span></div>
          <div className="flex flex-col items-center gap-1"><span className="text-2xl">{t.cityIcon}</span><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">City</span></div>
        </div>
      </div>

      {/* Bottom Content: Auth */}
      <div className="relative z-10 flex-none pb-12 pt-6 px-6 w-full max-w-[420px] mx-auto animate-slide-up" style={{ animationDelay: "300ms", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <div className="rounded-[2rem] p-6 border shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md relative overflow-hidden" style={{ background: "linear-gradient(to bottom, rgba(30,41,59,0.7), rgba(15,23,42,0.9))", borderColor: "var(--color-primary-dim)" }}>
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/20 rounded-full blur-[50px] pointer-events-none" />
          <div className="relative z-10 text-center mb-6">
            <h2 className="cinzel text-2xl text-white font-bold mb-1">{t.loginTitle}</h2>
            <p className="text-slate-400 text-sm">{t.loginSubtitle}</p>
          </div>
          <div className="relative z-10">
            <button
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-lg font-bold transition-all active:scale-[0.98] shadow-lg hover:shadow-yellow-500/20"
              style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
              onClick={handleGoogleLogin}
            >
              <div className="bg-white rounded-full p-1.5 shadow-sm">
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <span>{t.loginButton}</span>
            </button>
            {authError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center animate-fade-in">
                <span className="mr-1">⚠️</span> {authError}
              </div>
            )}
          </div>
          <div className="relative z-10 mt-6 pt-4 border-t border-slate-700/50 flex justify-center">
            <LanguageSelector
              languageId={languageId}
              languageIds={languageIds}
              getLanguageMeta={getLanguageMeta}
              onChange={setLanguageId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
