const fs = require("fs");

const filePath = "src/components/QuestBoard.jsx";
let content = fs.readFileSync(filePath, "utf8");

// Normalize previously broken placeholder replacements.
content = content.replace(/\uFFFD/g, "?");

fs.writeFileSync(filePath, content, "utf8");
console.log("Normalized replacement characters in QuestBoard.jsx");
