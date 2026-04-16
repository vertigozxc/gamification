const fs = require('fs');

const distFile = '/Users/vertigozxc/Library/Application Support/Code/User/workspaceStorage/323866e70ac68033a282c2c48d746ebe/GitHub.copilot-chat/chat-session-resources/a0f91164-3800-4f8d-823e-cd269f087d46/call_MHxONkNPdXd1OXZNSEt5NVZRcUc__vscode-1776374302381/content.txt';
const distText = fs.readFileSync(distFile, 'utf8');

// Extract the CSS starting from .mobile-tab-screen
const matchStart = distText.indexOf('.mobile-tab-screen{');
if (matchStart === -1) {
  console.log("NOT FOUND!");
  process.exit(1);
}
// End it before the closing brace of the file context or similar.
const matchEnd = distText.indexOf('}#customize-modal'); // Wait, the dist css is minified. Let's grab specific mobile classes.
// Actually let's just grab the whole block of missing classes.
const rx = /(\.mobile-tab-screen[\s\S]+?)\.btn-primary/g;
const extract = rx.exec(distText);
if (extract) {
  let toAppend = extract[1].replace(/}/g, "}\n");
  fs.appendFileSync('/Users/vertigozxc/Documents/gamification/client/src/styles.css', "\n/* RESTORED MOBILE STYLES */\n" + toAppend);
  console.log("Restored missing classes.");
} else {
  console.log("Failed to match block.");
}
