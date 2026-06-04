/**
 * SEO phase 2b: fix old-domain canonicals in upload mirrors, keyword boost leftovers.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.chinapackagingmaterials.com';

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

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#x2d;/gi, '-')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8230;/g, '...')
    .replace(/&hellip;/g, '...');
}

function stripHtml(str) {
  return decodeEntities(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '') + '...';
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fileToCanonicalUrl(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return `${SITE}/`;
  let slug = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  slug = slug.replace(/\/page\/1$/, '');
  return `${SITE}/${slug}/`;
}

function needsKeyword(plain) {
  return !/china packaging materials|packaging manufacturer|packaging supplier/i.test(plain);
}

function boost(plain) {
  plain = plain.replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  if (!needsKeyword(plain)) return truncate(plain, 160);
  const suffix = ' China packaging materials supplier.';
  const combined = plain.replace(/[.\s]+$/, '.') + suffix;
  return truncate(combined, 160);
}

let canonFixed = 0;
let descBoosted = 0;
let descCleaned = 0;

for (const file of listHtmlFiles(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (/naboplastic\.com/i.test(html)) {
    html = html.replace(/https?:\/\/www\.naboplastic\.com/gi, SITE);
    html = html.replace(/www\.naboplastic\.com/gi, 'www.chinapackagingmaterials.com');
    canonFixed++;
    changed = true;
  }

  const canon = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (canon && /naboplastic/i.test(canon[1])) {
    const url = fileToCanonicalUrl(file);
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${url}" />`);
    changed = true;
  }

  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  if (descM) {
    let plain = stripHtml(descM[1]).replace(/\.{2,}/g, '.');
    const next = boost(plain);
    if (next !== stripHtml(descM[1]) || /\.{2,}/.test(decodeEntities(descM[1]))) {
      const escaped = escapeAttr(next);
      html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escaped}" />`);
      if (/<meta\s+property=["']og:description["']/i.test(html)) {
        html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escaped}" />`);
      }
      if (/<meta\s+name=["']twitter:description["']/i.test(html)) {
        html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escaped}" />`);
      }
      if (needsKeyword(plain)) descBoosted++;
      else descCleaned++;
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(file, html, 'utf8');
}

console.log({ canonFixed, descBoosted, descCleaned });
