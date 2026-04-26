import fs from 'fs';
const path = 'C:/Users/User/Desktop/gamification/client/src/themeConfig.js';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/replaceTitle: "Quest Replacement",/g, 'replaceTitle: "Reroll 1 Pinned Task",');
c = c.replace(/replaceDesc: "Choose up to 4 new pinned quests",/g, 'replaceDesc: "Swap 1 specific pinned quest",');
c = c.replace(/replaceDetail: "Replace your pinned quests by selecting up to 4 different quests from the full list.",/g, 'replaceDetail: "Click the ⟳ Reroll button directly on any pinned quest on the board to swap it. (Costs 5 silver, or Free 1/month)",');
c = c.replace(/Cost: 7 silver/g, 'Cost: 5 silver');
fs.writeFileSync(path, c);
