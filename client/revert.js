const fs = require('fs');
let css = fs.readFileSync('src/styles.css', 'utf8');
css = css.replace('floatCard 3.5s ease-in-out infinite 0.5s', 'floatCard 6s ease-in-out infinite 0.5s');
fs.writeFileSync('src/styles.css', css, 'utf8');
console.log('Reverted to 6s');
