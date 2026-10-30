#!/usr/bin/env node
// Builds rexaffects.com/store/ from the Plugin Player catalog export (static pages, no build step on GitHub Pages).
//   1. in plugin-player:   node tools/store-export.mjs --out <dir>        (catalog.json + previews/)
//   2. here:               node tools/build-store.mjs --catalog <dir>/catalog.json [--out <dir>] [--store-api <url>]
// Writes store/index.html (packs, Featured, New, All), store/<slug>/index.html per scene, store/thanks/index.html
// (where Stripe sends a buyer after paying), store/catalog.json, store/previews/*. store/store.css + store/store.js
// are hand-written (not generated).
//
// BUY: every button POSTs { offer, picks? } to the store server (rexaffects-store, `POST /api/checkout`, CORS allows
// https://rexaffects.com) and goes to the Stripe Checkout url it answers. A web purchase is a guest purchase on the
// email typed at Stripe; the buyer signs in to Plugin Player with that email. The server validates the offer and the
// picks against ITS catalog and sets the price: nothing on these pages decides what is bought or what it costs.
// --store-api <url>: a test build against a local `node dev/server.ts` (never commit such a build).
//
// MEDIA (store/media/, committed):
//   <slug>.mp4 + <slug>.jpg   a 6 s silent loop (480x270 H.264) + its poster per scene. --media <dir> copies the ones
//                             found there in (only names matching a catalog slug). A slug without a clip falls back to
//                             its still preview (previews/<slug>.png). Tiles + scene pages use
//                             <video muted loop playsinline autoplay preload="none" poster>; store.js plays a clip only
//                             while it is on screen and never under prefers-reduced-motion (poster only).
//   hero.mp4 + hero.jpg       the /store/ hero background (muted loop, <= 2.5 MB, faststart) + its poster. SWAP IT IN
//                             ONE STEP: replace those two files (same names) and rebuild, or just replace them (the
//                             pages only reference the names). Today: Plugin Player on the trees (Rex's controller
//                             video V3, 0:30-0:40, a 16:9 band cropped from the 720x1280 vertical), made with
//                             ffmpeg -ss 30 -t 10 -i <src> -an -vf "crop=720:405:0:370,scale=1280:720:flags=lanczos,fps=30,format=yuv420p"
//                                    -c:v libx264 -preset slow -crf 28 -movflags +faststart store/media/hero.mp4
//                             ffmpeg -ss 7 -i store/media/hero.mp4 -frames:v 1 -q:v 4 store/media/hero.jpg
//                             No hero.mp4 = the plain gradient hero.
//
// Every page is noindex until Rex says go (remove NOINDEX below, rebuild, and add /store/ to sitemap.xml).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NOINDEX = true;
const STORE_API_DEFAULT = 'https://rexaffects-store.vercel.app';
// TODO(Rex): the public Plugin Player download. Nothing on rexaffects.com links one yet; this is where the app's own
// updates come from (plugin-player app/shared/release.cjs: public releases-only repo RexAffects/plugin-player-releases),
// which does NOT exist yet (404 on Oct 30). Change it here and rebuild once the beta download is public.
const PLAYER_DOWNLOAD_URL = 'https://github.com/RexAffects/plugin-player-releases/releases/latest';
const PLAYER_DOWNLOAD_TODO = true;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i > -1 ? argv[i + 1] : null; };
const catFile = opt('catalog');
if (!catFile) { console.error('usage: node tools/build-store.mjs --catalog <plugin-player export>/catalog.json [--out <dir>] [--store-api <url>]'); process.exit(2); }
const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'));
const SRC = path.dirname(path.resolve(catFile));
const OUT = opt('out') ? path.resolve(opt('out')) : path.join(ROOT, 'store'); // --out <dir>: a preview build elsewhere (store.css / store.js are copied there)
const STORE_API = (opt('store-api') || STORE_API_DEFAULT).replace(/\/+$/, '');
if (!/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(STORE_API)) { console.error(`--store-api must be https (or a local http dev server): ${STORE_API}`); process.exit(2); }
if (STORE_API !== STORE_API_DEFAULT && OUT === path.join(ROOT, 'store')) { console.error('--store-api is for test builds: pass --out <dir> too (the committed pages call the real store)'); process.exit(2); }

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const price = (n) => (Number.isInteger(n) ? `$${n}` : `$${Number(n).toFixed(2)}`);
if (cat.version !== 1 || !Array.isArray(cat.items)) { console.error('not a v1 store export'); process.exit(1); }
for (const it of cat.items) if (!SLUG_RE.test(it.slug) || ['thanks', 'previews', 'media'].includes(it.slug)) { console.error(`bad slug ${it.slug}`); process.exit(1); }
const packs = Array.isArray(cat.packs) ? cat.packs : [];
const pickable = Array.isArray(cat.pickable) ? cat.pickable : [];
const bySlug = Object.fromEntries(cat.items.map((i) => [i.slug, i]));
for (const s of pickable) if (!bySlug[s]) { console.error(`pickable ${s} is not an item`); process.exit(1); }
const pack = (id) => packs.find((p) => p.id === id) || null;

// ---- media: copy --media clips in, then see which slugs have a clip / a poster (decides <video> vs <img>) ----
const MEDIA_OUT = path.join(OUT, 'media');
fs.mkdirSync(MEDIA_OUT, { recursive: true });
const MEDIA_HOME = path.join(ROOT, 'store', 'media');
if (MEDIA_OUT !== MEDIA_HOME) for (const f of ['hero.mp4', 'hero.jpg']) if (fs.existsSync(path.join(MEDIA_HOME, f))) fs.copyFileSync(path.join(MEDIA_HOME, f), path.join(MEDIA_OUT, f));
if (opt('media')) {
  const from = path.resolve(opt('media'));
  let n = 0;
  for (const it of cat.items) for (const ext of ['mp4', 'jpg']) {
    const f = path.join(from, `${it.slug}.${ext}`);
    if (fs.existsSync(f) && fs.statSync(f).size > 0) { fs.copyFileSync(f, path.join(MEDIA_OUT, `${it.slug}.${ext}`)); n++; }
  }
  console.log(`media: ${n} file(s) copied from ${from}`);
}
const has = (f) => fs.existsSync(path.join(MEDIA_OUT, f));
const clipOf = (slug) => (has(`${slug}.mp4`) ? `/store/media/${slug}.mp4` : null);
const posterOf = (it) => (has(`${it.slug}.jpg`) ? `/store/media/${it.slug}.jpg` : `/store/${it.preview}`);
// a scene's picture: the loop when there is one (store.js plays it while on screen), else the still
const media = (it, w, h, alt = '') => {
  const clip = clipOf(it.slug);
  if (!clip) return `<img src="${esc(posterOf(it))}" alt="${esc(alt)}" loading="lazy" width="${w}" height="${h}">`;
  return `<video class="clip" muted loop playsinline autoplay preload="none" poster="${esc(posterOf(it))}" width="${w}" height="${h}"${alt ? ` aria-label="${esc(alt)}"` : ' aria-hidden="true"'}><source src="${esc(clip)}" type="video/mp4"></video>`;
};
const HERO = has('hero.mp4');

// "end of November" from "2026-11-30" (the wording the app and the purchase mail use)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const etaWords = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `end of ${MONTHS[Number(m[2]) - 1]}` : 'soon'; };
const soonPlugins = cat.items.filter((i) => i.includesPlugin && i.pluginAvailable === false);
const soonLine = soonPlugins.map((i) => `${i.title}'s plugin is coming by the ${etaWords(i.pluginEta)}`).join('; ');

const head = (title, desc, depth) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
${NOINDEX ? '  <!-- Store: not indexed until Rex says go (tools/build-store.mjs NOINDEX). -->\n  <meta name="robots" content="noindex">\n' : ''}  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Unbounded:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${'../'.repeat(depth)}store.css">
</head>
<body data-store-api="${esc(STORE_API)}">
  <header><div class="wrap"><a class="logo" href="/">REXAFFECTS</a><a class="crumb" href="/store/">Store</a></div></header>
`;
const foot = (depth) => `
  <footer>RexAffects · <a href="https://www.instagram.com/rexaffects/">@rexaffects</a> · Secure checkout by Stripe</footer>
  <script src="${'../'.repeat(depth)}store.js"></script>
</body>
</html>
`;

const badges = (it) => [
  it.featured ? '<span class="b feat">Featured</span>' : '',
  it.new ? '<span class="b new">New</span>' : '',
  it.freeInPlayer ? '<span class="b free">Free in Plugin Player</span>' : '',
  it.includesPlugin && it.pluginAvailable === false ? `<span class="b soon">Plugin: ${esc(etaWords(it.pluginEta))}</span>` : '',
].join('');
const card = (it) => `      <a class="item" href="/store/${it.slug}/">
        ${media(it, 480, 270, it.title)}
        <div class="meta"><div class="badges">${badges(it)}</div><b>${esc(it.title)}</b><span class="by">by ${esc(it.creatorName)}</span><span class="price">${price(it.priceUsd)}</span></div>
      </a>`;
const grid = (title, list, id) => (list.length ? `  <section id="${id}"><div class="wrap"><h2>${title}</h2><div class="grid">
${list.map(card).join('\n')}
    </div></div></section>
` : '');
const buyButton = (offer, label, cls = '') => `<button type="button" class="cta buy${cls ? ` ${cls}` : ''}" data-offer="${esc(offer)}">${esc(label)}</button>`;
const errorLine = '<p class="err" role="alert" hidden></p>';
const pluginsLine = `<p class="plugins-note"><b>Every Resolume plugin included.</b> Each scene comes with its Resolume plugin, no extra cost.${soonLine ? ` ${esc(soonLine)}: we'll email it the moment it's ready.` : ''}</p>`;

// ---- packs (index) ----
const setCard = (p, big) => {
  const titles = (p.scenes || []).map((s) => bySlug[s]?.title || s);
  const bonus = (p.bonusPlugins || []).map((s) => bySlug[s]?.title || s);
  return `      <div class="pack${big ? ' big' : ''}">
        <div class="pack-top"><h3>${esc(p.title)}</h3><span class="pack-price">${price(p.priceUsd)}</span></div>
        ${p.savesUsd ? `<p class="save">You save ${price(p.savesUsd)}</p>` : ''}
        <p class="pack-what">${titles.length} scenes + ${p.pluginCount} Resolume plugins${bonus.length ? ` (incl. the ${esc(bonus.join(', '))} plugin as a bonus)` : ''}</p>
        <p class="pack-list">${titles.map(esc).join(' · ')}</p>
        <div class="pack-actions">
          ${buyButton(p.id, `Buy ${p.title} · ${price(p.priceUsd)}`)}
          <button type="button" class="inside-toggle" aria-expanded="false" aria-controls="inside-${esc(p.id)}">See what's inside</button>
        </div>
        ${errorLine}
        <div class="inside" id="inside-${esc(p.id)}" hidden>
${(p.scenes || []).filter((s) => bySlug[s]).map((s) => insideTile(bySlug[s], false)).join('\n')}
${(p.bonusPlugins || []).filter((s) => bySlug[s]).map((s) => insideTile(bySlug[s], true)).join('\n')}
        </div>
      </div>`;
};
// one tile in a set pack's "See what's inside": the loop + name + its plugin line; links to the scene's page
function insideTile(it, bonus) {
  const line = bonus ? 'Bonus: its Resolume plugin'
    : it.includesPlugin && it.pluginAvailable === false ? `Resolume plugin: coming ${etaWords(it.pluginEta)}`
      : 'Resolume plugin included';
  return `          <a class="in${bonus ? ' bonus' : ''}" href="/store/${it.slug}/">${media(it, 240, 135)}<b>${esc(it.title)}</b><small${!bonus && it.pluginAvailable === false ? ' class="soon"' : ''}>${esc(line)}</small></a>`;
}
const pickPacks = ['pick-3', 'pick-5'].map(pack).filter(Boolean);
const goop = bySlug['fluid-force'];
const packsSection = packs.length ? `  <section id="packs"><div class="wrap">
    <h2>Packs</h2>
    ${pluginsLine}
    <div class="packs">
${[pack('everything'), pack('all-7')].filter(Boolean).map((p) => setCard(p, true)).join('\n')}
    </div>
${pickPacks.length && pickable.length ? `    <div class="picker" data-pickable="${esc(pickable.join(','))}">
      <h3>Pick your own</h3>
      <div class="pick-sizes" role="radiogroup" aria-label="Pack size">
${pickPacks.map((p, i) => `        <label class="size"><input type="radio" name="pick-size" value="${esc(p.id)}" data-size="${p.size}" data-price="${p.priceUsd}"${i === 0 ? ' checked' : ''}><span><b>${esc(p.title)}</b> · ${price(p.priceUsd)}${p.savesUsd ? ` <i>save ${price(p.savesUsd)}</i>` : ''}</span></label>`).join('\n')}
      </div>
      <p class="pick-help">Tick exactly <b class="pick-n">${pickPacks[0].size}</b> scenes. Each comes with its Resolume plugin.${goop ? ` ${esc(goop.title)} (${price(goop.priceUsd)}) isn't a pick slot: it's in ${esc(pack('everything')?.title || 'Everything')}, or buy it on its own.` : ''}</p>
      <div class="picks">
${pickable.map((s) => { const it = bySlug[s]; return `        <label class="pick"><input type="checkbox" value="${esc(s)}">${media(it, 160, 90)}<span>${esc(it.title)}${it.pluginAvailable === false ? `<small>plugin coming ${esc(etaWords(it.pluginEta))}</small>` : ''}</span></label>`; }).join('\n')}
      </div>
      <div class="pick-go">
        <span class="pick-count" aria-live="polite">0 of ${pickPacks[0].size} picked</span>
        <button type="button" class="cta buy" data-pick-checkout disabled>Pick ${pickPacks[0].size} scenes</button>
      </div>
      ${errorLine}
    </div>
` : ''}  </div></section>
` : '';

// ---- index ----
const featured = cat.items.filter((i) => i.featured);
const fresh = cat.items.filter((i) => i.new && !i.featured);
const all = [...cat.items].sort((a, b) => a.title.localeCompare(b.title));
let index = head('Store — RexAffects', 'Scenes for Plugin Player, with the Resolume plugin included. Buy once, unlock in the app.', 0);
index += `  <div class="hero${HERO ? ' has-video' : ''}">
${HERO ? `    <video class="hero-bg" muted loop playsinline autoplay preload="auto"${has('hero.jpg') ? ' poster="/store/media/hero.jpg"' : ''} aria-hidden="true"><source src="/store/media/hero.mp4" type="video/mp4"></video>
    <div class="hero-shade"></div>
` : ''}    <div class="wrap">
    <div class="tag">Plugin Player · Store</div>
    <h1>Scenes you <span>play live.</span></h1>
    <p class="lede">Every scene plays free in Plugin Player with a small mark. Buy one and it plays clean, and its Resolume plugin comes with it.</p>
    <p class="lede small"><a href="#packs">Packs</a> · <a href="#featured">Featured</a> · <a href="#all">All scenes</a></p>
  </div></div>
`;
index += packsSection + grid('Featured', featured, 'featured') + grid('New', fresh, 'new') + grid('All scenes', all, 'all');
index += foot(0);

// ---- one page per scene ----
const pages = cat.items.map((it) => {
  let p = head(`${it.title} — RexAffects Store`, it.blurb, 1);
  const soon = it.includesPlugin && it.pluginAvailable === false;
  const pluginLi = !it.includesPlugin ? ''
    : soon ? `<li>The <b>Resolume plugin</b>: coming by the ${esc(etaWords(it.pluginEta))}. Buy now and we'll email it to you the moment it's ready</li>`
      : `<li>The <b>Resolume plugin</b>, included: the download link comes by email</li>`;
  const inPicks = pickable.includes(it.slug);
  const p3 = pack('pick-3'), a7 = pack('all-7'), ev = pack('everything');
  const packNote = inPicks && p3
    ? `<p class="fine">Or save with a pack: ${esc(p3.title)} for ${price(p3.priceUsd)}${a7 ? `, ${esc(a7.title)} for ${price(a7.priceUsd)}` : ''}. <a href="/store/#packs">See packs</a></p>`
    : it.freeInPlayer ? `<p class="fine">This buys the Resolume plugin: the scene is already free in Plugin Player. It's also a bonus in ${a7 ? `${esc(a7.title)} and ` : ''}${ev ? esc(ev.title) : 'the big packs'}. <a href="/store/#packs">See packs</a></p>`
      : ev && (ev.scenes || []).includes(it.slug) ? `<p class="fine">Not part of Pick 3 / Pick 5. It's in ${esc(ev.title)} (${price(ev.priceUsd)}), with every other scene. <a href="/store/#packs">See packs</a></p>` : '';
  p += `  <section class="scene"><div class="wrap two">
    <div class="pic">${media(it, 960, 540, it.title)}</div>
    <div class="info">
      <div class="badges">${badges(it)}</div>
      <h1>${esc(it.title)}</h1>
      <p class="by">by ${esc(it.creatorName)}</p>
      <p class="lede">${esc(it.blurb)}</p>
      <ul class="incl">
        ${it.freeInPlayer ? '<li>The scene is <b>free in Plugin Player</b> already</li>' : '<li>Plays clean in <b>Plugin Player</b>: no mark on the screen, the projector or the feed</li>'}
        ${pluginLi}
        <li>Sign in to Plugin Player with your purchase email: works on up to 3 computers</li>
      </ul>
      ${buyButton(it.slug, `Buy · ${price(it.priceUsd)}`)}
      ${errorLine}
      ${packNote}
      <p class="fine">Secure checkout by Stripe. After paying: open Plugin Player → UNLOCK → SIGN IN with the email you used.</p>
    </div>
  </div></section>
`;
  p += foot(1);
  return [it.slug, p];
});

// ---- /store/thanks/ (Stripe's success_url; static, calls nothing: works with or without ?session_id=) ----
let thanks = head('Thanks! — RexAffects Store', 'Your purchase is confirmed. How to unlock your scenes and get your Resolume plugins.', 1);
thanks += `  <section class="scene thanks"><div class="wrap narrow">
    <div class="tag">Purchase confirmed</div>
    <h1>Thanks! Your purchase is <span>confirmed.</span></h1>
    <p class="lede">Two quick steps and you're playing.</p>
    <ol class="steps">
      <li>
        <h2>Unlock your scenes in Plugin Player</h2>
        <p><b>Bought from inside Plugin Player?</b> Your scenes unlock by themselves. Nothing to do.</p>
        <p><b>Bought here on the website?</b> Open Plugin Player → <b>UNLOCK</b> → <b>SIGN IN</b> with the email you just used. We'll email you a 6-digit code; type it in and your scenes play clean (on up to 3 computers).</p>
      </li>
      <li>
        <h2>Get your Resolume plugins</h2>
        <p>They're in the email we just sent you, one download link per plugin. Not there? <b>Check your spam folder.</b></p>
        ${soonLine ? `<p class="fine">${esc(soonLine)}: we'll email it the moment it's ready.</p>` : ''}
        <p class="fine">Lost the email? Plugin Player → UNLOCK → "Get the Resolume plugin" next to the scene.</p>
      </li>
    </ol>
    <div class="get-player">
      <p>Don't have Plugin Player yet?</p>
      ${PLAYER_DOWNLOAD_TODO ? '<!-- TODO(Rex): placeholder download link (tools/build-store.mjs PLAYER_DOWNLOAD_URL); the releases repo does not exist yet. -->\n      ' : ''}<a class="cta" href="${esc(PLAYER_DOWNLOAD_URL)}"${PLAYER_DOWNLOAD_TODO ? ' data-todo="download link placeholder"' : ''}>Download Plugin Player</a>
    </div>
    <p class="fine order" hidden>Order reference: <code></code></p>
    <p class="fine"><a href="/store/">Back to the store</a></p>
  </div></section>
`;
thanks += foot(1);

// ---- write (only inside store/) ----
fs.mkdirSync(path.join(OUT, 'previews'), { recursive: true });
for (const it of cat.items) {
  const from = path.join(SRC, it.preview);
  if (!/^previews\/[a-z0-9-]+\.(png|jpg|jpeg|gif|webp)$/.test(it.preview) || !fs.existsSync(from)) { console.error(`missing preview ${it.preview}`); process.exit(1); }
  fs.copyFileSync(from, path.join(OUT, it.preview));
}
const keep = new Set([...cat.items.map((i) => i.slug), 'previews', 'thanks', 'media']);
for (const d of fs.readdirSync(OUT, { withFileTypes: true })) if (d.isDirectory() && !keep.has(d.name)) fs.rmSync(path.join(OUT, d.name), { recursive: true });
const keepPreviews = new Set(cat.items.map((i) => path.basename(i.preview)));
for (const f of fs.readdirSync(path.join(OUT, 'previews'))) if (!keepPreviews.has(f)) fs.rmSync(path.join(OUT, 'previews', f));
if (OUT !== path.join(ROOT, 'store')) for (const f of ['store.css', 'store.js']) fs.copyFileSync(path.join(ROOT, 'store', f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'index.html'), index);
for (const [slug, html] of pages) { fs.mkdirSync(path.join(OUT, slug), { recursive: true }); fs.writeFileSync(path.join(OUT, slug, 'index.html'), html); }
fs.mkdirSync(path.join(OUT, 'thanks'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'thanks', 'index.html'), thanks);
fs.writeFileSync(path.join(OUT, 'catalog.json'), `${JSON.stringify(cat, null, 2)}\n`);
const clips = cat.items.filter((i) => clipOf(i.slug)).length;
console.log(`media: ${clips}/${cat.items.length} scene clip(s)${clips < cat.items.length ? ` (stills for ${cat.items.filter((i) => !clipOf(i.slug)).map((i) => i.slug).join(', ')})` : ''}, hero ${HERO ? 'video' : 'none (gradient)'}`);
console.log(`store: ${cat.items.length} scene page(s) + ${packs.length} pack(s) on the index + thanks -> ${OUT} (BUY -> ${STORE_API}/api/checkout)${NOINDEX ? ' (noindex)' : ''}${PLAYER_DOWNLOAD_TODO ? '\n  TODO: the Plugin Player download link on /store/thanks/ is a placeholder (PLAYER_DOWNLOAD_URL)' : ''}`);
