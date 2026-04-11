const fs = require('fs');
const file = 'C:/Users/User/Desktop/gamification/client/src/App.jsx';
let str = fs.readFileSync(file, 'utf8');

const regex = /if \(!authUser\) \{\s*return \(\s*<div className="auth-shell">[\s\S]+?<\/div>\s*\);\s*\}/;

const replacement = `if (!authUser) {
    return (
      <div className="auth-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
        <div className="w-full max-w-5xl px-6 py-12 flex flex-col items-center">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="cinzel text-5xl md:text-7xl font-black text-transparent bg-clip-text tracking-widest leading-tight mb-4" style={{ backgroundImage: "var(--heading-gradient)" }}>{t.appTitle}</h1>
            <p className="cinzel text-xl tracking-[0.25em] uppercase" style={{ color: "var(--color-primary-dim)" }}>Turn Your Life into an Epic Adventure</p>
          </div>

          <div className="auth-card animate-fade-in w-full max-w-md mx-auto mb-16 text-center">
            <p className="cinzel text-xs tracking-[0.35em] uppercase mb-4" style={{ color: "var(--color-primary)" }}>{t.appTagline}</p>
            <h2 className="cinzel text-3xl text-white mb-3">{t.loginTitle}</h2>
            <p className="text-slate-300 mb-8">{t.loginSubtitle}</p>
            <button className="google-btn w-full justify-center py-4 text-lg" onClick={handleGoogleLogin}>
              <span>G</span>
              <span>{t.loginButton}</span>
            </button>
            {authError && <p className="auth-error mt-4">{authError}</p>}
            {/* Theme Picker Removed */}
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-center shadow-xl">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="cinzel text-xl text-white mb-2">Build Habits</h3>
              <p className="text-slate-400 text-sm">Complete real-world daily quests to earn experience, maintain your streak, and build discipline.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-center shadow-xl">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="cinzel text-xl text-white mb-2">Level Up</h3>
              <p className="text-slate-400 text-sm">Gain XP, climb the leaderboards, and prove your dedication as your stage and rank increase.</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 text-center shadow-xl">
              <div className="text-4xl mb-4">🌆</div>
              <h3 className="cinzel text-xl text-white mb-2">Grow Your City</h3>
              <p className="text-slate-400 text-sm">Watch your personal digital realm transform from an empty plot to a thriving metropolis as you reach higher stages.</p>
            </div>
          </div>

          <div className="w-full mb-12">
            <h2 className="cinzel text-3xl text-center text-white mb-8">Witness Your Growth</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4">
                <p className="cinzel text-center text-yellow-500 mb-2">Stage 1</p>
                <div className="w-full h-48 bg-black rounded-lg overflow-hidden relative">
                  <CityIllustration height="100%" stage={1} />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4">
                <p className="cinzel text-center text-yellow-500 mb-2">Stage 10</p>
                <div className="w-full h-48 bg-black rounded-lg overflow-hidden relative">
                  <CityIllustration height="100%" stage={10} />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4">
                <p className="cinzel text-center text-yellow-500 mb-2">Stage 20+</p>
                <div className="w-full h-48 bg-black rounded-lg overflow-hidden relative">
                  <CityIllustration height="100%" stage={25} />
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    );
  }`;

str = str.replace(regex, replacement);
fs.writeFileSync(file, str, 'utf8');
