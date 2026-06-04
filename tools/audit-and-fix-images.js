/**
 * Audit image references in HTML, download missing from live site, fix broken paths.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const LIVE = 'https://www.naboplastic.com';
const CONCURRENCY = 10;

const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif|ico|bmp)(\?[^"'\\s>]*)?$/i;

function listHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (rel.startsWith('tools/')) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) listHtmlFiles(full, out);
    else if (/\.html?$/i.test(name)) out.push(full);
  }
  return out;
}

function normalizeUploadPath(raw) {
  if (!raw) return null;
  let p = raw.trim();
  if (/^data:/i.test(p)) return null;
  if (/^https?:\/\//i.test(p)) {
    const m = p.match(/\/wp-content\/uploads\/[^?"'\s#)]+/i);
    return m ? m[0].replace(/^\//, '') : null;
  }
  p = p.replace(/^url\(/i, '').replace(/\)$/, '');
  p = p.replace(/^['"]|['"]$/g, '');
  p = p.replace(/^(\.\.\/)+/, '');
  if (p.startsWith('/')) p = p.slice(1);
  if (!p.startsWith('wp-content/uploads/')) return null;
  p = p.split('?')[0].split('#')[0];
  if (!IMG_EXT.test(p)) return null;
  return p;
}

function resolveFromHtml(relUpload, htmlFile) {
  const relDir = path.dirname(path.relative(ROOT, htmlFile));
  const parts = relDir === '.' ? [] : relDir.split(/[/\\]/);
  let p = relUpload;
  while (p.startsWith('../')) {
    p = p.slice(3);
    parts.pop();
  }
  return path.join(ROOT, ...parts, p).replace(/\\/g, '/');
}

function extractImageRefs(html) {
  const refs = new Set();
  const patterns = [
    /(?:src|href|data-src|data-lazy-src|data-bg|poster)\s*=\s*["']([^"']+)["']/gi,
    /(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
    /content\s*=\s*["'](wp-content\/uploads\/[^"']+)["']/gi,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const chunk = m[1];
      if (re === patterns[1]) {
        for (const part of chunk.split(',')) {
          const u = part.trim().split(/\s+/)[0];
          const n = normalizeUploadPath(u);
          if (n) refs.add(n);
        }
        continue;
      }
      const n = normalizeUploadPath(chunk);
      if (n) refs.add(n);
    }
  }
  return refs;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (image-audit-fix)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          download(next, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

function fixBrokenPaths(html) {
  let out = html;
  let fixes = 0;

  // url(wp-content/...) -> relative path without url() in attributes
  out = out.replace(
    /(\s(?:src|href|data-src|data-lazy-src|poster)\s*=\s*["'])url\((wp-content\/uploads\/[^)]+)\)(["'])/gi,
    (_, a, p, c) => {
      fixes++;
      return `${a}${p}${c}`;
    }
  );

  // CSS background: url(wp-content/...) broken
  out = out.replace(/url\(\s*(wp-content\/uploads\/[^)]+)\s*\)/gi, (m, p) => {
    if (m.includes('url(url(')) return m;
    fixes++;
    return `url(${p})`;
  });

  return { html: out, fixes };
}

async function main() {
  const files = listHtmlFiles(ROOT);
  const allRefs = new Map(); // uploadPath -> Set<htmlFiles>

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    for (const ref of extractImageRefs(html)) {
      if (!allRefs.has(ref)) allRefs.set(ref, new Set());
      allRefs.get(ref).add(file);
    }
  }

  const missing = [];
  const empty = [];
  for (const [ref] of allRefs) {
    const local = path.join(ROOT, ref.replace(/\//g, path.sep));
    if (!fs.existsSync(local)) missing.push(ref);
    else if (fs.statSync(local).size === 0) empty.push(ref);
  }

  console.log(`HTML files scanned: ${files.length}`);
  console.log(`Unique upload images referenced: ${allRefs.size}`);
  console.log(`Missing locally: ${missing.length}`);
  console.log(`Empty files: ${empty.length}`);

  const toFetch = [...new Set([...missing, ...empty])];
  const failures = [];
  let ok = 0;
  let idx = 0;

  async function worker() {
    while (idx < toFetch.length) {
      const i = idx++;
      const ref = toFetch[i];
      const local = path.join(ROOT, ref.replace(/\//g, path.sep));
      const url = `${LIVE}/${ref}`;
      try {
        await download(url, local);
        ok++;
      } catch (e) {
        failures.push({ ref, error: e.message });
      }
      if ((i + 1) % 50 === 0 || i + 1 === toFetch.length) {
        process.stdout.write(`\rDownload: ${i + 1}/${toFetch.length} ok=${ok} fail=${failures.length}`);
      }
    }
  }

  if (toFetch.length) {
    console.log(`\nDownloading ${toFetch.length} images from ${LIVE} ...`);
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    console.log('');
  }

  let pathFixes = 0;
  let filesFixed = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const { html: next, fixes } = fixBrokenPaths(html);
    if (fixes > 0) {
      fs.writeFileSync(file, next, 'utf8');
      pathFixes += fixes;
      filesFixed++;
    }
  }

  // Re-check missing after download
  const stillMissing = [];
  for (const [ref] of allRefs) {
    const local = path.join(ROOT, ref.replace(/\//g, path.sep));
    if (!fs.existsSync(local) || fs.statSync(local).size === 0) stillMissing.push(ref);
  }

  const report = {
    scannedHtml: files.length,
    uniqueRefs: allRefs.size,
    downloadedOk: ok,
    downloadFailed: failures.length,
    pathFixes,
    filesWithPathFixes: filesFixed,
    stillMissing: stillMissing.length,
    failures: failures.slice(0, 200),
    stillMissingList: stillMissing.slice(0, 200),
  };

  fs.writeFileSync(path.join(__dirname, 'image-audit-report.json'), JSON.stringify(report, null, 2));
  if (failures.length) {
    fs.writeFileSync(
      path.join(__dirname, 'image-audit-failures.txt'),
      failures.map((f) => `${f.ref}\t${f.error}`).join('\n')
    );
  }

  console.log(`Path fixes in HTML: ${pathFixes} (${filesFixed} files)`);
  console.log(`Still missing after download: ${stillMissing.length}`);
  console.log(`Report: tools/image-audit-report.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
