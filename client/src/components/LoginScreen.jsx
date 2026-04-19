import LanguageSelector from "./LanguageSelector";
import { Flame, Target, TrendingUp, Castle } from "lucide-react";

export default function LoginScreen({ t, handleGoogleLogin, authError, languageId, languageIds, getLanguageMeta, setLanguageId }) {
  return (
    <div className="auth-shell relative w-full h-[100dvh] overflow-hidden flex flex-col" style={{ background: "var(--bg-color)" }}>
      {/* Ambient Background matching the new Flame icon style */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" style={{ backgroundColor: "#080A0E" }}>
        {/* Glows representing the flame colors */}
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-[140px] opacity-40 mix-blend-screen" style={{ background: "radial-gradient(circle, #D12200 0%, transparent 70%)" }} />
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[100px] opacity-40 mix-blend-screen" style={{ background: "radial-gradient(circle, #FF7B00 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[80px] opacity-50 mix-blend-screen" style={{ background: "radial-gradient(circle, #FFCE44 0%, transparent 70%)" }} />
        
        {/* Large subtle flame icon in the background */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 opacity-[0.03] scale-[4.5] md:scale-[3.5] origin-center text-[#FFCE44]">
          <Flame size={240} strokeWidth={0.5} />
        </div>

        {/* Gradients to fade out top and bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080A0E] via-[#080A0E]/80 to-transparent h-[70%] top-auto" />
      </div>

      {/* Top Content: Branding */}
      <div className="relative z-10 flex-col items-center justify-start pt-16 flex-none px-6">
        <div className="animate-slide-down text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 backdrop-blur-sm mb-4">
            <Flame className="text-orange-400 w-3 h-3" />
            <span className="text-orange-200 text-[10px] font-bold tracking-[0.22em] uppercase">{t.loginEngineBadge}</span>
          </div>
          <p className="cinzel text-xs tracking-[0.36em] uppercase mb-3" style={{ color: "var(--color-primary-dim)" }}>
            {t.appTagline}
          </p>
          <h1 className="cinzel text-[3.15rem] md:text-6xl font-black text-transparent bg-clip-text tracking-[0.14em] leading-tight" style={{ backgroundImage: "linear-gradient(135deg, #FFCE44, #FF7B00 50%, #D12200)" }}>
            {t.loginBrandTitle}
          </h1>
        </div>
      </div>

      {/* Middle Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-8 text-center animate-fade-in" style={{ animationDelay: "200ms" }}>
        <p className="text-slate-200 text-lg md:text-xl font-medium max-w-md mx-auto leading-relaxed shadow-sm">
          {t.loginHeroTagline}
        </p>
        <div className="flex justify-center flex-wrap gap-6 md:gap-8 mt-8 opacity-80">
          <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-orange-500/30 bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(255,123,0,0.15)]"><Target size={24} /></div><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{t.loginFeatureHabits}</span></div>
          <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-orange-500/30 bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(255,123,0,0.15)]"><TrendingUp size={24} /></div><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{t.loginFeatureLevels}</span></div>
          <div className="flex flex-col items-center gap-2"><div className="w-12 h-12 rounded-full border border-orange-500/30 bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-[0_0_15px_rgba(255,123,0,0.15)]"><Castle size={24} /></div><span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{t.loginFeatureCity}</span></div>
        </div>
      </div>

      {/* Bottom Content: Auth */}
      <div className="relative z-10 flex-none pb-12 pt-6 px-6 w-full max-w-[420px] mx-auto animate-slide-up" style={{ animationDelay: "300ms", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <div className="rounded-[2rem] p-6 border shadow-[0_0_44px_rgba(255,123,0,0.15)] backdrop-blur-md relative overflow-hidden" style={{ background: "linear-gradient(to bottom, rgba(20,23,30,0.85), rgba(8,10,14,0.95))", borderColor: "rgba(255, 123, 0, 0.25)" }}>
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/20 rounded-full blur-[50px] pointer-events-none" />
          <div className="relative z-10 text-center mb-6">
            <h2 className="cinzel text-2xl text-white font-bold mb-1">{t.loginTitle}</h2>
            <p className="text-slate-400 text-sm">{t.loginSubtitle}</p>
          </div>
          <div className="relative z-10">
            <button
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl text-lg font-bold transition-all active:scale-[0.98] shadow-lg hover:shadow-orange-500/20"
              style={{ background: "linear-gradient(135deg, #14171E, #080A0E)", border: "1px solid rgba(255, 123, 0, 0.4)", color: "var(--color-primary)" }}
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
              direction="up"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
