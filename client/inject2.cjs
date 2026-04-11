const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');
const searchString = '{t.resetProgress}';
const btnIndex = app.indexOf(searchString);
const buttonEndIndex = app.indexOf('</button>', btnIndex) + 9;

const analyticsBtn = `
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="text-xs px-3 py-1 rounded-full border border-blue-600 bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors font-bold uppercase tracking-wider"
            >
              Analytics 📈
            </button>`;

if (btnIndex !== -1 && !app.includes("setIsAnalyticsOpen(true)")) {
  app = app.substring(0, buttonEndIndex) + '\n' + analyticsBtn + app.substring(buttonEndIndex);
  fs.writeFileSync('src/App.jsx', app);
  console.log('Button injected using substring');
} else {
  console.log('Button already exists or tag not found');
}