/**
 * Fix WhatsApp button styling after button -> anchor conversion.
 * CSS was button.gb-button-dffa6e40 only; icons/layout broke on <a>.
 */
const fs = require('fs');
const path = require('path');

const PRODUCT_DIR = path.join(__dirname, '../product');

const REPLACEMENTS = [
  ['button.gb-button-dffa6e40{', 'a.gb-button-dffa6e40,button.gb-button-dffa6e40{'],
  ['button.gb-button-dffa6e40 ', 'a.gb-button-dffa6e40,button.gb-button-dffa6e40 '],
  [
    'background-color:#25d366;color:var(--contrast);',
    'background-color:#25d366;color:#fff;',
  ],
  ['fill="#fff"', 'fill="currentColor"'],
];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/index\.html?$/i.test(name)) files.push(full);
  }
  return files;
}

function fixFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('gb-button-dffa6e40')) return false;
  let changed = false;
  for (const [from, to] of REPLACEMENTS) {
    if (html.includes(from)) {
      html = html.split(from).join(to);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, html, 'utf8');
  return changed;
}

let n = 0;
for (const file of walk(PRODUCT_DIR)) {
  if (fixFile(file)) n++;
}
console.log(`WhatsApp button CSS fixed in ${n} product pages`);
