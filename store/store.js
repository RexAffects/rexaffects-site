// Store pages: BUY goes to our own checkout (rexaffects-store on Vercel -> Stripe Checkout).
// Every button with data-offer POSTs { offer } (packs picker: { offer: "pick-3" | "pick-5", picks: [slugs] }) to
// <body data-store-api>/api/checkout (CORS allows https://rexaffects.com) and goes to the Stripe url it answers. A web
// purchase is a guest purchase on the email typed at Stripe; the buyer signs in to Plugin Player with that email.
// Nothing here sets a price or decides what is bought: the server checks the offer + picks against its own catalog.
// Sales tracking: the ad's labels go with the checkout (kept for the tab, same key as shared/list-form.js); the ad click ids
// only after Allow on the cookie notice (shared/pixel.js window.RA_ADS). The thanks page sends one Purchase with the order's
// id, the same id the store's server sends, so Meta counts one.
// Legal (plugin-player planning/legal/WORDING.md 2.3 + 3): BUY never goes straight to Stripe. It opens the BUY sheet: what you
// get, boxes A/B/C (required) and the marketing box (optional), all unticked, the "By continuing" sentence, then PAY, which stays
// off until A, B and C are ticked. The ticks go with the checkout as `consent`, the same object the app sends
// (app/renderer/ui/legal-model.js consentFor; rexaffects-store lib/v2.ts consentOf records it in the Stripe session metadata).
(function () {
  var API = (document.body.getAttribute('data-store-api') || '').replace(/\/+$/, '');
  var updatePicker = function () {};

  var ATTRIB_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  function attrib() {
    var a = {}, q = new URLSearchParams(location.search);
    try { a = JSON.parse(sessionStorage.getItem('ra_attrib') || '{}') || {}; } catch (e) { a = {}; }
    ATTRIB_KEYS.forEach(function (k) { var v = q.get(k); if (v) a[k] = v.slice(0, 80); });
    try { sessionStorage.setItem('ra_attrib', JSON.stringify(a)); } catch (e) { /* private mode */ }
    if (window.RA_ADS) { var ads = window.RA_ADS(); Object.keys(ads).forEach(function (k) { a[k] = ads[k]; }); } // never kept in the tab
    return a;
  }
  attrib(); // the landing URL's labels, before the buyer clicks through to another page

  // the only places a checkout url may send the buyer: Stripe, or a local dev server's own fake pay page
  function okUrl(u) {
    try {
      var x = new URL(u);
      if (x.protocol === 'https:' && x.hostname === 'checkout.stripe.com') return true;
      return !!API && x.origin === new URL(API).origin && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(x.origin) && x.pathname.indexOf('/dev/pay/') === 0;
    } catch (e) { return false; }
  }

  function words(status, j) {
    var e = (j && j.error) || '';
    if (status === 0) return "Couldn't reach the checkout. Check your connection and try again.";
    if (status === 429) return 'Too many tries in a row. Wait a couple of minutes and try again.';
    if (e === 'bad-picks') return 'Those picks did not work: pick exactly ' + ((j && j.size) || 'the right number of') + ' scenes and try again.';
    if (e === 'price-changed' || e === 'not-on-sale') return 'The deals just changed. Nothing was charged. Check the new price and try again.';
    if (e === 'unknown-offer') return "This item isn't for sale right now. Reload the page and try again.";
    if (status === 503) return "Checkout isn't open yet. Please try again a little later.";
    return 'Checkout could not start (error ' + status + '). Please try again in a minute.';
  }

  function errFor(btn) {
    var box = btn.closest('.info, .pack, .picker') || btn.parentNode;
    return box.querySelector('.err');
  }

  function setBusy(btn, busy) {
    if (busy) {
      btn.setAttribute('data-label', btn.textContent);
      btn.setAttribute('data-busy', '1');
      btn.textContent = 'Opening checkout…';
      btn.disabled = true;
    } else if (btn.getAttribute('data-busy')) {
      btn.removeAttribute('data-busy');
      btn.textContent = btn.getAttribute('data-label');
      btn.disabled = false;
    }
  }

  // The deals on the page follow the server (GET /api/deals; Rex, Nov 5: the Founders deal ends by itself, no rebuild).
  function applyDeals(d) {
    if (!d || !d.prices || !d.founders) return;
    var on = d.founders.on === true;
    document.querySelectorAll('[data-deal]').forEach(function (card) {
      var id = card.getAttribute('data-deal');
      var usd = d.prices[id];
      card.hidden = !usd;
      if (!usd) return;
      var isFounders = on && d.founders.offer === id;
      var title = card.getAttribute('data-title');
      var price = '$' + usd;
      card.querySelectorAll('[data-founders]').forEach(function (el) { el.hidden = !isFounders; });
      var t = card.querySelector('[data-deal-title]');
      if (t && !isFounders) t.textContent = title;
      var line = card.querySelector('[data-deal-line]');
      if (line && !isFounders) line.textContent = card.getAttribute('data-line') || '';
      var p = card.querySelector('[data-deal-price]');
      if (p) p.textContent = price;
      card.querySelectorAll('[data-tile-price]').forEach(function (x) { x.textContent = price; }); // the tile footer's "US $… + tax"
      var saves = Number(card.getAttribute('data-alone')) - usd;
      var save = card.querySelector('[data-deal-save]');
      if (save) { save.hidden = !(saves > 0); save.textContent = 'You save $' + saves; }
      var b = card.querySelector('button[data-offer]');
      if (b) { b.setAttribute('data-usd', String(usd)); b.textContent = 'Buy ' + title + ' · ' + price; }
    });
  }
  if (API && document.querySelector('[data-deal]')) {
    fetch(API + '/api/deals').then(function (r) { return r.ok ? r.json() : null; }).then(applyDeals).catch(function () {});
  }

  function checkout(btn, body) {
    var err = errFor(btn);
    if (err) { err.hidden = true; err.textContent = ''; }
    setBusy(btn, true);
    function fail(msg) {
      setBusy(btn, false);
      if (err) { err.textContent = msg; err.hidden = false; }
      updatePicker();
    }
    if (!API) { fail(words(503, null)); return; }
    body.attrib = attrib();
    var seen = Number(btn.getAttribute('data-usd'));
    if (seen) body.seenUsd = seen; // the price on the button: the server refuses if it moved, before any Stripe page
    fetch(API + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, ok: r.ok, j: j }; });
      })
      .then(function (res) {
        if (res.ok && res.j && typeof res.j.url === 'string' && okUrl(res.j.url)) { location.href = res.j.url; return; }
        if (res.j && res.j.deals) applyDeals(res.j.deals);
        fail(words(res.ok ? 502 : res.status, res.j));
      })
      .catch(function () { fail(words(0, null)); });
  }

  // ---- the BUY sheet (WORDING.md 2.3; the words are the app's, ui/legal-model.js BUY + BOX_A) ----
  var BUY = {
    heading: function (title, price) { return title + ' · US ' + price + ' + tax'; },
    what: function (list) { return 'What you get: ' + list + ' unlocked clean at full output resolution on up to 2 of your computers, and the matching Resolume plugin download for each. This is a license to use them, not ownership. Tax is added at checkout. Payment by Stripe ("Sold through Link"), who emails your receipt.'; },
    plugin: function (title) { return 'What you get: the ' + title + ' Resolume plugin download. This is a license to use it, not ownership. Tax is added at checkout. Payment by Stripe ("Sold through Link"), who emails your receipt.'; },
    boxA: ['I agree to the ', ['/terms/', 'Terms of Sale'], ', ', ['/refunds/', 'Refund Policy'], ' and ', ['/eula/', 'EULA'], ', and I understand there are no refunds for change of mind because I could try every scene free first.'],
    boxB: 'I want my scenes unlocked immediately. I acknowledge that, where I have a legal right to cancel within 14 days, I lose that right once the unlock starts.',
    boxC: "Beta: I've read the list of known shortfalls (unsigned installer / SmartScreen warning · slow first launch · update feed may lag · camera capped at 1280×720 · no MIDI/OSC out · Windows only · some plugins ship after their scene) and I accept them.",
    boxCMac: "Beta: I've read the list of known shortfalls (not notarized by Apple, right-click Open the first time · slow first launch · update feed may lag · camera capped at 1280×720 · no MIDI/OSC out · some plugins ship after their scene) and I accept them.",
    marketing: 'Email me the free scene each month (unsubscribe any time)',
    sentence: 'By continuing you agree to the Terms of Sale, Refund Policy and EULA.',
    pay: function (price) { return 'PAY US ' + price + ' + TAX ON STRIPE →'; },
    back: '‹ BACK',
  };
  var isMac = /Mac/.test(navigator.platform || '') && !/iPhone|iPad|iPod/.test(navigator.userAgent || '');
  // A phone or tablet (the same test as download/send-link.js): Plugin Player is a desktop app, so every buy step says
  // where the scenes will be. ~100% of the ad traffic is phones (rexaffects-store docs/MOBILE_CHECKOUT_AUDIT.md).
  var uaStr = navigator.userAgent || '';
  var isPhone = /iPhone|iPad|iPod|Android|Windows Phone|webOS|BlackBerry|Mobi/i.test(uaStr) || (/Mac/.test(navigator.platform || '') && navigator.maxTouchPoints > 1);
  var PHONE_NOTE = "On your phone? Buy now and it's waiting on your computer. Plugin Player runs on Windows and Mac: I'll email you the download link.";
  if (isPhone) document.body.classList.add('is-phone');
  // PAY stays off until A, B and C are ticked; the consent object is exactly the app's consentFor()
  var canPay = function (b) { return !!(b && b.terms && b.immediate && b.beta); };
  function consentFor(b) {
    var L = window.RA_LEGAL || {};
    return canPay(b) ? { terms: true, immediate: true, beta: true, eula: L.eulaVersion || '', termsVersion: L.termsVersion || '', marketing: !!b.marketing } : null;
  }

  var sheet = null, lastBtn = null;
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return e;
  }
  function closeSheet() {
    if (!sheet) return;
    sheet.remove(); sheet = null;
    document.body.classList.remove('sheet-open');
    if (lastBtn) { try { lastBtn.focus(); } catch (e) {} }
  }
  // c = { title, price: '$75', list | plugin, btn, go(consent) }
  function askFirst(c) {
    closeSheet();
    lastBtn = c.btn;
    var boxes = { terms: false, immediate: false, beta: false, marketing: false };
    var pay = el('button', { type: 'button', class: 'cta buy', disabled: '' }, [BUY.pay(c.price)]);
    function box(key, parts, optional) {
      var input = el('input', { type: 'checkbox', 'data-box': key });
      input.addEventListener('change', function () { boxes[key] = input.checked; pay.disabled = !canPay(boxes); });
      var span = el('span', {}, parts.map(function (p) { return typeof p === 'string' ? p : el('a', { href: p[0], target: '_blank', rel: 'noopener' }, [p[1]]); }));
      return el('label', { class: 'buy-box' + (optional ? ' optional' : '') }, [input, span]);
    }
    var back = el('button', { type: 'button', class: 'buy-back' }, [BUY.back]);
    var card = el('div', { class: 'buy-card' }, [
      el('h2', { id: 'buy-sheet-title' }, [BUY.heading(c.title, c.price)]),
      el('p', { class: 'buy-what' }, [c.plugin ? BUY.plugin(c.plugin) : BUY.what(c.list)]),
    ].concat(isPhone && !c.plugin ? [el('p', { class: 'phone-note' }, [PHONE_NOTE])] : []).concat([
      box('terms', BUY.boxA),
      box('immediate', [BUY.boxB]),
      box('beta', [isMac ? BUY.boxCMac : BUY.boxC]),
      box('marketing', [BUY.marketing], true),
      el('p', { class: 'buy-sentence' }, [BUY.sentence]),
      el('div', { class: 'buy-row' }, [back, pay]),
    ]));
    sheet = el('div', { class: 'buy-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'buy-sheet-title' }, [card]);
    back.addEventListener('click', closeSheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    pay.addEventListener('click', function () {
      var k = consentFor(boxes);
      if (!k) return;
      var go = c.go;
      closeSheet();
      go(k);
    });
    document.body.appendChild(sheet);
    document.body.classList.add('sheet-open');
    var first = sheet.querySelector('input');
    if (first) first.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet) closeSheet(); });

  var priceOf = function (btn) { var u = Number(btn.getAttribute('data-usd')); if (u) return '$' + u; var m = (btn.textContent || '').match(/\$\d+/); return m ? m[0] : ''; };
  var listOf = function (s) { return String(s || '').split(' · ').map(function (x) { return x.trim(); }).filter(Boolean).join(', '); };

  // singles and set packs: the sheet first, then the checkout with its consent
  document.querySelectorAll('button[data-offer]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pack = btn.closest('[data-deal]');
      var info = btn.closest('.info');
      var title = pack ? pack.getAttribute('data-title') : info ? info.querySelector('h1').textContent.trim() : btn.getAttribute('data-offer');
      var c = { title: title, price: priceOf(btn), btn: btn, go: function (consent) { checkout(btn, { offer: btn.getAttribute('data-offer'), consent: consent }); } };
      if (btn.hasAttribute('data-plugin-only')) c.plugin = title;
      else c.list = pack ? listOf((pack.querySelector('.pack-list') || {}).textContent) : title;
      askFirst(c);
    });
  });

  // on a phone: the same line under the BUY button of a scene page, before the sheet opens
  if (isPhone) {
    document.querySelectorAll('.info button.buy[data-offer]:not([data-plugin-only])').forEach(function (btn) {
      btn.parentNode.insertBefore(el('p', { class: 'phone-note' }, [PHONE_NOTE]), btn.nextSibling);
    });
  }

  // pick packs: exactly N checkboxes (Goop and Cube Bloom are not in the list; the server refuses them anyway)
  var picker = document.querySelector('.picker');
  if (picker) {
    var go = picker.querySelector('[data-pick-checkout]');
    var count = picker.querySelector('.pick-count');
    var nLabel = picker.querySelector('.pick-n');
    var boxes = [].slice.call(picker.querySelectorAll('.picks input[type=checkbox]'));
    var sizes = [].slice.call(picker.querySelectorAll('input[name=pick-size]'));
    // "Pick your 3" / "Pick your 5" on a deal card: that size in the picker below
    [].forEach.call(document.querySelectorAll('[data-pick-size]'), function (a) {
      a.addEventListener('click', function () {
        sizes.forEach(function (r) { if (r.value === a.getAttribute('data-pick-size')) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } });
      });
    });
    var current = function () { return sizes.filter(function (s) { return s.checked; })[0] || sizes[0]; };
    var picked = function () { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); };
    updatePicker = function () {
      var s = current(), n = Number(s.getAttribute('data-size')), p = picked();
      nLabel.textContent = n;
      var tp = picker.querySelector('[data-tile-price]');
      if (tp) tp.textContent = '$' + s.getAttribute('data-price');
      count.textContent = p.length + ' of ' + n + ' picked' + (p.length > n ? ': untick ' + (p.length - n) : '');
      boxes.forEach(function (b) { b.disabled = !b.checked && p.length >= n; b.closest('.pick').classList.toggle('on', b.checked); });
      if (go.getAttribute('data-busy')) return;
      var ready = p.length === n;
      go.disabled = !ready;
      go.textContent = ready ? 'Checkout · $' + s.getAttribute('data-price')
        : p.length < n ? 'Pick ' + (n - p.length) + ' more' : 'Untick ' + (p.length - n);
    };
    boxes.concat(sizes).forEach(function (el) {
      el.addEventListener('change', function () {
        var err = picker.querySelector('.err'); if (err) err.hidden = true;
        updatePicker();
      });
    });
    go.addEventListener('click', function () {
      var s = current(), p = picked();
      if (p.length !== Number(s.getAttribute('data-size'))) return;
      var names = boxes.filter(function (b) { return b.checked; }).map(function (b) {
        var span = b.closest('.pick').querySelector('span');
        return span ? span.firstChild.textContent.trim() : b.value;
      });
      askFirst({ title: 'Pick ' + s.getAttribute('data-size'), price: '$' + s.getAttribute('data-price'), list: names.join(', '), btn: go,
        go: function (consent) { checkout(go, { offer: s.value, picks: p, consent: consent }); } });
    });
    updatePicker();
  }

  // back from Stripe (the page comes from the back/forward cache): buttons usable again
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    document.querySelectorAll('button.buy').forEach(function (b) { setBusy(b, false); });
    updatePicker();
  });

  // /store/thanks/?session_id=cs_...: show a short order reference (for support), nothing else; works without it too
  var order = document.querySelector('.order');
  if (order) {
    var sid = new URLSearchParams(location.search).get('session_id') || '';
    if (/^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(sid)) {
      order.querySelector('code').textContent = sid.slice(-10);
      order.hidden = false;
      purchaseEvent(sid, 0);
    }
  }

  // The browser's Purchase: only with the pixel on (Allow), only a real order, once. The webhook can land a moment after the
  // buyer does, so a 404 is asked again a few times. No answer = no event: the server's own event and the report don't need it.
  function purchaseEvent(sid, tries) {
    if (!window.fbq || !API) return;
    var key = 'rexaffects.purchase.' + sid;
    try { if (localStorage.getItem(key)) return; } catch (e) { /* private mode */ }
    fetch(API + '/api/order?session_id=' + encodeURIComponent(sid))
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        if (!j || !j.ok) { if (tries < 4) setTimeout(function () { purchaseEvent(sid, tries + 1); }, 2000); return; }
        if (!j.live || j.eventId !== sid) return; // a sandbox order is never a real event
        window.fbq('track', 'Purchase', { value: j.value, currency: j.currency, content_type: 'product', content_ids: [j.offer], content_category: 'rexaffects-store' }, { eventID: j.eventId });
        try { localStorage.setItem(key, '1'); } catch (e) { /* private mode: Meta still drops the repeat on the id */ }
      })
      .catch(function () {});
  }

  // Set packs: "See what's inside" opens the grid of included scenes (each links to its page; the BUY stays put)
  document.querySelectorAll('.inside-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = document.getElementById(b.getAttribute('aria-controls'));
      var open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      b.textContent = open ? "Hide what's inside" : "See what's inside";
      if (box) box.hidden = !open; // clips inside start playing once visible (the observer below)
    });
  });

  // Live previews: a clip plays only while on screen (IntersectionObserver; not even fetched before that:
  // preload="none"), and never under prefers-reduced-motion (the poster stays). The HTML has no autoplay: this alone
  // starts clips, so a phone on data fetches nothing off screen. The hero is on screen at load, so it starts at once.
  var vids = [].slice.call(document.querySelectorAll('video.clip, video.hero-bg'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hold = function (v) { v.autoplay = false; v.removeAttribute('autoplay'); try { v.pause(); } catch (e) {} };
  if (vids.length && reduce) vids.forEach(hold);
  else if (vids.length && 'IntersectionObserver' in window) {
    vids.forEach(hold);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.preload === 'none') v.preload = 'auto';
          var p = v.play();
          if (p && p.catch) p.catch(function () {}); // a browser that refuses autoplay keeps the poster
        } else v.pause();
      });
    }, { rootMargin: '120px 0px', threshold: 0.1 });
    vids.forEach(function (v) { io.observe(v); });
  }
})();
