/**
 * Prefix bare wp-content/ paths with ../ based on HTML file depth (nested pages).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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

function depthPrefix(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const depth = parts.length - 1;
  return depth > 0 ? '../'.repeat(depth) : '';
}

function prefixBarePaths(html, prefix) {
  if (!prefix) return { html, fixes: 0 };
  let fixes = 0;
  let out = html;

  const bump = (re) => {
    out = out.replace(re, (...args) => {
      fixes++;
      return args[0].replace(/wp-content\//, prefix + 'wp-content/');
    });
  };

  // CSS url(...) variants
  bump(/url\(\s*['"]wp-content\//g);
  bump(/url\(\s*wp-content\//g);
  // content: url for pseudo-elements in inline CSS
  bump(/content:\s*url\(\s*['"]wp-content\//g);

  // HTML attributes (not absolute URLs)
  bump(/(\s(?:src|href|data-src|data-lazy-src|poster|imagesrcset)\s*=\s*["'])wp-content\//gi);
  bump(/(\s(?:srcset|data-srcset)\s*=\s*["'][^"']*?\s)wp-content\//gi);

  // srcset comma-separated entries missing prefix
  out = out.replace(/(srcset|data-srcset)=(["'])([^"']+)\2/gi, (full, attr, q, val) => {
    const next = val.replace(/(?<![./\w])wp-content\//g, (m, off, s) => {
      const before = s.slice(Math.max(0, off - 12), off);
      if (before.includes('://') || before.endsWith('../')) return m;
      fixes++;
      return prefix + m;
    });
    return next === val ? full : `${attr}=${q}${next}${q}`;
  });

  return { html: out, fixes };
}

let filesChanged = 0;
let totalFixes = 0;

for (const file of listHtmlFiles(ROOT)) {
  const prefix = depthPrefix(file);
  const html = fs.readFileSync(file, 'utf8');
  const { html: next, fixes } = prefixBarePaths(html, prefix);
  if (fixes > 0) {
    fs.writeFileSync(file, next, 'utf8');
    filesChanged++;
    totalFixes += fixes;
  }
}

console.log(`Fixed ${totalFixes} bare wp-content paths in ${filesChanged} files`);
