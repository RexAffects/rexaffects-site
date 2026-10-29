#!/usr/bin/env node
// Builds rexaffects.com/store/ from the Plugin Player catalog export (static pages, no build step on GitHub Pages).
//   1. in plugin-player:   node tools/store-export.mjs --out <dir>        (catalog.json + previews/)
//   2. here:               node tools/build-store.mjs --catalog <dir>/catalog.json
// Writes store/index.html (Featured, New, All), store/<slug>/index.html per scene, store/catalog.json,
// store/previews/*. store/store.css + store/store.js are hand-written (not generated).
// Every page is noindex until Rex says go (remove NOINDEX below, rebuild, and add /store/ to sitemap.xml).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NOINDEX = true;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : null; };
const catFile = opt('catalog');
if (!catFile) { console.error('usage: node tools/build-store.mjs --catalog <plugin-player export>/catalog.json'); process.exit(2); }
const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'));
const SRC = path.dirname(path.resolve(catFile));
const OUT = opt('out') ? path.resolve(opt('out')) : path.join(ROOT, 'store'); // --out <dir>: a preview build elsewhere (store.css / store.js are copied there)

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const price = (n) => (Number.isInteger(n) ? `$${n}` : `$${Number(n).toFixed(2)}`);
if (cat.version !== 1 || !Array.isArray(cat.items)) { console.error('not a v1 store export'); process.exit(1); }
for (const it of cat.items) if (!SLUG_RE.test(it.slug)) { console.error(`bad slug ${it.slug}`); process.exit(1); }

const head = (title, desc, depth) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
${NOINDEX ? '  <!-- Store: not indexed until Rex says go (tools/build-store.mjs NOINDEX). -->\n  <meta name="robots" content="noindex">\n' : ''}  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${depth ? '../' : ''}store.css">
</head>
<body>
  <header><div class="wrap"><a class="logo" href="/">REXAFFECTS</a><a class="crumb" href="/store/">Store</a></div></header>
`;
const foot = (depth) => `
  <footer>RexAffects · <a href="https://www.instagram.com/rexaffects/">@rexaffects</a> · Checkout by Gumroad</footer>
  <script src="${depth ? '../' : ''}store.js"></script>
</body>
</html>
`;

const badges = (it) => [it.featured ? '<span class="b feat">Featured</span>' : '', it.new ? '<span class="b new">New</span>' : '', it.freeInPlayer ? '<span class="b free">Free in Plugin Player</span>' : ''].join('');
const card = (it) => `      <a class="item" href="/store/${it.slug}/">
        <img src="/store/${esc(it.preview)}" alt="${esc(it.title)}" loading="lazy" width="480" height="270">
        <div class="meta"><div class="badges">${badges(it)}</div><b>${esc(it.title)}</b><span class="by">by ${esc(it.creatorName)}</span><span class="price">${price(it.priceUsd)}</span></div>
      </a>`;
const grid = (title, list, id) => (list.length ? `  <section id="${id}"><div class="wrap"><h2>${title}</h2><div class="grid">
${list.map(card).join('\n')}
    </div></div></section>
` : '');

// ---- index ----
const featured = cat.items.filter((i) => i.featured);
const fresh = cat.items.filter((i) => i.new && !i.featured);
const all = [...cat.items].sort((a, b) => a.title.localeCompare(b.title));
let index = head('Store — RexAffects', 'Scenes for Plugin Player, with the Resolume plugin included. Buy once, unlock in the app.', 0);
index += `  <div class="hero"><div class="wrap">
    <div class="tag">Plugin Player · Store</div>
    <h1>Scenes you <span>play live.</span></h1>
    <p class="lede">Every scene plays free in Plugin Player with a small mark. Buy one and it plays clean: the Resolume plugin comes with it.</p>
    <p class="player-note" hidden>You came from Plugin Player: pick the scene and check out. The app unlocks it by itself, no restart.</p>
  </div></div>
`;
index += grid('Featured', featured, 'featured') + grid('New', fresh, 'new') + grid('All scenes', all, 'all');
index += foot(0);

// ---- one page per scene ----
const pages = cat.items.map((it) => {
  let p = head(`${it.title} — RexAffects Store`, it.blurb, 1);
  const buy = it.checkoutUrl
    ? `<a class="cta buy" data-checkout="${esc(it.checkoutUrl)}" href="${esc(it.checkoutUrl)}">Buy · ${price(it.priceUsd)}</a>`
    : `<span class="cta soon">Coming soon</span><p class="fine">Checkout opens here soon. Already bought the plugin? Sign in with your purchase email in Plugin Player.</p>`;
  p += `  <section class="scene"><div class="wrap two">
    <div class="pic"><img src="/store/${esc(it.preview)}" alt="${esc(it.title)}" width="960" height="540"></div>
    <div class="info">
      <div class="badges">${badges(it)}</div>
      <h1>${esc(it.title)}</h1>
      <p class="by">by ${esc(it.creatorName)}</p>
      <p class="lede">${esc(it.blurb)}</p>
      <ul class="incl">
        <li>Plays clean in <b>Plugin Player</b>${it.freeInPlayer ? ' (already free there)' : ''}: no mark on the screen, the projector or the feed</li>
        ${it.includesPlugin ? '<li>The <b>Resolume plugin</b> download</li>' : ''}
        <li>A licence key in your receipt, for any computer you use</li>
      </ul>
      <div class="player-note" hidden><b>Plugin Player is waiting for this purchase.</b> Finish the checkout and keep the app open: ${esc(it.title)} unlocks by itself, no restart.</div>
      ${buy}
      <p class="fine">Secure checkout by Gumroad. Lost the app's window? Paste the licence key from your receipt in UNLOCK, or sign in with your purchase email.</p>
    </div>
  </div></section>
`;
  p += foot(1);
  return [it.slug, p];
});

// ---- write (only inside store/) ----
fs.mkdirSync(path.join(OUT, 'previews'), { recursive: true });
for (const it of cat.items) {
  const from = path.join(SRC, it.preview);
  if (!/^previews\/[a-z0-9-]+\.(png|jpg|jpeg|gif|webp)$/.test(it.preview) || !fs.existsSync(from)) { console.error(`missing preview ${it.preview}`); process.exit(1); }
  fs.copyFileSync(from, path.join(OUT, it.preview));
}
const keep = new Set(cat.items.map((i) => i.slug));
for (const d of fs.readdirSync(OUT, { withFileTypes: true })) if (d.isDirectory() && d.name !== 'previews' && !keep.has(d.name)) fs.rmSync(path.join(OUT, d.name), { recursive: true });
if (OUT !== path.join(ROOT, 'store')) for (const f of ['store.css', 'store.js']) fs.copyFileSync(path.join(ROOT, 'store', f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'index.html'), index);
for (const [slug, html] of pages) { fs.mkdirSync(path.join(OUT, slug), { recursive: true }); fs.writeFileSync(path.join(OUT, slug, 'index.html'), html); }
fs.writeFileSync(path.join(OUT, 'catalog.json'), `${JSON.stringify(cat, null, 2)}\n`);
console.log(`store: ${cat.items.length} scene page(s) + index -> ${OUT}${NOINDEX ? ' (noindex)' : ''}`);
