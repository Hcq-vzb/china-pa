/**
 * Parallel image downloader for naboplastic static mirror
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://www.naboplastic.com/';
const MANIFEST = path.join(__dirname, 'image-manifest.json');
const CONCURRENCY = 12;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': 'StaticMirror/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(String(res.statusCode)));
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

async function main() {
  const paths = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const missing = paths.filter((p) => {
    const local = path.join(ROOT, p.replace(/\//g, path.sep));
    return !fs.existsSync(local) || fs.statSync(local).size === 0;
  });

  console.log(`Total: ${paths.length}, missing: ${missing.length}`);
  if (!missing.length) return;

  let ok = 0, fail = 0, done = 0;
  const failures = [];
  let idx = 0;

  async function worker() {
    while (idx < missing.length) {
      const i = idx++;
      const rel = missing[i];
      const local = path.join(ROOT, rel.replace(/\//g, path.sep));
      try {
        await download(BASE + rel, local);
        ok++;
      } catch (e) {
        fail++;
        if (failures.length < 500) failures.push(`${rel} -> ${e.message}`);
      }
      done++;
      if (done % 100 === 0 || done === missing.length) {
        process.stdout.write(`\rProgress: ${done}/${missing.length} ok=${ok} fail=${fail}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`Done: ok=${ok}, fail=${fail}`);
  if (failures.length) {
    fs.writeFileSync(path.join(__dirname, 'download-failures.txt'), failures.join('\n'));
  }
}

main().catch(console.error);
