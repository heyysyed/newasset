const fs = require('fs');
const acorn = require('acorn');
const acornJsx = require('acorn-jsx');

const Parser = acorn.Parser.extend(acornJsx());
const code = fs.readFileSync('src/pages/AssetDetail.jsx', 'utf8');

try {
  Parser.parse(code, { sourceType: 'module', ecmaVersion: 2020 });
  console.log('No syntax errors found.');
} catch (e) {
  console.error('Syntax error at line ' + e.loc.line + ', column ' + e.loc.column);
  console.error(e.message);
}
