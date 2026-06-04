const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const livePath = path.join(__dirname, '_live-index-snippet.html');
const live = fs.readFileSync(livePath, 'utf8');

const start = live.indexOf('<div class="gb-container gb-container-4f7cf5d9 served-markets"');
const end = live.indexOf('<div class="gb-container gb-container-d5ccaf94 why-choose-us"');
if (start < 0 || end < 0) {
  console.error('Could not find served-markets block in live snippet');
  process.exit(1);
}

let block = live.slice(start, end);
block = block.replace(/https:\/\/www\.naboplastic\.com\//g, '');

const localStart = html.indexOf('<div class="gb-container gb-container-4f7cf5d9 served-markets"');
const localEnd = html.indexOf('<div class="gb-container gb-container-d5ccaf94 why-choose-us"');
if (localStart < 0 || localEnd < 0) {
  console.error('Could not find served-markets block in index.html');
  process.exit(1);
}

html = html.slice(0, localStart) + block + html.slice(localEnd);
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Restored full Served Markets section on homepage');
