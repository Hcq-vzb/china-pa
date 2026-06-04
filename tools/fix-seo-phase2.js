/**
 * SEO phase 2: canonical gaps, descriptions, product desc optimization,
 * uploads noindex, HTML cleanup in meta descriptions, sitemap regen.
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

function fileToCanonicalUrl(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return `${SITE}/`;
  let slug = rel.replace(/\/index\.html$/, '');
  slug = slug.replace(/\/page\/1$/, '');
  return `${SITE}/${slug}/`;
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&#x2d;/gi, '-')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8230;/g, '...')
    .replace(/&hellip;/g, '...')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(str) {
  return decodeEntities(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '') + '...';
}

function cleanDescription(raw) {
  if (!raw) return '';
  let d = stripHtml(raw);
  d = d.replace(/\s+/g, ' ').trim();
  return d;
}

function pageType(rel) {
  if (rel === 'index.html') return 'homepage';
  if (rel.startsWith('wp-content/uploads/')) return 'upload';
  if (rel.startsWith('product/')) return 'product';
  if (rel.includes('product-category') || /^(plastic-sprayers|plastic-caps|plastic-bottles|plastic-jars|pet-preforms|dispensing-pumps|fine-mist|trigger-sprayer|all-categories|bottles-by-material)/.test(rel))
    return 'category';
  if (/\/page\/\d+\//.test(rel) && /<META HTTP-EQUIV="Refresh"/i.test('')) return 'redirect';
  return 'content';
}

function isRedirectStub(html) {
  return /<META HTTP-EQUIV="Refresh"/i.test(html) && /<HTML>/i.test(html);
}

function isUploadMirror(rel) {
  return rel.startsWith('wp-content/uploads/') && rel.endsWith('.html');
}

function getRedirectTargetUrl(html, filePath) {
  const refresh = html.match(/Refresh["'][^>]*CONTENT=["'][^"']*URL=([^"'>]+)/i);
  if (!refresh) return fileToCanonicalUrl(filePath);
  let target = refresh[1].trim();
  const dir = path.dirname(filePath);
  const resolved = path.normalize(path.join(dir, target)).replace(/\\/g, '/');
  const rel = path.relative(ROOT, resolved).replace(/\\/g, '/');
  if (rel.startsWith('..')) return fileToCanonicalUrl(filePath);
  if (rel === 'index.html') return `${SITE}/`;
  const slug = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  return `${SITE}/${slug}/`;
}

function titlePlain(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return stripHtml(m[1]).replace(/\s*\|\s*China Packaging Materials.*$/i, '').trim();
}

function extractProductName(html) {
  const h1 = html.match(/<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]);
  const json = html.match(/"@type"\s*:\s*"Product"[\s\S]*?"name"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (json) {
    try {
      return JSON.parse('"' + json[1].replace(/\\"/g, '"') + '"');
    } catch {
      return json[1].replace(/\\"/g, '"');
    }
  }
  return titlePlain(html);
}

function extractMoq(html) {
  const m = html.match(/MOQ:\s*([\d,]+)\s*pcs/i);
  if (m) return m[1].replace(/,/g, '') + ' pcs';
  return '10,000 pcs';
}

function productShortName(name) {
  const parts = name.split(',').map((s) => s.trim());
  if (parts[0].length <= 65) return parts[0];
  return truncate(parts[0], 65);
}

function buildProductDescription(html) {
  const name = extractProductName(html);
  const short = productShortName(name || titlePlain(html));
  const moq = extractMoq(html);
  const base = `${short} from China packaging materials manufacturer KIWL Plastic. MOQ ${moq}, OEM/ODM, free samples, FDA & CE compliant.`;
  return truncate(base, 160);
}

function buildDescriptionFromTitle(title, rel) {
  const t = title.replace(/\s*-\s*Page\s+\d+$/i, '').trim();
  const pageMatch = rel.match(/\/page\/(\d+)\//);
  const pageSuffix = pageMatch && pageMatch[1] !== '1' ? ` Page ${pageMatch[1]}.` : '.';

  if (/^all-categories/i.test(rel)) {
    return truncate(
      `Browse all China packaging materials categories — plastic sprayers, pumps, caps, bottles, jars and PET preforms from KIWL Plastic${pageSuffix}`,
      160
    );
  }
  if (rel.startsWith('bottles-by-material/')) {
    const mat = rel.split('/')[1].toUpperCase();
    return truncate(
      `Shop ${mat} plastic bottles from China packaging materials manufacturer KIWL Plastic. Factory direct pricing, OEM/ODM, free samples${pageSuffix}`,
      160
    );
  }
  if (rel.startsWith('product-category/') || rel.includes('product-category')) {
    const label = t.replace(/^Category:\s*/i, '').trim() || t;
    return truncate(
      `Wholesale ${label} from China packaging materials supplier KIWL Plastic. MOQ from 10,000 pcs, custom colors, OEM/ODM support${pageSuffix}`,
      160
    );
  }
  if (/trigger-sprayer|plastic-sprayers|plastic-caps|dispensing-pumps|plastic-bottles|plastic-jars|pet-preform|finger-sprayers|fine-mist|lotion-pump|foam-pump/i.test(rel)) {
    return truncate(
      `${t} — China packaging materials manufacturer KIWL Plastic supplies wholesale packaging with OEM/ODM and free samples${pageSuffix}`,
      160
    );
  }
  return truncate(
    `${t}. China packaging materials manufacturer KIWL Plastic — plastic sprayers, pumps, caps, bottles and OEM/ODM packaging${pageSuffix}`,
    160
  );
}

function isWeakDescription(desc) {
  const plain = cleanDescription(desc);
  if (!plain) return true;
  if (plain.length < 90) return true;
  if (/^MOQ:\s*\d/i.test(plain)) return true;
  if (/^MOQ:/i.test(plain) && plain.length < 120) return true;
  if (/China packaging materials supplier\.?$/i.test(plain) && plain.length < 100) return true;
  if (/[<>]/.test(decodeEntities(desc))) return true;
  if (/&lt;/i.test(desc)) return true;
  return false;
}

function needsKeywordBoost(desc) {
  const plain = cleanDescription(desc);
  return plain && !/china packaging materials|packaging manufacturer|packaging supplier/i.test(plain);
}

function boostWithKeyword(desc) {
  const plain = cleanDescription(desc);
  const suffix = ' China packaging materials supplier.';
  if (/china packaging materials|packaging manufacturer|packaging supplier/i.test(plain)) return plain;
  const combined = plain.replace(/\s*$/, '.') + suffix;
  return truncate(combined, 160);
}

function hasCanonical(html) {
  return /<link\s+rel=["']canonical["']/i.test(html);
}

function hasDescription(html) {
  return /<meta\s+name=["']description["']/i.test(html);
}

function getDescription(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return m ? m[1] : '';
}

function ensureCanonical(html, canonicalUrl) {
  if (hasCanonical(html)) {
    return html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${canonicalUrl}" />`
    );
  }

  if (/<meta\s+name=["']viewport["']/i.test(html)) {
    return html.replace(
      /<meta\s+name=["']viewport["'][^>]*>/i,
      (m) => `${m}\n<link rel="canonical" href="${canonicalUrl}" />`
    );
  }

  if (/<HEAD>/i.test(html)) {
    return html.replace(/<HEAD>/i, `<HEAD>\n<link rel="canonical" href="${canonicalUrl}" />`);
  }

  if (/<head>/i.test(html)) {
    return html.replace(/<head>/i, `<head>\n<link rel="canonical" href="${canonicalUrl}" />`);
  }

  return html;
}

function setMetaDescription(html, description) {
  const escaped = escapeAttr(description);
  if (hasDescription(html)) {
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escaped}" />`
    );
  } else if (/<link\s+rel=["']canonical["']/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      (m) => `${m}\n<meta name="description" content="${escaped}" />`
    );
  } else if (/<meta\s+name=["']viewport["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']viewport["'][^>]*>/i,
      (m) => `${m}\n<meta name="description" content="${escaped}" />`
    );
  } else if (/<title>/i.test(html)) {
    html = html.replace(/<\/title>/i, `</title>\n<meta name="description" content="${escaped}" />`);
  }

  if (/<meta\s+property=["']og:description["']/i.test(html)) {
    html = html.replace(
      /<meta\s+property=["']og:description["'][^>]*>/i,
      `<meta property="og:description" content="${escaped}" />`
    );
  }
  if (/<meta\s+name=["']twitter:description["']/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']twitter:description["'][^>]*>/i,
      `<meta name="twitter:description" content="${escaped}" />`
    );
  }

  return html;
}

function ensureNoindex(html) {
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    return html.replace(
      /<meta\s+name=["']robots["'][^>]*>/i,
      '<meta name="robots" content="noindex, nofollow" />'
    );
  }
  const tag = '<meta name="robots" content="noindex, nofollow" />';
  if (/<meta\s+name=["']viewport["']/i.test(html)) {
    return html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, (m) => `${m}\n${tag}`);
  }
  if (/<head>/i.test(html)) {
    return html.replace(/<head>/i, `<head>\n${tag}`);
  }
  if (/<HEAD>/i.test(html)) {
    return html.replace(/<HEAD>/i, `<HEAD>\n${tag}`);
  }
  return html;
}

function isNoindex(html) {
  return /<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
}

function processFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  let html = fs.readFileSync(filePath, 'utf8');
  const stats = {
    canonicalAdded: false,
    descriptionAdded: false,
    descriptionOptimized: false,
    descriptionCleaned: false,
    noindexAdded: false,
  };

  let canonicalUrl = fileToCanonicalUrl(filePath);
  const redirect = isRedirectStub(html);
  if (redirect) {
    canonicalUrl = getRedirectTargetUrl(html, filePath);
    html = ensureNoindex(html);
    stats.noindexAdded = true;
  }

  if (isUploadMirror(rel)) {
    html = ensureNoindex(html);
    stats.noindexAdded = true;
    canonicalUrl = fileToCanonicalUrl(filePath);
  }

  if (!hasCanonical(html)) {
    stats.canonicalAdded = true;
  }
  html = ensureCanonical(html, canonicalUrl);

  const title = titlePlain(html);
  let description = cleanDescription(getDescription(html));

  if (!hasDescription(html) || !description) {
    if (rel.startsWith('product/') && !redirect) {
      description = buildProductDescription(html);
    } else if (redirect) {
      description = truncate(`Redirect page. See ${title || 'target page'} at KIWL Plastic China packaging materials.`, 160);
    } else {
      description = buildDescriptionFromTitle(title || 'Packaging Solutions', rel);
    }
    stats.descriptionAdded = true;
  } else {
    const rawDesc = getDescription(html);
    const hadHtml = /&lt;|<[a-z]/i.test(rawDesc);

    if (hadHtml) {
      description = cleanDescription(rawDesc);
      stats.descriptionCleaned = true;
    }

    if (rel.startsWith('product/') && !redirect && isWeakDescription(rawDesc)) {
      description = buildProductDescription(html);
      stats.descriptionOptimized = true;
    } else if (isWeakDescription(description)) {
      description = buildDescriptionFromTitle(title || description, rel);
      stats.descriptionOptimized = true;
    } else if (needsKeywordBoost(description)) {
      description = boostWithKeyword(description);
      stats.descriptionOptimized = true;
    }

    if (hadHtml) stats.descriptionCleaned = true;
  }

  description = truncate(cleanDescription(description), 160);
  html = setMetaDescription(html, description);

  if (/<meta\s+property=["']og:url["']/i.test(html)) {
    html = html.replace(
      /<meta\s+property=["']og:url["'][^>]*>/i,
      `<meta property="og:url" content="${canonicalUrl}" />`
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');

  return {
    rel,
    canonicalUrl,
    noindex: isNoindex(html) || redirect || isUploadMirror(rel),
    stats,
  };
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

function main() {
  const files = listHtmlFiles(ROOT);
  const totals = {
    files: 0,
    canonicalAdded: 0,
    descriptionAdded: 0,
    descriptionOptimized: 0,
    descriptionCleaned: 0,
    noindexAdded: 0,
  };
  const entries = [];

  for (const file of files) {
    const result = processFile(file);
    entries.push(result);
    totals.files++;
    if (result.stats.canonicalAdded) totals.canonicalAdded++;
    if (result.stats.descriptionAdded) totals.descriptionAdded++;
    if (result.stats.descriptionOptimized) totals.descriptionOptimized++;
    if (result.stats.descriptionCleaned) totals.descriptionCleaned++;
    if (result.stats.noindexAdded) totals.noindexAdded++;
  }

  const sitemap = generateSitemap(entries);
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

  const indexable = entries.filter((e) => !e.noindex).length;
  console.log(JSON.stringify({ totals, sitemapIndexable: indexable, sitemapTotal: entries.length }, null, 2));
}

main();
