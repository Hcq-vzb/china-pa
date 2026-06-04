/**
 * Batch SEO fix: new domain, canonicals, JSON-LD, OG tags, keywords, sitemap, robots.txt
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.chinapackagingmaterials.com';
const OLD_SITE = 'https://www.naboplastic.com';
const OLD_HOST = 'www.naboplastic.com';
const NEW_HOST = 'www.chinapackagingmaterials.com';

const KEYWORD_REPLACEMENTS = [
  [
    /Discover KIWL Plastic, China\u2019s expert in manufacturing plastic sprayers, dispensing pumps, caps, and bottles &#x2d; diverse products for all packaging needs\./g,
    'China packaging materials manufacturer KIWL Plastic supplies plastic sprayers, dispensing pumps, caps, and bottles for global B2B buyers.',
  ],
  [
    /Discover KIWL Plastic, your go&#x2d;to source for diverse, superior plastic packaging products\. Experience quality and innovation at their finest\./g,
    'China packaging materials supplier KIWL Plastic offers premium plastic sprayers, pumps, caps, and bottles with OEM/ODM support for worldwide brands.',
  ],
  [
    /Discover KIWL Plastic, China\u2019s expert in manufacturing plastic sprayers, dispensing pumps, caps, and bottles &#8211; your one-stop packaging solution\./g,
    'China packaging materials manufacturer KIWL Plastic delivers sprayers, pumps, caps, and bottles as your one-stop packaging solution.',
  ],
  [/quote@naboplastic\.com/g, 'quote@chinapackagingmaterials.com'],
  [/KIWL塑料&#x2d;喷雾器、泵、瓶盖和瓶子制造商/g, 'China Packaging Materials Manufacturer | Plastic Sprayers, Pumps, Caps &amp; Bottles'],
  [/KIWL塑料/g, 'China Packaging Materials'],
  [/"alternateName":"KIWL塑料"/g, '"alternateName":"China Packaging Materials"'],
  [/content="KIWL Plastic"/g, 'content="KIWL Plastic | China Packaging Materials"'],
];

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

function fileToCanonicalUrl(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return `${SITE}/`;
  const slug = rel.replace(/\/index\.html$/, '');
  return `${SITE}/${slug}/`;
}

function resolveAssetPath(assetPath, filePath) {
  let p = assetPath.trim().replace(/^\/+/, '');
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      return `${SITE}${u.pathname}`;
    } catch {
      return p;
    }
  }
  p = p.replace(/^(\.\.\/)+/, '');
  if (!p.startsWith('wp-content/')) {
    const prefix = depthPrefix(filePath);
    p = (prefix + p).replace(/^(\.\.\/)+/, '');
  }
  return `${SITE}/${p}`;
}

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function replaceDomain(html) {
  let out = html;
  out = out.replace(/https:\/\/www\.naboplastic\.com/g, SITE);
  out = out.replace(/http:\/\/www\.naboplastic\.com/g, SITE);
  out = out.replace(/https:\\\/\\\/www\.naboplastic\.com/g, SITE.replace(/\//g, '\\/'));
  out = out.replace(/www\.naboplastic\.com/g, NEW_HOST);
  out = out.replace(/%3A%2F%2Fwww\.naboplastic\.com/g, encodeURIComponent(SITE).replace(/'/g, '%27'));
  out = out.replace(/%2F%2Fwww\.naboplastic\.com/g, `%2F%2F${NEW_HOST}`);
  return out;
}

function fixJsonLdUrls(html) {
  return html.replace(/"(url|contentUrl)"\s*:\s*"url\(([^)]+)\)"/gi, (_, key, raw) => {
    const inner = raw.replace(/^['"]|['"]$/g, '').trim();
    const clean = inner.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
    return `"${key}":"${SITE}/${clean}"`;
  });
}

function optimizeTitle(title, canonicalUrl) {
  let t = title;
  if (canonicalUrl === `${SITE}/`) {
    return 'China Packaging Materials Manufacturer | Plastic Sprayers, Pumps, Caps &amp; Bottles - KIWL Plastic';
  }
  if (/China Packaging Materials/i.test(t)) return t;
  if (/\s[-–|]\s*KIWL Plastic/i.test(t)) {
    return t.replace(/\s([-–|])\s*KIWL Plastic/i, ' | China Packaging Materials$1 KIWL Plastic');
  }
  if (/Wholesale/i.test(t) && !/China Packaging Materials/i.test(t)) {
    return t.replace(/\s*$/, ' | China Packaging Materials Supplier');
  }
  return t;
}

function optimizeDescription(desc) {
  if (!desc || !desc.trim()) return desc;
  if (/China packaging materials/i.test(desc)) return desc;
  const suffix = ' China packaging materials supplier.';
  if (desc.length + suffix.length <= 160) return desc.replace(/\s*$/, '.') + suffix;
  return desc;
}

function removeNovashareOgBlock(html) {
  const start = html.indexOf('<!-- Novashare');
  if (start === -1) return html;
  const afterStart = html.slice(start);
  const endMatch = afterStart.match(
    /(?:\n<meta property="(?:og:|article:)[^"]+"[^>]*>|\n<meta name="twitter:[^"]+"[^>]*>)+/i
  );
  if (!endMatch) return html;
  const end = start + endMatch.index + endMatch[0].length;
  return html.slice(0, start) + html.slice(end).replace(/^\s*\n/, '\n');
}

function dedupeHeadMeta(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return html;
  const head = headMatch[1];
  const seen = new Set();
  const lines = head.split('\n');
  const kept = [];

  for (const line of lines) {
    const canon = line.match(/<link\s+rel=["']canonical["']/i);
    if (canon) {
      if (seen.has('canonical')) continue;
      seen.add('canonical');
      kept.push(line);
      continue;
    }

    const meta =
      line.match(/<meta\s+(?:name|property)=["']([^"']+)["']/i) ||
      line.match(/<meta\s+property=["'](og:[^"']+)["']/i);
    if (meta) {
      const key = meta[1].toLowerCase();
      if (key.startsWith('og:') || key.startsWith('twitter:') || key === 'description') {
        const empty = /content=["']\s*["']/i.test(line);
        if (seen.has(key)) continue;
        if (empty && key === 'og:description') continue;
        seen.add(key);
      }
    }
    kept.push(line);
  }

  return html.replace(headMatch[1], kept.join('\n'));
}

function fixCanonicalAndOg(html, filePath, canonicalUrl) {
  let out = html;
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '');
  out = out.replace(
    /<meta\s+name=["']viewport["'][^>]*>/i,
    (m) => `${m}\n<link rel="canonical" href="${canonicalUrl}" />`
  );

  out = out.replace(
    /(<meta\s+property=["']og:image["']\s+content=["'])([^"']+)(["'])/gi,
    (_, a, img, c) => `${a}${resolveAssetPath(img, filePath)}${c}`
  );
  out = out.replace(
    /(<meta\s+property=["']og:image:secure_url["']\s+content=["'])([^"']+)(["'])/gi,
    (_, a, img, c) => `${a}${resolveAssetPath(img, filePath)}${c}`
  );
  out = out.replace(
    /(<meta\s+name=["']twitter:image["']\s+content=["'])([^"']+)(["'])/gi,
    (_, a, img, c) => `${a}${resolveAssetPath(img, filePath)}${c}`
  );
  out = out.replace(
    /(<meta\s+property=["']og:url["']\s+content=["'])([^"']+)(["'])/gi,
    (_, a, _u, c) => `${a}${canonicalUrl}${c}`
  );

  return out;
}

function applyKeywordReplacements(html) {
  let out = html;
  for (const [re, rep] of KEYWORD_REPLACEMENTS) out = out.replace(re, rep);
  return out;
}

function fixTitleAndDescription(html, canonicalUrl) {
  return html.replace(/<title>([\s\S]*?)<\/title>/i, (full, title) => {
    const optimized = optimizeTitle(title, canonicalUrl);
    return `<title>${optimized}</title>`;
  }).replace(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i, (full, desc) => {
    const optimized = optimizeDescription(desc);
    return `<meta name="description" content="${optimized}"`;
  });
}

function syncOgTwitterTitle(html) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return html;
  const plainTitle = titleMatch[1]
    .replace(/&#x2d;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–');
  let out = html;
  out = out.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']/i,
    `<meta property="og:title" content="${plainTitle.replace(/"/g, '&quot;')}"`
  );
  out = out.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']/i,
    `<meta name="twitter:title" content="${plainTitle.replace(/"/g, '&quot;')}"`
  );
  return out;
}

function isNoindex(html) {
  return /<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const canonicalUrl = fileToCanonicalUrl(filePath);

  html = replaceDomain(html);
  html = fixJsonLdUrls(html);
  html = removeNovashareOgBlock(html);
  html = applyKeywordReplacements(html);
  html = fixTitleAndDescription(html, canonicalUrl);
  html = fixCanonicalAndOg(html, filePath, canonicalUrl);
  html = dedupeHeadMeta(html);
  html = syncOgTwitterTitle(html);

  html = html.replace(
    /<!-- Mirrored from www\.naboplastic\.com/g,
    `<!-- Mirrored from ${NEW_HOST}`
  );

  fs.writeFileSync(filePath, html, 'utf8');
  return { canonicalUrl, noindex: isNoindex(html) };
}

function generateSitemap(entries) {
  const urls = entries
    .filter((e) => !e.noindex)
    .map((e) => e.canonicalUrl)
    .sort();

  const body = urls
    .map(
      (loc) => `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${loc === `${SITE}/` ? '1.0' : '0.8'}</priority>\n  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function main() {
  const files = listHtmlFiles(ROOT);
  const entries = [];
  let changed = 0;

  for (const file of files) {
    processFile(file);
    entries.push({
      canonicalUrl: fileToCanonicalUrl(file),
      noindex: isNoindex(fs.readFileSync(file, 'utf8')),
    });
    changed++;
  }

  const sitemap = generateSitemap(entries);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots, 'utf8');

  const indexable = entries.filter((e) => !e.noindex).length;
  console.log(`Processed ${changed} HTML files`);
  console.log(`Sitemap: ${indexable} indexable URLs (${entries.length - indexable} noindex excluded)`);
  console.log(`Wrote sitemap.xml and robots.txt`);
}

main();
