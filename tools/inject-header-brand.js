/**
 * Inject KIWL header brand tagline script into all site HTML pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARKER = 'kiwl-header.js';
const SKIP_DIRS = new Set(['tools', 'node_modules', '.git', 'wp-content/cache']);

function listHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const top = rel.split('/')[0];
    if (SKIP_DIRS.has(top)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) listHtmlFiles(full, out);
    else if (/\.html?$/i.test(name)) out.push(full);
  }
  return out;
}

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function injectTag(prefix) {
  return `<script src="${prefix}wp-content/kiwl-header/kiwl-header.js" defer></script>`;
}

function fixFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('inside-header') || !html.includes('site-logo')) return false;
  if (html.includes(MARKER)) return false;

  const tag = injectTag(depthPrefix(file));
  const bodyIdx = html.lastIndexOf('</body>');
  if (bodyIdx === -1) return false;

  html = html.slice(0, bodyIdx) + tag + '\n' + html.slice(bodyIdx);
  fs.writeFileSync(file, html, 'utf8');
  return true;
}

const files = listHtmlFiles(ROOT);
let n = 0;
for (const f of files) {
  if (fixFile(f)) n++;
}
console.log(`HTML scanned: ${files.length}`);
console.log(`Injected header brand: ${n}`);
