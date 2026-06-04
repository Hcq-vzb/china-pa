const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../product');
const OLD = `  function productUrl(){
    var loc=window.location.href;
    if(/^https?:\\/\\//i.test(loc)) return loc;
    var canon=document.querySelector('link[rel="canonical"]');
    if(canon&&canon.href) return canon.href;
    return loc;
  }`;
const NEW = `  function productUrl(){
    return window.location.href;
  }`;
let n = 0;
function walk(d) {
  for (const name of fs.readdirSync(d)) {
    const p = path.join(d, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/index\.html?$/i.test(name)) {
      let t = fs.readFileSync(p, 'utf8');
      if (t.includes(OLD)) {
        fs.writeFileSync(p, t.replace(OLD, NEW));
        n++;
      }
    }
  }
}
walk(ROOT);
console.log('patched', n);
