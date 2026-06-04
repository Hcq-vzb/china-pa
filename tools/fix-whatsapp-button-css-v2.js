/**
 * Fix broken WhatsApp button CSS selectors after naive button->a replace.
 */
const fs = require('fs');
const path = require('path');

const PRODUCT_DIR = path.join(__dirname, '../product');

const FIXES = [
  [
    'a.gb-button-dffa6e40,button.gb-button-dffa6e40 .gb-icon{line-height:0;}',
    'a.gb-button-dffa6e40 .gb-icon,button.gb-button-dffa6e40 .gb-icon{line-height:0;}',
  ],
  [
    'a.gb-button-dffa6e40,button.gb-button-dffa6e40 .gb-icon svg{width:1em;height:1em;fill:currentColor;}',
    'a.gb-button-dffa6e40 .gb-icon svg,button.gb-button-dffa6e40 .gb-icon svg{width:1em;height:1em;fill:currentColor;}',
  ],
];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (/index\.html?$/i.test(name)) files.push(full);
  }
  return files;
}

let n = 0;
for (const file of walk(PRODUCT_DIR)) {
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of FIXES) {
    if (html.includes(from)) {
      html = html.replace(from, to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, html, 'utf8');
    n++;
  }
}
console.log(`Fixed descendant selectors in ${n} files`);
