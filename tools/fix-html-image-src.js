/**
 * Fix img/gallery/preload paths pointing to .html when matching image exists locally.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'];

function listSiteHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (rel.startsWith('tools/') || rel.startsWith('wp-content/')) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) listSiteHtml(full, out);
    else if (/\.html?$/i.test(name)) out.push(full);
  }
  return out;
}

function resolveUploadPath(basePath, fromFile) {
  const relDir = path.dirname(path.relative(ROOT, fromFile));
  const parts = relDir === '.' ? [] : relDir.split(/[/\\]/);
  let p = basePath.replace(/\\/g, '/');
  while (p.startsWith('../')) {
    p = p.slice(3);
    parts.pop();
  }
  return path.join(ROOT, ...parts, p);
}

function imageExistsForHtmlPath(basePath, fromFile) {
  for (const ext of IMAGE_EXT) {
    const candidate = resolveUploadPath(basePath + ext, fromFile);
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) return true;
  }
  return false;
}

let files = 0;
let fixes = 0;
const re = /((?:\.\.\/)*wp-content\/uploads\/[^"'<>]+)\.html/gi;

for (const file of listSiteHtml(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const next = html.replace(re, (match, base) => {
    if (!imageExistsForHtmlPath(base, file)) return match;
    fixes++;
    const ext = IMAGE_EXT.find((e) => {
      const candidate = resolveUploadPath(base + e, file);
      return fs.existsSync(candidate) && fs.statSync(candidate).size > 0;
    });
    return base + (ext || '.jpg');
  });
  if (next !== html) {
    fs.writeFileSync(file, next, 'utf8');
    files++;
  }
}

console.log(`Fixed ${fixes} .html -> image references in ${files} site pages`);
