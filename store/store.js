// Store pages: carry Plugin Player's claim through to the Gumroad checkout.
// The app opens /store/<slug>/?src=player&claim=<token>. The token is checked (22-64 base64url chars) and added, with
// src, to the Gumroad link, so Gumroad's sale Ping returns it in url_params and rexaffects-store files the licence
// key under it; the app is polling for that claim and unlocks the scene by itself.
// Gumroad's overlay script (gumroad.js) may open the link as an in-page checkout; without it the link still works.
(function () {
  var q = new URLSearchParams(location.search);
  var claim = q.get('claim');
  var src = q.get('src');
  var fromPlayer = src === 'player' && claim && /^[A-Za-z0-9_-]{22,64}$/.test(claim);
  if (fromPlayer) document.querySelectorAll('.player-note').forEach(function (n) { n.hidden = false; });
  // keep the claim when moving between store pages (index -> scene)
  if (fromPlayer) document.querySelectorAll('a.item').forEach(function (a) {
    var u = new URL(a.getAttribute('href'), location.href);
    u.searchParams.set('src', 'player'); u.searchParams.set('claim', claim);
    a.setAttribute('href', u.pathname + u.search);
  });
  document.querySelectorAll('a[data-checkout]').forEach(function (a) {
    var u;
    try { u = new URL(a.getAttribute('data-checkout')); } catch (e) { return; }
    if (u.protocol !== 'https:' || !/(^|\.)gumroad\.com$/.test(u.hostname)) return;
    u.searchParams.set('wanted', 'true'); // straight to checkout in the overlay
    if (fromPlayer) { u.searchParams.set('claim', claim); u.searchParams.set('src', 'player'); }
    else if (src && /^[a-z0-9-]{1,32}$/.test(src)) u.searchParams.set('src', src);
    a.href = u.href;
    a.setAttribute('data-gumroad', '1');
  });
  // gumroad.js opens product links in its overlay (assumption: plain /l/ links, no class needed; the class would
  // also restyle the button in Gumroad's grey). Without the overlay the link simply opens the checkout page.
  if (document.querySelector('a[data-gumroad]')) {
    var s = document.createElement('script');
    s.src = 'https://gumroad.com/js/gumroad.js';
    s.async = true;
    document.body.appendChild(s);
  }
})();
