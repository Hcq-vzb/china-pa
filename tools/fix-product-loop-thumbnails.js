/**
 * Fix product loop thumbnails using site logo instead of product image.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BAD_SRC = /site-logo_NABO_Plastic|sticky-logo_NABO_Plastic|icon-arrow-down_NABO_Plastic/i;

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

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const depth = parts.length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function toPageRelative(uploadPath, pageFile) {
  const prefix = depthPrefix(pageFile);
  const clean = uploadPath.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
  return prefix + clean;
}

function extractThumbnailFromProduct(html) {
  const imgs = [...html.matchAll(/src="((?:\.\.\/)*wp-content\/uploads\/[^"]+\.(?:jpe?g|png|webp))"/gi)];
  for (const m of imgs) {
    if (!BAD_SRC.test(m[1]) && /180x180|100x100|480x480/.test(m[1])) return m[1];
  }

  const thumb = html.match(/data-thumb="((?:\.\.\/)*wp-content\/uploads\/[^"]+)"/i);
  if (thumb && !BAD_SRC.test(thumb[1])) {
    const base = thumb[1].replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '');
    const ext = thumb[1].match(/\.(jpe?g|png|webp)$/i)[0];
    return `${base}-180x180${ext}`;
  }

  const og = html.match(/property="og:image" content="[^"]*\/(wp-content\/uploads\/[^"]+)"/i);
  if (og && !BAD_SRC.test(og[1])) {
    const p = og[1];
    if (/-\d+x\d+\./i.test(p)) return p;
    const ext = p.match(/\.(jpe?g|png|webp)$/i)[0];
    return p.replace(/\.(jpe?g|png|webp)$/i, `-180x180${ext}`);
  }
  return null;
}

function extractSrcsetFromProduct(html, baseUpload) {
  const baseName = path.basename(baseUpload).replace(/-\d+x\d+/, '');
  const entries = new Set();
  const re = new RegExp(
    `((?:\\.\\./)*wp-content/uploads/[^"'\\s]+${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"'\\s]*\\.(?:jpe?g|png|webp))(?:\\s+\\d+w)?`,
    'gi'
  );
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!BAD_SRC.test(m[1])) entries.add(m[1]);
  }
  if (!entries.size) {
    const single = html.match(
      new RegExp(`((?:\\.\\./)*wp-content/uploads/[^"']+${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*180x180\\.(?:jpe?g|png|webp))`, 'i')
    );
    if (single) entries.add(single[1]);
  }
  const list = [...entries].slice(0, 8);
  return list
    .map((u) => {
      const dim = u.match(/-(\d+)x(\d+)\./);
      const w = dim ? dim[1] : '180';
      return `${u} ${w}w`;
    })
    .join(', ');
}

function fixPage(html, pageFile) {
  let fixes = 0;
  const productCache = new Map();

  const next = html.replace(
    /<a\s+href="([^"]*\/product\/[^"]+\/index\.html)"[^>]*class="[^"]*woocommerce-LoopProduct-link[^"]*"[\s\S]*?<img([^>]*)\/>/gi,
    (block, productHref, imgAttrs) => {
      if (!BAD_SRC.test(imgAttrs) || !/size-woocommerce_thumbnail/i.test(imgAttrs)) return block;

      const slugMatch = productHref.match(/\/product\/([^/]+)\//);
      if (!slugMatch) return block;

      const slug = slugMatch[1];
      if (!productCache.has(slug)) {
        const productPath = path.join(ROOT, 'product', slug, 'index.html');
        if (!fs.existsSync(productPath)) return block;
        const productHtml = fs.readFileSync(productPath, 'utf8');
        const thumb = extractThumbnailFromProduct(productHtml);
        productCache.set(slug, { thumb, productHtml });
      }

      const data = productCache.get(slug);
      if (!data?.thumb) return block;

      const relThumb = toPageRelative(data.thumb, pageFile);
      const srcset = extractSrcsetFromProduct(data.productHtml, data.thumb);
      const relSrcset = srcset
        ? srcset
            .split(',')
            .map((part) => {
              const [u, w] = part.trim().split(/\s+/);
              return `${toPageRelative(u, pageFile)} ${w || ''}`.trim();
            })
            .join(', ')
        : '';

      let newAttrs = imgAttrs
        .replace(/src="[^"]*"/i, `src="${relThumb}"`)
        .replace(/srcset="[^"]*"/i, relSrcset ? `srcset="${relSrcset}"` : '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!/srcset="/i.test(newAttrs) && relSrcset) {
        newAttrs += ` srcset="${relSrcset}"`;
      }

      fixes++;
      return block.replace(imgAttrs, newAttrs);
    }
  );

  return { html: next, fixes };
}

let totalFixes = 0;
let filesChanged = 0;

for (const file of listHtmlFiles(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  const { html: next, fixes } = fixPage(html, file);
  if (fixes > 0) {
    fs.writeFileSync(file, next, 'utf8');
    totalFixes += fixes;
    filesChanged++;
    console.log(`Fixed ${fixes} thumbnail(s): ${path.relative(ROOT, file)}`);
  }
}

console.log(`Done: ${totalFixes} thumbnails in ${filesChanged} files`);
