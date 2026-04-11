import fs from 'fs';

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  let list = fs.readdirSync(dir);
  list.forEach(function(file) {
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

const files = walk('C:/Users/User/Desktop/gamification/server/src');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let match = content.match(/[А-Яа-яЁёїієґ]/gi);
  if (match) {
    let unq = [...new Set(match)];
    console.log(f, unq.join(''));
  }
});
