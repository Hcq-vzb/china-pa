/**
 * Fix product "Get the Best Quote Now" buttons for static hosting.
 * Injects kiwl-quote-cart.js to intercept WooCommerce POST add-to-cart forms.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'product');
const MARKER = 'kiwl-quote-cart.js';
const QUOTE_PAGE = path.join(ROOT, 'request-the-best-price', 'index.html');

function listProductHtml() {
  const out = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/index\.html?$/i.test(name)) out.push(full);
    }
  }
  walk(PRODUCT_DIR);
  return out;
}

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function injectTag(prefix) {
  return `<script src="${prefix}wp-content/kiwl-quote/kiwl-quote-cart.js" defer></script>`;
}

function fixFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('single_add_to_cart_button') && !html.includes('woocommerce-checkout')) {
    return false;
  }
  if (html.includes(MARKER)) return false;

  const tag = injectTag(depthPrefix(file));
  const bodyIdx = html.lastIndexOf('</body>');
  if (bodyIdx === -1) return false;

  html = html.slice(0, bodyIdx) + tag + '\n' + html.slice(bodyIdx);
  fs.writeFileSync(file, html, 'utf8');
  return true;
}

function main() {
  const files = listProductHtml();
  if (fs.existsSync(QUOTE_PAGE)) files.push(QUOTE_PAGE);

  let updated = 0;
  for (const file of files) {
    if (fixFile(file)) updated++;
  }

  console.log(`Pages scanned: ${files.length}`);
  console.log(`Injected quote cart script: ${updated}`);
}

main();
