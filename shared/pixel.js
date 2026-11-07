// Meta pixel for rexaffects.com: "Rex's Gumroad Pixel Current" (1125414793080948, Rex's own pixel in the
// Project Open Source ad account). PageView on every page; list-form.js adds a "Lead" event when a signup
// is accepted (no email or phone is ever passed to Meta). Lets the Plugin Player ads optimise for
// landing-page views and, later, signups. Disclosed on /privacy.
//
// Consent first: nothing from Meta loads, and no cookie is set, until Allow.
// No thanks is remembered for 6 months. A browser sending Global Privacy Control counts as No thanks and is never asked.
// The footer's Cookies link reopens the notice. window.fbq only exists after Allow, and list-form.js checks for it.
// autoConfig off: no automatic button-click events, only the PageView and Lead the privacy page describes.
// window.RA_ADS() hands the signup form and the store's checkout the ad click ids, only after Allow (sales tracking).
(function () {
  var KEY = 'rexaffects.cookies.v1';
  var MONTH = 30 * 24 * 60 * 60 * 1000;
  var KEEP = { allow: 12 * MONTH, decline: 6 * MONTH };
  var banner = null;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && KEEP[v.choice] && Date.now() - v.at < KEEP[v.choice]) return v.choice;
    } catch (e) {}
    return null;
  }
  function save(choice) { try { localStorage.setItem(KEY, JSON.stringify({ choice: choice, at: Date.now() })); } catch (e) {} }
  function gpc() { return navigator.globalPrivacyControl === true; }

  function loadPixel() {
    if (window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('set', 'autoConfig', false, '1125414793080948');
    window.fbq('init', '1125414793080948');
    window.fbq('track', 'PageView');
  }

  // -> { adConsent: false } | { adConsent: true, fbc?, fbp? }. _fbc can lag the first page, so fbclid is read from the URL too.
  function cookie(name) {
    var hit = document.cookie.split('; ').filter(function (c) { return c.indexOf(name + '=') === 0; })[0];
    return hit ? hit.slice(name.length + 1) : '';
  }
  window.RA_ADS = function () {
    if (gpc() || read() !== 'allow') return { adConsent: false };
    var out = { adConsent: true };
    var fbclid = new URLSearchParams(location.search).get('fbclid');
    var fbc = cookie('_fbc') || (fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : '');
    var fbp = cookie('_fbp');
    if (fbc) out.fbc = fbc;
    if (fbp) out.fbp = fbp;
    return out;
  };

  function css() {
    if (document.getElementById('cookie-css')) return;
    var s = document.createElement('style');
    s.id = 'cookie-css';
    s.textContent = '.cookie-note{position:fixed;left:16px;right:16px;bottom:16px;z-index:1000;max-width:560px;margin:0 auto;padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;background:var(--surface,#111118);color:var(--text,#e8e8ee);border:1px solid var(--border,#1e1e2a);border-radius:12px;font:14px/1.45 var(--font,system-ui,sans-serif)}'
      + '.cookie-note p{flex:1 1 260px;margin:0;color:inherit}'
      + '.cookie-note button{padding:8px 16px;border-radius:8px;border:1px solid var(--border,#1e1e2a);background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}'
      + '.cookie-note button.yes{background:var(--cyan,#00e5ff);border-color:var(--cyan,#00e5ff);color:#060609}';
    document.head.appendChild(s);
  }
  function close() { if (banner) { banner.remove(); banner = null; } }
  function ask() {
    if (banner || !document.body) return;
    css();
    banner = document.createElement('div');
    banner.className = 'cookie-note';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookies');
    var p = document.createElement('p');
    p.textContent = 'We use one cookie from Meta to see which of our ads work. Nothing else tracks you.';
    var yes = document.createElement('button');
    yes.className = 'yes'; yes.type = 'button'; yes.textContent = 'Allow';
    yes.onclick = function () { save('allow'); close(); loadPixel(); };
    var no = document.createElement('button');
    no.type = 'button'; no.textContent = 'No thanks';
    no.onclick = function () { save('decline'); close(); };
    banner.appendChild(p); banner.appendChild(yes); banner.appendChild(no);
    document.body.appendChild(banner);
  }

  // the Cookies link in the footer of every page. A loaded pixel can't be unloaded: No thanks after an Allow takes
  // effect from the next page.
  function footerLink() {
    var list = document.querySelector('footer .foot-links') || document.querySelector('footer');
    if (!list || (list.querySelector && list.querySelector('[data-cookies]'))) return;
    var a = document.createElement('a');
    a.href = '#cookies'; a.textContent = 'Cookies'; a.setAttribute('data-cookies', '');
    a.onclick = function (e) { e.preventDefault(); ask(); };
    if (list.tagName === 'UL') { var li = document.createElement('li'); li.appendChild(a); list.appendChild(li); } else list.appendChild(a);
  }

  function ready() {
    footerLink();
    if (!gpc() && read() === null) ask();
  }
  if (!gpc() && read() === 'allow') loadPixel();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
