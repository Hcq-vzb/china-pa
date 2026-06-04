/**
 * Fix product/category title keyword order after batch SEO run.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function listHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (rel.startsWith('tools/')) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) listHtmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function fixTitle(title) {
  if (/China Packaging Materials/i.test(title) && !/ \| China Packaging Materials Supplier<\/title>/i.test(title)) {
    // Already has inline keyword placement
    if (/\| China Packaging Materials - KIWL Plastic/i.test(title)) return title;
  }

  let t = title;

  // Wrong: "... - KIWL Plastic | China Packaging Materials Supplier"
  t = t.replace(
    /(.+?)\s(?:&#x2d;|&#8211;|[-–])\sKIWL Plastic\s\|\sChina Packaging Materials Supplier/gi,
    '$1 | China Packaging Materials - KIWL Plastic'
  );

  // About and similar: "... - KIWL Plastic" without keyword
  if (!/China Packaging Materials/i.test(t) && /KIWL Plastic/i.test(t)) {
    t = t.replace(
      /(.+?)\s(?:&#x2d;|&#8211;|[-–])\sKIWL Plastic/gi,
      '$1 | China Packaging Materials - KIWL Plastic'
    );
  }

  // Category/product without brand suffix
  if (!/China Packaging Materials/i.test(t) && !/KIWL Plastic/i.test(t)) {
    t = t.replace(/\s*$/, ' | China Packaging Materials Supplier');
  }

  return t;
}

function syncOgTwitter(html, titleInner) {
  const plain = titleInner
    .replace(/&#x2d;/g, '-')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&');
  let out = html;
  out = out.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']/i,
    `<meta property="og:title" content="${plain.replace(/"/g, '&quot;')}"`
  );
  out = out.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']/i,
    `<meta name="twitter:title" content="${plain.replace(/"/g, '&quot;')}"`
  );
  return out;
}

let fixed = 0;
for (const file of listHtmlFiles(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) continue;
  const next = fixTitle(m[1]);
  if (next === m[1]) continue;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${next}</title>`);
  html = syncOgTwitter(html, next);
  fs.writeFileSync(file, html, 'utf8');
  fixed++;
}
console.log(`Updated titles on ${fixed} files`);
