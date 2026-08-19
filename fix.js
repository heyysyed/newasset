const fs = require('fs');
const path = 'src/components/Layout.jsx';
const content = fs.readFileSync(path, 'utf8');
// Split by any newline character
const lines = content.split(/\r?\n/);
// The first component ends at line 307. We keep lines 0 to 307 (308 lines total).
const fixedContent = lines.slice(0, 308).join('\n') + '\n';
fs.writeFileSync(path, fixedContent);
console.log('Successfully fixed Layout.jsx!');
