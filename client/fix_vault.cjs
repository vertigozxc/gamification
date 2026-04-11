const fs = require("fs");
const file = "src/components/TokenVault.jsx";
let content = fs.readFileSync(file, "utf8");

const from = `        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "2px solid var(--token-header-border)" }}>
            <h2 className="flex items-center gap-2 cinzel text-xl text-transparent bg-clip-text tracking-[0.18em] uppercase font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>
              {t.tokenSection}
              <div className="relative group inline-block cursor-help z-50">    
                <svg className="w-5 h-5 text-slate-400 hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-xs text-slate-200 rounded border border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left font-sans normal-case tracking-normal shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none">
                  Tokens are earned by achieving new levels and completing daily milestone quests.
                </div>
              </div>
            </h2>
          <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--token-header-border)" }}>`;

const to = `        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "2px solid var(--token-header-border)" }}>
          <div className="flex items-center gap-2">
            <h2 className="cinzel text-xl text-transparent bg-clip-text tracking-[0.18em] uppercase font-bold" style={{ backgroundImage: "var(--heading-gradient)" }}>
              {t.tokenSection}
            </h2>
            <div className="relative group inline-block cursor-help z-50">
              <svg className="w-5 h-5 text-slate-400 hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 text-xs text-slate-200 rounded border border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-left font-sans normal-case tracking-normal shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none">
                Tokens are earned by achieving new levels and completing daily milestone quests. You can use them to freeze your streak or reroll new quests.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--token-header-border)" }}>`;

content = content.replace(from, to);

const exIdx = content.indexOf("export default TokenVault;");
if (exIdx > -1) {
  content = content.substring(0, exIdx + 26) + "\n";
}

fs.writeFileSync(file, content);
console.log("Fixed!");
