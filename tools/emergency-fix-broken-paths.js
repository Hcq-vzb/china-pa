/**
 * Emergency fix: restore NABO asset paths corrupted by replace-nabo-with-kiwl.ps1
 * (all placeholders became ___ASSET_0___) and strip invalid url() wrappers in attributes.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const LIVE = 'https://www.naboplastic.com';
const CONCURRENCY = 8;

const naboPathRe =
  /(?:https?:\/\/[^/"'\s>]+)?((?:\.\.\/)*wp-content\/uploads\/[^\s"'<>)\]]*NABO[^\s"'<>)\]]*)/gi;

const localNaboRe =
  /(?:url\(((?:\.\.\/)*wp-content\/uploads\/[^)\s"'<>]+)\)|((?:\.\.\/)*wp-content\/uploads\/[^\s"'<>)\]]*NABO[^\s"'<>)\]]*))/gi;

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

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function toLiveUrl(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const slug = rel.replace(/index\.html$/, '').replace(/\/$/, '');
  if (!slug || slug === 'index.html') return `${LIVE}/`;
  return `${LIVE}/${slug}`;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (local-mirror-fix)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`${url} -> HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function normalizeLivePath(raw, prefix) {
  let p = raw.replace(/^(?:\.\.\/)+/, '');
  if (p.startsWith('http')) {
    const idx = p.indexOf('/wp-content/');
    p = idx >= 0 ? p.slice(idx + 1) : p;
  }
  if (p.startsWith('/')) p = p.slice(1);
  return prefix + p;
}

function extractLiveNaboPaths(html, prefix) {
  const paths = [];
  let m;
  naboPathRe.lastIndex = 0;
  while ((m = naboPathRe.exec(html)) !== null) {
    paths.push(normalizeLivePath(m[1], prefix));
  }
  return paths;
}

function stripBadUrlWrappers(text) {
  // CSS double-wrap: url('url(path)') -> url('path')
  text = text.replace(
    /url\((['"]?)url\(((?:\.\.\/)*wp-content\/[^)]+)\)\1\)/g,
    "url($1$2$1)"
  );
  // HTML attributes: src="url(path)" -> src="path"
  text = text.replace(
    /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])url\(((?:\.\.\/)*wp-content\/uploads\/[^)]+)\)\2/g,
    ' $1=$2$3$2'
  );
  // srcset / imagesrcset entries: url(path) 480w -> path 480w
  text = text.replace(
    /url\(((?:\.\.\/)*wp-content\/uploads\/[^)]+)\)(?=\s+\d+[wx])/g,
    '$1'
  );
  return text;
}

function restoreNaboPaths(localText, livePaths) {
  if (!livePaths.length) return localText;

  let i = 0;
  localNaboRe.lastIndex = 0;
  return localText.replace(localNaboRe, (full, wrappedPath, barePath) => {
    if (i >= livePaths.length) return full;
    const replacement = livePaths[i++];
    if (full.startsWith('url(')) return `url(${replacement})`;
    return replacement;
  });
}

function fixLogos(text, prefix) {
  const siteLogo = `${prefix}wp-content/uploads/2023/10/site-logo_NABO_Plastic.png`;
  const stickyLogo = `${prefix}wp-content/uploads/2023/10/sticky-logo_NABO_Plastic.png`;

  text = text.replace(/site-logo_NABO_Plastic\.svg/gi, 'site-logo_NABO_Plastic.png');
  text = text.replace(/sticky-logo_NABO_Plastic\.svg/gi, 'sticky-logo_NABO_Plastic.png');

  const sitePat = /(?:\/|(?:\.\.\/)+)?wp-content\/uploads\/2023\/10\/site-logo_NABO_Plastic\.png/g;
  const stickyPat = /(?:\/|(?:\.\.\/)+)?wp-content\/uploads\/2023\/10\/sticky-logo_NABO_Plastic\.png/g;
  text = text.replace(sitePat, siteLogo);
  text = text.replace(stickyPat, stickyLogo);

  // Header logos should not use arrow icon
  text = text.replace(
    /(<img[^>]*class="[^"]*is-logo-image[^"]*"[^>]*\ssrc=")([^"]+)(")/gi,
    (m, a, src, c) => {
      if (src.includes('icon-arrow-down_NABO_Plastic')) return `${a}${siteLogo}${c}`;
      return m;
    }
  );
  text = text.replace(
    /(<img[^>]*\ssrc=")([^"]+)("[^>]*class="[^"]*is-logo-image[^"]*")/gi,
    (m, a, src, c) => {
      if (src.includes('icon-arrow-down_NABO_Plastic')) return `${a}${siteLogo}${c}`;
      return m;
    }
  );

  return text;
}

async function processFile(filePath, cache) {
  let text = fs.readFileSync(filePath, 'utf8');
  const before = text;

  if (!/NABO|url\(wp-content|url\(\.\./.test(text)) return false;

  text = stripBadUrlWrappers(text);

  const prefix = depthPrefix(filePath);
  const liveUrl = toLiveUrl(filePath);

  try {
    if (!cache.has(liveUrl)) {
      cache.set(liveUrl, await fetchText(liveUrl));
    }
    const liveHtml = cache.get(liveUrl);
    const livePaths = extractLiveNaboPaths(liveHtml, prefix);
    text = restoreNaboPaths(text, livePaths);
  } catch (err) {
    console.warn(`WARN ${path.relative(ROOT, filePath)}: live fetch failed (${err.message}), url-wrap fix only`);
  }

  text = fixLogos(text, prefix);

  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf8');
    return true;
  }
  return false;
}

async function runPool(items, worker, size) {
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: size }, next));
}

(async () => {
  const files = listHtmlFiles(ROOT);
  const cache = new Map();
  let changed = 0;
  let done = 0;

  await runPool(
    files,
    async (file) => {
      const ok = await processFile(file, cache);
      if (ok) changed++;
      done++;
      if (done % 50 === 0) console.log(`Progress ${done}/${files.length}...`);
    },
    CONCURRENCY
  );

  console.log(`Fixed ${changed} / ${files.length} HTML files`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
