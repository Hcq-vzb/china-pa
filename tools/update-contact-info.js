/**
 * Site-wide phone and email update.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['tools', 'node_modules', '.git']);

const REPLACEMENTS = [
  // Phone — longest / most specific first
  ['tel:+86%20132%202160%200233', 'tel:+8618151132311'],
  ['tel:+86%20132-2160-0233', 'tel:+8618151132311'],
  ['tel:+86 132 2160 0233', 'tel:+8618151132311'],
  ['tel:+8613221600233', 'tel:+8618151132311'],
  ['tel:+86-132-2160-0233', 'tel:+8618151132311'],
  ['+86-132-2160-0233', '+86-18151132311'],
  ['+86 132 2160 0233', '+86-18151132311'],
  ['+8613221600233', '+8618151132311'],
  ['132-2160-0233', '18151132311'],
  ['132 2160 0233', '18151132311'],
  ['13221600233', '18151132311'],
  // Email — info uses Cathy; all other @naboplastic.com → same local @chinapackagingmaterials.com
  ['info@naboplastic.com', 'cathy@chinapackagingmaterials.com'],
  ['@naboplastic.com', '@chinapackagingmaterials.com'],
];

const EXT = new Set([
  '.html',
  '.htm',
  '.xml',
  '.json',
  '.txt',
  '.js',
  '.css',
  '.md',
]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const top = rel.split('/')[0];
    if (SKIP_DIRS.has(top)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(name).toLowerCase())) files.push(full);
  }
  return files;
}

function applyReplacements(text) {
  let out = text;
  let count = 0;
  for (const [from, to] of REPLACEMENTS) {
    if (!out.includes(from)) continue;
    const parts = out.split(from);
    count += parts.length - 1;
    out = parts.join(to);
  }
  return { out, count };
}

function main() {
  const files = walk(ROOT);
  let changedFiles = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    if (!/132|info@naboplastic/i.test(raw)) continue;
    const { out, count } = applyReplacements(raw);
    if (count > 0) {
      fs.writeFileSync(file, out, 'utf8');
      changedFiles++;
      totalReplacements += count;
    }
  }

  console.log(`Files updated: ${changedFiles}`);
  console.log(`Replacements: ${totalReplacements}`);
}

main();
