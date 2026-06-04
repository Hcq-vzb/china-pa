/**
 * One-off SEO audit report generator
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

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(s) {
  return s
    .replace(/&#x2d;/gi, '-')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&');
}

const files = listHtmlFiles(ROOT);
const stats = {
  totalPages: files.length,
  canonical: { ok: 0, missing: 0, oldDomain: 0 },
  title: { ok: 0, missing: 0, withKeyword: 0, withoutKeyword: 0, tooLong: 0 },
  description: { ok: 0, missing: 0, withKeyword: 0, tooLong: 0, tooShort: 0 },
  og: { title: 0, url: 0, image: 0, description: 0 },
  twitter: { card: 0, title: 0 },
  jsonLd: { any: 0, product: 0, breadcrumb: 0, organization: 0 },
  robotsNoindex: 0,
  keywordsMeta: 0,
  oldDomainRefs: 0,
  naboplasticEmail: 0,
  h1: { present: 0, missing: 0 },
};

const issues = {
  noCanonical: [],
  oldCanonical: [],
  noDescription: [],
  noTitle: [],
  titleNoKeyword: [],
  descNoKeyword: [],
  noindex: [],
  oldDomainInBody: [],
  noH1: [],
  longTitles: [],
  longDescriptions: [],
};

const pageTypes = { homepage: 0, product: 0, category: 0, blog: 0, upload: 0, other: 0 };

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  if (rel === 'index.html') pageTypes.homepage++;
  else if (rel.startsWith('product/')) pageTypes.product++;
  else if (rel.startsWith('wp-content/uploads/')) pageTypes.upload++;
  else if (
    rel.includes('product-category') ||
    /^(plastic-sprayers|plastic-caps|plastic-bottles|plastic-jars|pet-preforms|dispensing-pumps|fine-mist-sprayers|trigger-sprayer)/.test(
      rel
    )
  )
    pageTypes.category++;
  else if (/\/(blog|news|author)\//.test(rel)) pageTypes.blog++;
  else pageTypes.other++;

  const canon = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (!canon) {
    stats.canonical.missing++;
    if (issues.noCanonical.length < 15) issues.noCanonical.push(rel);
  } else if (canon[1].includes('naboplastic.com')) {
    stats.canonical.oldDomain++;
    if (issues.oldCanonical.length < 15) issues.oldCanonical.push(rel);
  } else if (canon[1].includes('chinapackagingmaterials.com')) {
    stats.canonical.ok++;
  }

  const titleM = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!titleM) {
    stats.title.missing++;
    if (issues.noTitle.length < 10) issues.noTitle.push(rel);
  } else {
    stats.title.ok++;
    const t = decodeEntities(titleM[1]);
    if (/China Packaging Materials/i.test(t)) stats.title.withKeyword++;
    else {
      stats.title.withoutKeyword++;
      if (issues.titleNoKeyword.length < 10) issues.titleNoKeyword.push({ page: rel, title: t });
    }
    if (t.length > 70) {
      stats.title.tooLong++;
      if (issues.longTitles.length < 8) issues.longTitles.push({ page: rel, len: t.length, title: t.slice(0, 80) });
    }
  }

  const descM = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  if (!descM) {
    stats.description.missing++;
    if (issues.noDescription.length < 10) issues.noDescription.push(rel);
  } else {
    stats.description.ok++;
    const d = decodeEntities(descM[1]);
    if (/china packaging materials|packaging materials supplier|packaging manufacturer/i.test(d))
      stats.description.withKeyword++;
    else if (issues.descNoKeyword.length < 8) issues.descNoKeyword.push({ page: rel, desc: d.slice(0, 100) });
    if (d.length > 160) {
      stats.description.tooLong++;
      if (issues.longDescriptions.length < 8)
        issues.longDescriptions.push({ page: rel, len: d.length, desc: d.slice(0, 90) + '...' });
    }
    if (d.length < 50) stats.description.tooShort++;
  }

  if (/<meta\s+property=["']og:title["']/i.test(html)) stats.og.title++;
  if (/<meta\s+property=["']og:url["']/i.test(html)) stats.og.url++;
  if (/<meta\s+property=["']og:image["']/i.test(html)) stats.og.image++;
  if (/<meta\s+property=["']og:description["']/i.test(html)) stats.og.description++;
  if (/twitter:card/i.test(html)) stats.twitter.card++;
  if (/twitter:title/i.test(html)) stats.twitter.title++;

  if (/application\/ld\+json/i.test(html)) stats.jsonLd.any++;
  if (/"@type"\s*:\s*"Product"/i.test(html)) stats.jsonLd.product++;
  if (/"@type"\s*:\s*"BreadcrumbList"/i.test(html)) stats.jsonLd.breadcrumb++;
  if (/"@type"\s*:\s*"Organization"/i.test(html)) stats.jsonLd.organization++;

  if (/<meta\s+name=["']keywords["']/i.test(html)) stats.keywordsMeta++;
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    stats.robotsNoindex++;
    if (issues.noindex.length < 15) issues.noindex.push(rel);
  }

  if (/naboplastic\.com/i.test(html)) {
    stats.oldDomainRefs++;
    if (issues.oldDomainInBody.length < 15) issues.oldDomainInBody.push(rel);
  }
  if (/@[a-z0-9.-]*naboplastic\.com/i.test(html)) stats.naboplasticEmail++;

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) stats.h1.present++;
  else {
    stats.h1.missing++;
    if (issues.noH1.length < 10) issues.noH1.push(rel);
  }
}

const sitemapPath = path.join(ROOT, 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const sitemapUrls = (sitemap.match(/<loc>/g) || []).length;

const report = {
  generatedAt: new Date().toISOString(),
  targetDomain: SITE,
  brandKeywords: [
    'China Packaging Materials',
    'KIWL Plastic',
    'plastic sprayers',
    'dispensing pumps',
    'plastic caps',
    'plastic bottles',
    'OEM/ODM packaging',
  ],
  summary: {
    totalHtmlPages: stats.totalPages,
    sitemapIndexableUrls: sitemapUrls,
    canonicalCoverage: `${stats.canonical.ok}/${stats.totalPages}`,
    titleKeywordCoverage: `${stats.title.withKeyword}/${stats.title.ok}`,
    descriptionKeywordCoverage: `${stats.description.withKeyword}/${stats.description.ok}`,
    productSchemaPages: stats.jsonLd.product,
  },
  pageTypes,
  stats,
  sampleIssues: issues,
  recommendations: [],
};

// Build recommendations
if (stats.canonical.missing > 0)
  report.recommendations.push({ priority: 'high', item: `补全 ${stats.canonical.missing} 个缺失 canonical 的页面` });
if (stats.canonical.oldDomain > 0)
  report.recommendations.push({ priority: 'high', item: `修复 ${stats.canonical.oldDomain} 个仍指向 naboplastic.com 的 canonical` });
if (stats.oldDomainRefs > 0)
  report.recommendations.push({ priority: 'high', item: `清理 ${stats.oldDomainRefs} 个页面中的 naboplastic.com 残留链接/引用` });
if (stats.title.withoutKeyword > 0)
  report.recommendations.push({
    priority: 'medium',
    item: `${stats.title.withoutKeyword} 个页面 Title 未含核心词 "China Packaging Materials"`,
  });
if (stats.description.ok - stats.description.withKeyword > 50)
  report.recommendations.push({
    priority: 'medium',
    item: `约 ${stats.description.ok - stats.description.withKeyword} 个 Meta Description 未含行业关键词，可批量补充`,
  });
if (stats.keywordsMeta === 0)
  report.recommendations.push({
    priority: 'low',
    item: '未使用 meta keywords（Google 已忽略，无需添加）',
  });
if (stats.title.tooLong > 0)
  report.recommendations.push({ priority: 'low', item: `${stats.title.tooLong} 个 Title 超过 70 字符，可能在搜索结果中被截断` });
if (stats.description.tooLong > 0)
  report.recommendations.push({ priority: 'low', item: `${stats.description.tooLong} 个 Description 超过 160 字符` });
if (pageTypes.upload > 0)
  report.recommendations.push({
    priority: 'medium',
    item: `${pageTypes.upload} 个 wp-content/uploads 下的 HTML 镜像页建议 noindex 或从 sitemap 排除`,
  });
if (stats.robotsNoindex > 0)
  report.recommendations.push({
    priority: 'info',
    item: `${stats.robotsNoindex} 个页面已设置 noindex（已从 sitemap 排除 ${stats.totalPages - sitemapUrls} 个）`,
  });

report.overallStatus =
  stats.canonical.oldDomain === 0 &&
  stats.canonical.missing === 0 &&
  stats.title.withKeyword / stats.title.ok > 0.95 &&
  stats.oldDomainRefs < 20
    ? 'good'
    : stats.canonical.oldDomain === 0 && stats.canonical.missing < 10
      ? 'needs_minor_tuning'
      : 'needs_work';

console.log(JSON.stringify(report, null, 2));
