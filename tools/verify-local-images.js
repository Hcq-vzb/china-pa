/**
 * Verify local server pages and image URLs return 200.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCAL = 'http://localhost:8080';

const PAGES = [
  '/',
  '/about-nabo-plastic/',
  '/product/plastic-lotion-pump/',
  '/product-category/trigger-sprayers/',
  '/product-category/trigger-sprayers/page/2/',
  '/product-category/plastic-bottles/page/2/',
  '/plastic-caps/',
  '/product-category/child-resistant-caps/',
  '/stretch-blow-mould/',
  '/contact/',
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { headers: { 'User-Agent': 'local-verify/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(new URL(res.headers.location, url).href).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      })
      .on('error', reject);
  });
}

function head(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', headers: { 'User-Agent': 'local-verify/1.0' } }, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

function extractAssetUrls(html, pageUrl) {
  const urls = new Set();
  const attrRe = /(?:src|href|srcset|data-src|data-lazy-src|poster|imagesrcset)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    const val = m[1];
    if (/srcset|imagesrcset/i.test(m[0])) {
      for (const part of val.split(',')) {
        const u = part.trim().split(/\s+/)[0];
        if (u && !u.startsWith('data:') && /wp-content\/uploads\//i.test(u)) {
          urls.add(new URL(u, pageUrl).href);
        }
      }
    } else if (val && !val.startsWith('data:') && /wp-content\/uploads\//i.test(val)) {
      urls.add(new URL(val, pageUrl).href);
    }
  }
  const cssRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  while ((m = cssRe.exec(html)) !== null) {
    const u = m[1].trim();
    if (/wp-content\/uploads\//i.test(u) && !u.startsWith('data:')) {
      urls.add(new URL(u, pageUrl).href);
    }
  }
  return [...urls].filter((u) => u.startsWith(LOCAL));
}

async function main() {
  const broken = [];
  const checked = new Set();

  for (const page of PAGES) {
    const pageUrl = LOCAL + page;
    let res;
    try {
      res = await fetchText(pageUrl);
    } catch (e) {
      broken.push({ type: 'page', url: pageUrl, status: 0, error: e.message });
      continue;
    }
    if (res.status !== 200) {
      broken.push({ type: 'page', url: pageUrl, status: res.status });
      continue;
    }

    const imgs = extractAssetUrls(res.body, pageUrl);
    for (const img of imgs) {
      if (checked.has(img)) continue;
      checked.add(img);
      const st = await head(img);
      if (st !== 200) {
        broken.push({ type: 'image', url: img, status: st, from: page });
      }
    }
  }

  const out = {
    pagesChecked: PAGES.length,
    imagesChecked: checked.size,
    brokenCount: broken.length,
    broken,
  };
  fs.writeFileSync(path.join(__dirname, 'local-verify-report.json'), JSON.stringify(out, null, 2));
  console.log(`Pages: ${PAGES.length}, images checked: ${checked.size}, broken: ${broken.length}`);
  if (broken.length) {
    for (const b of broken.slice(0, 30)) console.log(`${b.type}\t${b.status}\t${b.url}`);
  }
}

main().catch(console.error);
