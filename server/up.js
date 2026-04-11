const fs=require('fs');
const file='C:/Users/User/Desktop/gamification/client/src/components/ProfilePanel.jsx';
let cur=fs.readFileSync(file,'utf8');
let s=cur.indexOf('<div className="p-6 rounded-3xl mb-8 shadow-2xl"');
let e=cur.lastIndexOf('  }',cur.indexOf('ProfilePanel.propTypes ='));
let lines=fs.readFileSync('C:/Users/User/Desktop/gamification/server/updateProfilePanel.cjs','utf8');
let nr=lines.substring(lines.indexOf('\')+1,lines.lastIndexOf('\'));
fs.writeFileSync(file,cur.substring(0,s)+nr+'\n  '+cur.substring(e),'utf8');
