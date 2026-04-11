import fs from 'fs';
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  let list = fs.readdirSync(dir);
  list.forEach(function(file) {
    if (file === 'dist' || file === 'node_modules' || file === '.git') return;
    file = dir + '/' + file;
    let stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if(file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
    }
  });
  return results;
}
const files = walk('C:/Users/User/Desktop/gamification');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('ВЊ') || content.includes('вњ') || content.includes('рџ')) {
    console.log(f);
  }
});
