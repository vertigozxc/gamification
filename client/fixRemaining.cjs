const fs = require('fs');

function walk(dir) {
  let results = [];
  let list = fs.readdirSync(dir);
  list.forEach(function(file) {
    if (file === 'dist' || file === 'node_modules' || file === '.git' || file === 'server') return;
    let fullPath = dir + '/' + file;
    let stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(fullPath));
    } else { 
      if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) results.push(fullPath);
    }
  });
  return results;
}

const files = walk('C:/Users/User/Desktop/gamification');

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;
  if (content.match(/[А-Яа-яЁёїієґ]/i)) {
    content = content.replace(/вњЁ/g, '✨');
    content = content.replace(/рџ“ќ/g, '📝');
    content = content.replace(/в–ј/g, '▼');
    content = content.replace(/вЂ”/g, '—');
    if (content !== original) {
      fs.writeFileSync(f, content, 'utf8');
      console.log('Fixed', f);
    }
  }
});
