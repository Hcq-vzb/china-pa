/**
 * SEO phase 3: shorten long titles, fix truncated description keywords,
 * normalize HTTrack redirect stubs, fix broken filter redirect links.
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
    .replace(/&#8211;/g, '-')
    .replace(/&#038;/g, '&')
    .replace(/&#8230;/g, '...')
    .replace(/&hellip;/g, '...')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s-]+$/, '') + '...';
}

function fileToCanonicalUrl(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return `${SITE}/`;
  let slug = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  slug = slug.replace(/\/page\/1$/, '');
  return `${SITE}/${slug}/`;
}

function isRedirectStub(html) {
  return (
    (/<META HTTP-EQUIV="Refresh"/i.test(html) && /<HTML>/i.test(html)) ||
    isBrokenRedirectStub(html)
  );
}

function getRedirectTarget(html, filePath) {
  const refresh = html.match(/refresh[^>]*content=["'][^"']*url=([^"'>]+)/i);
  if (!refresh) return null;
  let target = refresh[1].trim().replace(/\s+by HTTrack[\s\S]*$/i, '');
  const dir = path.dirname(filePath);
  const resolved = path.normalize(path.join(dir, target)).replace(/\\/g, '/');
  const rel = path.relative(ROOT, resolved).replace(/\\/g, '/');
  if (rel.startsWith('..')) return target;
  return rel;
}

function htmlQueryFromMirrorComment(html) {
  const m = html.match(/Mirrored from [^?\n]+\?([^<\n]+?)(?:\s+by HTTrack|\s*-->)/i);
  return m ? m[1].trim() : null;
}

function extractBrokenStubQuery(html) {
  const m = html.match(/filters=[A-Za-z0-9%_\[\]-]+/i);
  return m ? m[0] : null;
}

function isBrokenRedirectStub(html) {
  return /content="0;url=[^"]* by HTTrack/i.test(html);
}

function buildCleanRedirectHtml(canonicalUrl, targetHref, title) {
  const desc = 'Redirecting to the updated KIWL Plastic China packaging materials page.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${canonicalUrl}" />
<meta name="description" content="${desc}" />
<meta name="robots" content="noindex, nofollow" />
<meta http-equiv="refresh" content="0;url=${targetHref}">
<title>${escapeAttr(title)}</title>
</head>
<body>
<p><a href="${targetHref}">Continue to ${escapeAttr(title)}</a></p>
</body>
</html>
`;
}

function normalizeRedirectStub(filePath, html) {
  let target = getRedirectTarget(html, filePath);
  if (!target) target = 'index.html';

  const base = path.basename(filePath);
  let qFromComment = htmlQueryFromMirrorComment(html) || extractBrokenStubQuery(html);

  if (/^index[a-f0-9]+\.html$/i.test(base)) {
    target = qFromComment ? `index.html?${qFromComment}` : 'index.html';
  } else if (/^index[a-f0-9]+\.html/i.test(String(target).split('?')[0])) {
    const q = String(target).includes('?') ? String(target).split('?').slice(1).join('?') : qFromComment;
    target = q ? `index.html?${q}` : 'index.html';
  }

  target = target.replace(/\\/g, '/').replace(/\s+by HTTrack[\s\S]*$/i, '');

  let canonicalUrl = fileToCanonicalUrl(filePath);
  if (/^index[a-f0-9]+\.html$/i.test(base) && qFromComment) {
    const parentRel = path.relative(ROOT, path.dirname(filePath)).replace(/\\/g, '/');
    canonicalUrl = `${SITE}/${parentRel}/?${qFromComment}`;
  }

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]) : 'Page moved';
  return buildCleanRedirectHtml(canonicalUrl, target, title);
}

function stripTitleSuffix(plain) {
  return plain
    .replace(/\s*\|\s*China Packaging Materials\s*[-–]\s*KIWL Plastic\s*$/i, '')
    .replace(/\s*\|\s*China Packaging Materials Supplier\s*$/i, '')
    .replace(/\s*\|\s*China Packaging\s*[-–]\s*KIWL\s*$/i, '')
    .replace(/\s*\|\s*KIWL Plastic\s*$/i, '')
    .trim();
}

function shortenTitle(titleInner, rel) {
  const plain = decodeEntities(titleInner);
  if (rel === 'index.html') return titleInner;
  if (plain.length <= 70) return titleInner;

  const core = stripTitleSuffix(plain);
  const suffixes = [' | China Packaging - KIWL', ' | KIWL Plastic'];

  for (const suffix of suffixes) {
    if (core.length + suffix.length <= 70) {
      return (core + suffix).replace(/&/g, '&amp;');
    }
  }

  const suffix = ' | KIWL Plastic';
  const trimmed = truncate(core, 70 - suffix.length);
  return (trimmed + suffix).replace(/&/g, '&amp;');
}

function syncSocialTitles(html, plainTitle) {
  const attr = escapeAttr(plainTitle);
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${attr}" />`);
  html = html.replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${attr}" />`);
  return html;
}

function hasKeyword(plain) {
  return /china packaging materials|packaging manufacturer|packaging supplier/i.test(plain);
}

function fixDescriptionContent(raw) {
  let plain = decodeEntities(raw).replace(/<[^>]*>/g, ' ').replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();

  if (/China\.{3}$/.test(plain)) {
    plain = plain.replace(/\s*China\.{3}$/, '').trim();
  }

  plain = plain.replace(/\s*\.\s*China packaging materials supplier\.?\s*$/i, '').trim();

  if (hasKeyword(plain)) {
    const lower = plain.toLowerCase();
    const idx = lower.indexOf('china packaging materials');
    if (idx === -1) return truncate(plain, 160);
    if (idx > 80 || (plain.length >= 155 && idx > 40)) {
      const body = plain
        .replace(/^China packaging materials[^—–-]*[-–—]\s*/i, '')
        .replace(/\s*China packaging materials supplier\.?\s*$/i, '')
        .trim();
      plain = `China packaging materials — ${body}`;
    }
    return truncate(plain, 160);
  }

  const prefix = 'China packaging materials — ';
  return prefix + truncate(plain, 160 - prefix.length);
}

function setDescription(html, plain) {
  const escaped = escapeAttr(plain);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escaped}" />`);
  if (/<meta\s+property=["']og:description["']/i.test(html)) {
    html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escaped}" />`);
  }
  if (/<meta\s+name=["']twitter:description["']/i.test(html)) {
    html = html.replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escaped}" />`);
  }
  return html;
}

function isNoindex(html) {
  return /<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
}

const FILTER_LINK_FIXES = [
  {
    from: /product-category\/plastic-sprayers\/trigger-sprayers-wholesale\/index2deb\.html\?filters=trigger-pump-angle%5Bvertical-pump-economy-type%5D/g,
    to: 'product-category/plastic-sprayers/trigger-sprayers-wholesale/index.html?filters=trigger-pump-angle%5Bvertical-pump-economy-type%5D',
  },
  {
    from: /product-category\/plastic-sprayers\/trigger-sprayers-wholesale\/index8019\.html\?filters=trigger-pump-angle%5Bhorizon-pump%5D/g,
    to: 'product-category/plastic-sprayers/trigger-sprayers-wholesale/index.html?filters=trigger-pump-angle%5Bhorizon-pump%5D',
  },
  {
    from: /product-category\/plastic-sprayers\/trigger-sprayers-wholesale\/index3f25\.html\?filters=trigger-pump-angle%5Boblique-pump%5D/g,
    to: 'product-category/plastic-sprayers/trigger-sprayers-wholesale/index.html?filters=trigger-pump-angle%5Boblique-pump%5D',
  },
  {
    from: /product-category\/trigger-sprayers\/index2deb\.html\?filters=trigger-pump-angle%5Bvertical-pump-economy-type%5D/g,
    to: 'product-category/trigger-sprayers/index.html?filters=trigger-pump-angle%5Bvertical-pump-economy-type%5D',
  },
  {
    from: /product-category\/trigger-sprayers\/index8019\.html\?filters=trigger-pump-angle%5Bhorizon-pump%5D/g,
    to: 'product-category/trigger-sprayers/index.html?filters=trigger-pump-angle%5Bhorizon-pump%5D',
  },
  {
    from: /product-category\/trigger-sprayers\/index3f25\.html\?filters=trigger-pump-angle%5Boblique-pump%5D/g,
    to: 'product-category/trigger-sprayers/index.html?filters=trigger-pump-angle%5Boblique-pump%5D',
  },
];

function fixFilterLinks(html) {
  let out = html;
  for (const { from, to } of FILTER_LINK_FIXES) {
    out = out.replace(from, to);
  }
  out = out.replace(
    /\.\.\/product-category\/plastic-sprayers\/trigger-sprayers-wholesale\/index8019\.html\?filters=([^"']+)/g,
    '../product-category/plastic-sprayers/trigger-sprayers-wholesale/index.html?filters=$1'
  );
  out = out.replace(
    /\.\.\/product-category\/plastic-sprayers\/trigger-sprayers-wholesale\/index3f25\.html\?filters=([^"']+)/g,
    '../product-category/plastic-sprayers/trigger-sprayers-wholesale/index.html?filters=$1'
  );
  out = out.replace(
    /\.\.\/product-category\/plastic-sprayers\/trigger-sprayers-wholesale\/index2deb\.html\?filters=([^"']+)/g,
    '../product-category/plastic-sprayers/trigger-sprayers-wholesale/index.html?filters=$1'
  );
  out = out.replace(/\.\.\/product-category\/trigger-sprayers\/index8019\.html/g, '../product-category/trigger-sprayers/index.html');
  out = out.replace(/\.\.\/product-category\/trigger-sprayers\/index3f25\.html/g, '../product-category/trigger-sprayers/index.html');
  out = out.replace(/\.\.\/product-category\/trigger-sprayers\/index2deb\.html/g, '../product-category/trigger-sprayers/index.html');
  return out;
}

function generateSitemap(entries) {
  const urls = entries
    .filter((e) => !e.noindex)
    .map((e) => e.canonicalUrl)
    .sort();

  const body = urls
    .map(
      (loc) =>
        `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${loc === `${SITE}/` ? '1.0' : '0.8'}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const totals = {
  titlesShortened: 0,
  descriptionsFixed: 0,
  stubsNormalized: 0,
  filterLinksFixed: 0,
  files: 0,
};

const entries = [];

for (const file of listHtmlFiles(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  if (isRedirectStub(html)) {
    html = normalizeRedirectStub(file, html);
    totals.stubsNormalized++;
  }

  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleM && !isRedirectStub(before)) {
    const next = shortenTitle(titleM[1], rel);
    if (next !== titleM[1]) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${next}</title>`);
      html = syncSocialTitles(html, decodeEntities(next));
      totals.titlesShortened++;
    }
  }

  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  if (descM && !isRedirectStub(before)) {
    const fixed = fixDescriptionContent(descM[1]);
    const current = decodeEntities(descM[1]).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (fixed !== current && fixed !== truncate(current, 160)) {
      html = setDescription(html, fixed);
      totals.descriptionsFixed++;
    } else if (!hasKeyword(current) || /China\.{3}$/.test(current)) {
      html = setDescription(html, fixed);
      totals.descriptionsFixed++;
    }
  }

  const linked = fixFilterLinks(html);
  if (linked !== html) {
    html = linked;
    totals.filterLinksFixed++;
  }

  if (html !== before) fs.writeFileSync(file, html, 'utf8');

  entries.push({
    canonicalUrl: fileToCanonicalUrl(file),
    noindex:
      isNoindex(html) ||
      isRedirectStub(before) ||
      rel.startsWith('wp-content/uploads/') ||
      /^index[a-f0-9]+\.html$/i.test(path.basename(file)),
  });
  totals.files++;
}

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), generateSitemap(entries), 'utf8');
console.log(JSON.stringify({ totals, sitemapIndexable: entries.filter((e) => !e.noindex).length }, null, 2));
