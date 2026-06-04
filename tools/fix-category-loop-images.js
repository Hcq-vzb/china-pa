/**
 * Fix woocommerce category loop images:
 * - Download missing category thumbnails from live site
 * - Remove icon-arrow-down / logo assets from srcset
 * - Normalize Child-Resistant-Caps and other category src/srcset
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const LIVE = 'https://www.naboplastic.com';
const BAD = /site-logo_NABO_Plastic|sticky-logo_NABO_Plastic|icon-arrow-down_NABO_Plastic|file-icon_NABO_Plastic/i;

const CHILD_BASE = 'wp-content/uploads/2023/11/Child-Resistant-Caps-categories-4_NABO_Plastic';
const CHILD_VARIANTS = [
  '',
  '-64x64',
  '-100x100',
  '-180x180',
  '-300x300',
  '-480x480',
].map((s) => `${CHILD_BASE}${s}.jpg`);

function listHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (rel.startsWith('tools/') || rel.startsWith('wp-content/')) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) listHtmlFiles(full, out);
    else if (/\.html?$/i.test(name)) out.push(full);
  }
  return out;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (category-fix)' } }, (res) => {
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

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function uploadExists(relUpload) {
  const local = path.join(ROOT, relUpload.replace(/\//g, path.sep));
  return fs.existsSync(local) && fs.statSync(local).size > 0;
}

function buildChildSrcset(prefix) {
  const p = prefix + CHILD_BASE;
  const parts = [];
  if (uploadExists(CHILD_BASE + '.jpg')) parts.push(`${p}.jpg 180w`);
  if (uploadExists(CHILD_BASE + '-180x180.jpg')) parts.push(`${p}-180x180.jpg 64w`);
  if (uploadExists(CHILD_BASE + '-100x100.jpg')) parts.push(`${p}-100x100.jpg 100w`);
  if (uploadExists(CHILD_BASE + '-64x64.jpg')) parts.push(`${p}-64x64.jpg 300w`);
  return parts.join(', ');
}

function stripBadFromSrcset(srcset) {
  return srcset
    .split(',')
    .map((s) => s.trim())
    .filter((entry) => {
      const url = entry.split(/\s+/)[0];
      return url && !BAD.test(url);
    })
    .join(', ');
}

function fixHtml(html, pageFile) {
  let fixes = 0;
  let out = html;
  const prefix = depthPrefix(pageFile);

  // Remove bad entries from any srcset
  out = out.replace(/srcset="([^"]*)"/gi, (m, srcset) => {
    if (!BAD.test(srcset)) return m;
    const cleaned = stripBadFromSrcset(srcset);
    if (cleaned === srcset) return m;
    fixes++;
    return `srcset="${cleaned}"`;
  });

  // Child Resistant Caps category tiles
  const childSrc = `${prefix}${CHILD_BASE}-100x100.jpg`;
  const childSrcset = buildChildSrcset(prefix);
  const childLinkRe =
    /<a[^>]*href="[^"]*child-resistant-caps\/index\.html"[^>]*>[\s\S]*?<img([^>]*)\/>[\s\S]*?<h2 class="woocommerce-loop-category__title">/gi;

  out = out.replace(childLinkRe, (block, imgAttrs) => {
    if (!/Child-Resistant-Caps-categories|Child Resistant/i.test(block)) return block;
    let attrs = imgAttrs;
    let changed = false;

    if (BAD.test(attrs) || /Child-Resistant-Caps-categories[^"]*-300x300/.test(attrs)) {
      attrs = attrs.replace(
        /src="[^"]*"/i,
        `src="${childSrc}"`
      );
      changed = true;
    }

    if (childSrcset && (/icon-arrow-down|Child-Resistant-Caps-categories[^"]*\.(jpg|svg)/i.test(attrs))) {
      const badSrcset =
        /srcset="[^"]*"/i.test(attrs) &&
        (/icon-arrow-down|\.\.\/\.\.\/wp-content/i.test(attrs) ||
          BAD.test(attrs) ||
          !attrs.includes(`${CHILD_BASE}.jpg`));
      if (badSrcset || BAD.test(attrs)) {
        if (/srcset="[^"]*"/i.test(attrs)) {
          attrs = attrs.replace(/srcset="[^"]*"/i, `srcset="${childSrcset}"`);
        } else {
          attrs += ` srcset="${childSrcset}"`;
        }
        changed = true;
      }
    }

    if (changed) {
      fixes++;
      return block.replace(imgAttrs, attrs);
    }
    return block;
  });

  // Fix ../../ in srcset paths (one level too many from plastic-caps depth)
  out = out.replace(/srcset="\.\.\/\.\.\/wp-content\//gi, () => {
    fixes++;
    return `srcset="${prefix}wp-content/`;
  });

  return { html: out, fixes };
}

async function main() {
  console.log('Downloading Child-Resistant-Caps category images...');
  let dlOk = 0;
  let dlFail = 0;
  for (const ref of CHILD_VARIANTS) {
    const local = path.join(ROOT, ref.replace(/\//g, path.sep));
    if (uploadExists(ref)) continue;
    try {
      await download(`${LIVE}/${ref}`, local);
      dlOk++;
      console.log(`  OK ${ref}`);
    } catch (e) {
      dlFail++;
      console.log(`  FAIL ${ref}: ${e.message}`);
    }
  }

  const files = listHtmlFiles(ROOT);
  let totalFixes = 0;
  let filesChanged = 0;

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/woocommerce-loop-category|Child-Resistant-Caps|icon-arrow-down/i.test(html)) continue;
    const { html: next, fixes } = fixHtml(html, file);
    if (fixes > 0) {
      fs.writeFileSync(file, next, 'utf8');
      totalFixes += fixes;
      filesChanged++;
    }
  }

  // Fix og:image on child-resistant-caps category page
  const crcPage = path.join(ROOT, 'product-category/child-resistant-caps/index.html');
  if (fs.existsSync(crcPage)) {
    let html = fs.readFileSync(crcPage, 'utf8');
    const ogFix = html.replace(
      /(property="og:image" content=")[^"]*(file-icon_NABO_Plastic[^"]*)(")/i,
      `$1https://www.chinapackagingmaterials.com/${CHILD_BASE}-480x480.jpg$3`
    );
    if (ogFix !== html) {
      fs.writeFileSync(crcPage, ogFix, 'utf8');
      console.log('Fixed og:image on product-category/child-resistant-caps');
    }
  }

  console.log(`Downloaded: ${dlOk} ok, ${dlFail} failed`);
  console.log(`HTML fixes: ${totalFixes} in ${filesChanged} files`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
