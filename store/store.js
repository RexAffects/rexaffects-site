// Store pages: BUY goes to our own checkout (rexaffects-store on Vercel -> Stripe Checkout).
// Every button with data-offer POSTs { offer } (packs picker: { offer: "pick-3" | "pick-5", picks: [slugs] }) to
// <body data-store-api>/api/checkout (CORS allows https://rexaffects.com) and goes to the Stripe url it answers. A web
// purchase is a guest purchase on the email typed at Stripe; the buyer signs in to Plugin Player with that email.
// Nothing here sets a price or decides what is bought: the server checks the offer + picks against its own catalog.
(function () {
  var API = (document.body.getAttribute('data-store-api') || '').replace(/\/+$/, '');
  var updatePicker = function () {};

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
    fetch(API + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (j) { return { status: r.status, ok: r.ok, j: j }; });
      })
      .then(function (res) {
        if (res.ok && res.j && typeof res.j.url === 'string' && okUrl(res.j.url)) { location.href = res.j.url; return; }
        fail(words(res.ok ? 502 : res.status, res.j));
      })
      .catch(function () { fail(words(0, null)); });
  }

  // singles and set packs
  document.querySelectorAll('button[data-offer]').forEach(function (btn) {
    btn.addEventListener('click', function () { checkout(btn, { offer: btn.getAttribute('data-offer') }); });
  });

  // pick packs: exactly N checkboxes (Goop and Cube Bloom are not in the list; the server refuses them anyway)
  var picker = document.querySelector('.picker');
  if (picker) {
    var go = picker.querySelector('[data-pick-checkout]');
    var count = picker.querySelector('.pick-count');
    var nLabel = picker.querySelector('.pick-n');
    var boxes = [].slice.call(picker.querySelectorAll('.picks input[type=checkbox]'));
    var sizes = [].slice.call(picker.querySelectorAll('input[name=pick-size]'));
    var current = function () { return sizes.filter(function (s) { return s.checked; })[0] || sizes[0]; };
    var picked = function () { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); };
    updatePicker = function () {
      var s = current(), n = Number(s.getAttribute('data-size')), p = picked();
      nLabel.textContent = n;
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
      checkout(go, { offer: s.value, picks: p });
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
    }
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
