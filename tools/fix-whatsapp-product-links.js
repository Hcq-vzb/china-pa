/**
 * Fix product page "Chat on WhatsApp" buttons:
 * - Link to https://wa.me/8617751189576
 * - Pre-filled message with current product URL (works for file:// and https://)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRODUCT_DIR = path.join(ROOT, 'product');
const WA_PHONE = '8617751189576';
const WA_BASE = `https://wa.me/${WA_PHONE}`;

const BUTTON_RE =
  /<button class="gb-button gb-button-dffa6e40 open-chat" aria-label="Chat on WhatsApp">([\s\S]*?)<\/button>/g;

const ANCHOR_RE =
  /<a class="gb-button gb-button-dffa6e40 open-chat"[^>]*aria-label="Chat on WhatsApp"[^>]*>([\s\S]*?)<\/a>/g;

// Remove broken inline wa.me scripts (data: URI or inline blocks)
const OLD_SCRIPT_PATTERNS = [
  /<script[^>]*defer[^>]*src="data:text\/javascript,[^"]*open-chat[^"]*"[^>]*><\/script>/gi,
  /<script[^>]*>\s*document\.addEventListener\(['"]DOMContentLoaded['"][\s\S]*?open-chat[\s\S]*?<\/script>/gi,
];

const SHARED_SCRIPT = `<script id="kiwl-whatsapp-product">
(function(){
  function productUrl(){
    return window.location.href;
  }
  function waHref(){
    var text="Hello, I'm interested in this product: "+productUrl();
    return "${WA_BASE}?text="+encodeURIComponent(text);
  }
  function bind(el){
    el.href=waHref();
    el.setAttribute("target","_blank");
    el.setAttribute("rel","noopener noreferrer");
  }
  function init(){
    document.querySelectorAll("a.open-chat, button.open-chat").forEach(function(el){
      if(el.tagName==="BUTTON"){
        var a=document.createElement("a");
        a.className=el.className;
        a.setAttribute("aria-label",el.getAttribute("aria-label")||"Chat on WhatsApp");
        a.innerHTML=el.innerHTML;
        bind(a);
        el.parentNode.replaceChild(a,el);
      } else {
        bind(el);
      }
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
</script>`;

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

function fixFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!/open-chat|Chat on WhatsApp/i.test(html)) return { changed: false };

  let changed = false;

  for (const re of OLD_SCRIPT_PATTERNS) {
    const next = html.replace(re, '');
    if (next !== html) {
      html = next;
      changed = true;
    }
  }

  // Strip old wa.me fragments inside other script tags (legacy one-liner)
  if (/wa\.me%2F|wa\.me\/8618/i.test(html)) {
    html = html.replace(
      /document\.addEventListener\(['"]DOMContentLoaded['"][\s\S]*?open-chat[\s\S]*?\}\);/gi,
      ''
    );
    changed = true;
  }

  if (BUTTON_RE.test(html)) {
    html = html.replace(
      BUTTON_RE,
      (_, inner) =>
        `<a class="gb-button gb-button-dffa6e40 open-chat" aria-label="Chat on WhatsApp" href="${WA_BASE}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    );
    changed = true;
  }

  BUTTON_RE.lastIndex = 0;

  if (ANCHOR_RE.test(html)) {
    html = html.replace(
      ANCHOR_RE,
      (_, inner) =>
        `<a class="gb-button gb-button-dffa6e40 open-chat" aria-label="Chat on WhatsApp" href="${WA_BASE}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    );
    changed = true;
  }

  if (!html.includes('id="kiwl-whatsapp-product"')) {
    const insertBefore = '</body>';
    if (html.includes(insertBefore)) {
      html = html.replace(insertBefore, `${SHARED_SCRIPT}\n${insertBefore}`);
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(file, html, 'utf8');
  return { changed };
}

function main() {
  const files = listProductHtml();
  let updated = 0;
  for (const file of files) {
    const { changed } = fixFile(file);
    if (changed) updated++;
  }
  console.log(`Product pages scanned: ${files.length}`);
  console.log(`Updated: ${updated}`);
}

main();
