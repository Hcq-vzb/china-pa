/**
 * Restore About Us page images from live HTML reference (wp-image ID mapping).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const aboutPath = path.join(ROOT, 'about-nabo-plastic', 'index.html');
const livePath = path.join(__dirname, '_live-about.html');
const PREFIX = '../';

const companyBg = `${PREFIX}wp-content/uploads/2021/03/NABO-company-1.jpg`;

function localize(html) {
  return html.replace(/https:\/\/www\.naboplastic\.com\//g, PREFIX);
}

function localizeLogoPaths(html) {
  return html
    .replace(/site-logo_NABO_Plastic\.svg/gi, 'site-logo_NABO_Plastic.png')
    .replace(/sticky-logo_NABO_Plastic\.svg/gi, 'sticky-logo_NABO_Plastic.png');
}

let local = fs.readFileSync(aboutPath, 'utf8');
const live = fs.readFileSync(livePath, 'utf8');

// Restore each figure block by wp-image class id.
const figureRe =
  /<figure class="wp-block-image[^"]*"><img[\s\S]*?class="wp-image-(\d+)"[\s\S]*?<\/figure>/gi;

const liveFigures = new Map();
let m;
while ((m = figureRe.exec(live)) !== null) {
  liveFigures.set(m[1], localize(localizeLogoPaths(m[0])));
}

let figureCount = 0;
local = local.replace(figureRe, (full, id) => {
  if (!liveFigures.has(id)) return full;
  figureCount++;
  return liveFigures.get(id);
});

// Parallax "What We Do" company building background.
local = local.replace(
  /<style>\.gb-container-21bff0b4\{[^<]+<\/style>/,
  `<style>.gb-container-21bff0b4{--background-url:url(${companyBg})}.gb-container-21bff0b4:before,.gb-container-21bff0b4.gb-has-dynamic-bg:before{background-image:url(${companyBg})!important}</style>`
);

local = local.replace(
  /\.gb-container-21bff0b4:before\{([^}]*?)background-image:url\([^)]+\)/,
  `.gb-container-21bff0b4:before{$1background-image:url(${companyBg})`
);

// Preload tags from live (first 3 image preloads after title).
const preloadRe = /<link rel='preload' href='[^']+' as='image'[^>]*>/g;
const livePreloads = [];
let pm;
while ((pm = preloadRe.exec(live)) !== null) {
  livePreloads.push(
    localize(localizeLogoPaths(pm[0]))
      .replace(
        `${PREFIX}wp-content/uploads/2023/10/site-logo_NABO_Plastic.png`,
        `${PREFIX}wp-content/uploads/2023/10/site-logo_NABO_Plastic.png`
      )
  );
  if (livePreloads.length >= 3) break;
}

if (livePreloads.length >= 3) {
  let preloadIdx = 0;
  local = local.replace(preloadRe, () => livePreloads[preloadIdx++] || '');
}

// Hero/meta images that should not be random NABO assets.
const hero = `${PREFIX}wp-content/uploads/2024/07/NABO-Plastic-in-beauty-exhibition_NABO_Plastic.jpg`;
const logo = `${PREFIX}wp-content/uploads/2023/10/site-logo_NABO_Plastic.png`;

local = local.replace(
  /(<meta property="og:image" content=")[^"]+(")/,
  `$1${hero}$2`
);
local = local.replace(
  /(<meta name="twitter:image" content=")[^"]+(")/,
  `$1${hero}$2`
);

// JSON-LD organization logo paths (keep hero or logo as on live).
local = local.replace(
  /"url":"(\.\.\/)?wp-content\/uploads\/[^"]*NABO[^"]*"/g,
  (match, p) => {
    if (match.includes('logo') || match.includes('Organization')) {
      return `"url":"${logo}"`;
    }
    return match;
  }
);

fs.writeFileSync(aboutPath, local, 'utf8');
console.log(`Restored ${figureCount} figure blocks on About Us page`);
console.log(`Parallax background -> ${companyBg}`);
