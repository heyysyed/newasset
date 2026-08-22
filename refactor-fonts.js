const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace fontFamily inline styles with standard classNames
  // e.g. style={{ fontFamily: 'DM Sans', ... }} -> style={{ ... }} and add className="font-sans"
  
  // Actually, a simpler way is to just strip the fontFamily from style completely, 
  // because we will add the class, OR we can just rely on the body default for DM Sans.
  // Let's just remove fontFamily: 'DM Sans', 'DM Sans', sans-serif, etc. completely.
  content = content.replace(/fontFamily:\s*['"]DM Sans['"](?:,\s*['"]sans-serif['"])?,?\s*/gi, '');
  content = content.replace(/fontFamily:\s*['"]Oswald['"](?:,\s*['"]sans-serif['"])?,?\s*/gi, '');
  content = content.replace(/fontFamily:\s*['"]DM Mono['"](?:,\s*['"]monospace['"])?,?\s*/gi, '');
  
  // Clean up empty style={{ }}
  content = content.replace(/style=\{\{\s*\}\}/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
  }
}

processDir(path.join(__dirname, 'src', 'pages'));
processDir(path.join(__dirname, 'src', 'components'));
console.log('Refactoring complete.');
