const fs = require('fs');
let c = fs.readFileSync('src/components/QuestBoard.jsx', 'utf8');
c = c.split('className={\quest-card p-5 rounded-xl flex flex-col justify-between h-48  + '' + \}').join('className={\quest-card p-5 rounded-xl flex flex-col justify-between h-48  + '' + \}');
fs.writeFileSync('src/components/QuestBoard.jsx', c, 'utf8');
console.log('Fixed');
