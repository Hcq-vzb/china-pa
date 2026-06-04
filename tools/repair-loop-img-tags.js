/**
 * Repair product loop <img> tags (logo src, mangled markup).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BAD = /site-logo_NABO_Plastic|sticky-logo_NABO_Plastic|icon-arrow-down_NABO_Plastic/i;

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function toPageRelative(uploadPath, pageFile) {
  const prefix = depthPrefix(pageFile);
  return prefix + uploadPath.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
}

function getThumbnailFromProduct(productHtml) {
  const blocks = [
    productHtml.match(/imagesrcset='([^']+)'/i)?.[1],
    productHtml.match(/data-thumb-srcset="([^"]+)"/i)?.[1],
  ].filter(Boolean);

  for (const block of blocks) {
    const parts = block.split(',').map((p) => p.trim());
    for (const part of parts) {
      const [url] = part.split(/\s+/);
      if (BAD.test(url)) continue;
      if (/180x180\.(jpe?g|png|webp)$/i.test(url)) return { url, srcset: block };
    }
    const firstUrl = parts[0]?.split(/\s+/)[0];
    if (firstUrl && !BAD.test(firstUrl) && /wp-content\/uploads\//i.test(firstUrl)) {
      const ext = firstUrl.match(/\.(jpe?g|png|webp)$/i)?.[1] || 'jpg';
      const base = firstUrl.replace(/-\d+x\d+\.\w+$/i, '').replace(/\.\w+$/i, '');
      const url = `${base}-180x180.${ext}`;
      return { url, srcset: block };
    }
  }
  return null;
}

function normalizeSrcset(srcset, pageFile) {
  return srcset
    .split(',')
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      const url = toPageRelative(bits[0], pageFile);
      const w = bits[1] || '180w';
      return `${url} ${w}`;
    })
    .join(', ');
}

function repairFile(pagePath) {
  let html = fs.readFileSync(pagePath, 'utf8');
  let fixes = 0;

  html = html.replace(
    /<a\s+href="([^"]*\/product\/([^/]+)\/index\.html)"[^>]*class="[^"]*woocommerce-LoopProduct-link[^"]*"[\s\S]*?<img([^>]*)\/>/gi,
    (block, _href, slug, attrs) => {
      const broken =
        /<imgdecoding/i.test(block) ||
        BAD.test(attrs) ||
        /alt="[^"]*"\s+"/.test(attrs) ||
        /src="[^"]*\.(?:jpe?g|png|webp)\s+\d+w/i.test(attrs) ||
        (!/src="[^"]*180x180\.(jpe?g|png|webp)"/i.test(attrs) && BAD.test(attrs));

      if (!broken) return block;

      const productPath = path.join(ROOT, 'product', slug, 'index.html');
      if (!fs.existsSync(productPath)) return block;

      const productHtml = fs.readFileSync(productPath, 'utf8');
      const data = getThumbnailFromProduct(productHtml);
      if (!data) return block;

      const relThumb = toPageRelative(data.url, pagePath);
      const srcset = normalizeSrcset(data.srcset, pagePath);
      const altMatch = attrs.match(/alt="([^"]*)"/i);
      const alt = altMatch ? altMatch[1] : '';
      const loading = /loading="lazy"/i.test(attrs) ? ' loading="lazy"' : '';

      const newImg = `<img decoding="async"${loading} width="180" height="180" src="${relThumb}" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="${alt}" srcset="${srcset}" sizes="(max-width: 180px) 100vw, 180px"/>`;

      fixes++;
      return block.replace(/<img[^>]*\/>/i, newImg);
    }
  );

  if (fixes > 0) {
    fs.writeFileSync(pagePath, html, 'utf8');
    console.log(`Repaired ${fixes}: ${path.relative(ROOT, pagePath)}`);
  }
  return fixes;
}

function listHtml(dir, out = []) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (rel.startsWith('tools/') || rel.startsWith('wp-content/')) continue;
      let st;
      try {
        st = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(full);
      else if (/\.html?$/i.test(name)) out.push(full);
    }
  }
  return out;
}

let total = 0;
for (const file of listHtml(ROOT)) {
  const html = fs.readFileSync(file, 'utf8');
  if (
    /<imgdecoding/i.test(html) ||
    /size-woocommerce_thumbnail[^>]*src="[^"]*(?:site-logo|sticky-logo)/i.test(html) ||
    /src="[^"]*\.(?:jpe?g|png|webp)\s+\d+w/i.test(html)
  ) {
    total += repairFile(file);
  }
}
console.log(`Total repaired: ${total}`);
