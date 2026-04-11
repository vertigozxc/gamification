const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const analyticsBtn = `            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="text-xs px-3 py-1 rounded-full border border-blue-600 bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-colors font-bold uppercase tracking-wider"
            >
              Analytics
            </button>`;

const searchString = '{t.resetProgress}\n            </button>';
if (app.includes(searchString)) {
  app = app.replace(searchString, searchString + '\n' + analyticsBtn);
  fs.writeFileSync('src/App.jsx', app);
  console.log('Button injected successfully');
} else {
  console.log('Could not find replace point');
}