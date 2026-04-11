const fs = require('fs');
let jsx = fs.readFileSync('src/components/QuestBoard.jsx', 'utf8');

jsx = jsx.replace('className={\quest-card p-5 rounded-xl flex flex-col justify-between h-48 ${isDone ? "completed" : "shimmer-border"}}', 'className={\quest-card p-5 rounded-xl flex flex-col justify-between h-48 ${isDone ? "completed" : "floating-card"}}')
          .replace('className={\quest-card p-5 rounded-xl flex flex-col justify-between h-48 ${isDone ? "completed" : "shimmer-border"}}', 'className={\quest-card p-5 rounded-xl flex flex-col justify-between h-48 ${isDone ? "completed" : "floating-card"}}');

fs.writeFileSync('src/components/QuestBoard.jsx', jsx, 'utf8');
console.log('JSX Replaced');
