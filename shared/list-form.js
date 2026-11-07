// RexAffects list forms: one script for /beta, /live (booking) and /links.
//
// Contract (store server, POST JSON to RA_LIST.endpoint, see shared/list-config.js):
//   { email, phone?, smsConsent, smsConsentText, smsConsentVersion?, source, tags[], ref?,
//     utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, adConsent?, fbc?, fbp?, hp,
//     booking?: { name, date, venue, city, type, attendance, budget, message } }
//   source: beta | live-booking | links | app.  tags: max 10, [a-z0-9-].
//   phone is kept by the server only with smsConsent, so it is sent only then (a booking's
//   phone without consent rides in booking.message so Rex can still call back).
//   CORS: Origin https://rexaffects.com only (www redirects to the apex on GitHub Pages).
//   Replies: 200 {ok:true} | 400 {ok:false, code:'bad-<field>'} | 429 {ok:false, code:'rate-limited'}.
// The server sends the double opt-in email; the page only says "check your inbox to confirm".
//
// Markup: <div data-list-card> holds <form data-list-form data-source="..." data-tags="a,b"> and a
// sibling <div data-list-thanks hidden>. Inside the form: [data-list-error], [data-list-closed],
// a submit button, inputs named email / phone / smsConsent / hp, optional selects with
// data-tag-prefix (their value becomes a tag), and booking fields named booking.<key>.
(function () {
  'use strict';

  // The exact SMS consent wording. The server recomputes the consent version from this text,
  // so it must match what the visitor saw: every [data-consent-text] is filled from here.
  var CONSENT_TEXT = 'Text me about new plugins, drops and live shows. By checking this, you agree to ' +
    'receive recurring automated texts from RexAffects at this number. Consent isn\'t a condition of ' +
    'purchase. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';
  var CONSENT_VERSION = '2026-11-02';

  var cfg = window.RA_LIST || {};
  var q = new URLSearchParams(location.search);
  var formtest = q.get('formtest'); // 'ok' | 'error' | null (local review only, sends nothing)

  // Attribution: ?ref=ig|tt|yt|fb plus flat utm_*. Kept for the tab so /links -> /beta keeps it.
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var attrib = {};
  try { attrib = JSON.parse(sessionStorage.getItem('ra_attrib') || '{}') || {}; } catch (e) { attrib = {}; }
  ['ref'].concat(UTM_KEYS).forEach(function (k) {
    var v = q.get(k);
    if (v) attrib[k] = v.slice(0, 80);
  });
  try { sessionStorage.setItem('ra_attrib', JSON.stringify(attrib)); } catch (e) { /* private mode */ }

  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };

  // Light normalisation: keep a leading +, digits only; 10 US digits -> +1XXXXXXXXXX.
  function normPhone(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    var plus = v.charAt(0) === '+';
    var d = v.replace(/\D/g, '');
    if (!plus && d.length === 10) return '+1' + d;
    if (!plus && d.length === 11 && d.charAt(0) === '1') return '+' + d;
    return (plus ? '+' : '') + d;
  }
  var phoneOk = function (p) { return /^\+?\d{10,15}$/.test(p); };

  document.querySelectorAll('[data-consent-text]').forEach(function (el) { el.textContent = CONSENT_TEXT; });

  document.querySelectorAll('form[data-list-form]').forEach(function (form) {
    var card = form.closest('[data-list-card]') || form.parentNode;
    var thanks = card.querySelector('[data-list-thanks]');
    var errorEl = form.querySelector('[data-list-error]');
    var closedEl = form.querySelector('[data-list-closed]');
    var submit = form.querySelector('[type="submit"]');
    var label = submit ? submit.textContent : '';
    var endpoint = (form.getAttribute('data-endpoint') || cfg.endpoint || '').trim();
    var open = (cfg.live === true && /^https:\/\//.test(endpoint)) || !!formtest;
    var sending = false;

    if (!open) {
      if (submit) {
        submit.disabled = true;
        submit.textContent = form.getAttribute('data-closed-label') || 'Opens soon';
      }
      if (closedEl) closedEl.hidden = false;
    }

    function showError(msg, field) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.hidden = false;
      if (field && field.focus) field.focus();
    }
    function reset() {
      sending = false;
      if (submit) { submit.disabled = false; submit.textContent = label; }
    }
    function showThanks() {
      form.hidden = true;
      if (thanks) { thanks.hidden = false; thanks.focus(); }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending || !open) return;
      if (errorEl) errorEl.hidden = true;
      var el = form.elements;

      var email = (el.email.value || '').trim();
      if (!isEmail(email)) return showError('Please enter a valid email.', el.email);

      var phone = el.phone ? normPhone(el.phone.value) : '';
      var consent = !!(el.smsConsent && el.smsConsent.checked);
      if (phone && !phoneOk(phone)) return showError('That phone number looks off. Include the area code.', el.phone);
      if (consent && !phone) return showError('Add your mobile number to get texts, or uncheck the box.', el.phone);

      var tags = (form.getAttribute('data-tags') || '').split(',');
      form.querySelectorAll('[data-tag-prefix]').forEach(function (s) {
        if (s.value) tags.push(s.getAttribute('data-tag-prefix') + s.value);
      });
      tags = tags.map(function (t) {
        return String(t).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      }).filter(Boolean).slice(0, 10);

      var payload = {
        email: email,
        smsConsent: consent,
        smsConsentText: CONSENT_TEXT,
        smsConsentVersion: CONSENT_VERSION,
        source: form.getAttribute('data-source') || 'links',
        tags: tags,
        hp: el.hp ? String(el.hp.value || '') : ''
      };
      if (attrib.ref) payload.ref = attrib.ref;
      if (phone && consent) payload.phone = phone;
      UTM_KEYS.forEach(function (k) { if (attrib[k]) payload[k] = attrib[k]; });
      // the ad click ids go to OUR server, and only after Allow (shared/pixel.js); a No thanks clears any kept before
      if (window.RA_ADS) { var ads = window.RA_ADS(); Object.keys(ads).forEach(function (k) { payload[k] = ads[k]; }); }

      // Booking inquiry fields: name="booking.<key>"
      var booking = null;
      Array.prototype.forEach.call(el, function (f) {
        if (!f.name || f.name.indexOf('booking.') !== 0) return;
        booking = booking || {};
        booking[f.name.slice(8)] = String(f.value || '').trim().slice(0, 2000);
      });
      if (booking) {
        var req = form.querySelectorAll('[data-required]');
        for (var i = 0; i < req.length; i++) {
          if (!String(req[i].value || '').trim()) {
            return showError('Please fill in ' + (req[i].getAttribute('data-required') || 'the required fields') + '.', req[i]);
          }
        }
        if (phone && !consent) booking.message = (booking.message ? booking.message + '\n\n' : '') + 'Phone (call only, no texts): ' + phone;
        payload.booking = booking;
      }

      // Honeypot filled = a bot: look done, send nothing.
      if (payload.hp.trim()) return showThanks();

      sending = true;
      if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }

      if (formtest) {
        console.info('[list] formtest=' + formtest + ': not sent', payload);
        setTimeout(function () {
          if (formtest === 'error') { reset(); showError('We couldn’t save that just now. Please try again in a minute.'); }
          else showThanks();
        }, 400);
        return;
      }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (res.ok && j && j.ok !== false) {
            // Meta pixel (shared/pixel.js): count the signup for the ads. No email or phone is sent.
            try { if (window.fbq) window.fbq('track', 'Lead', { content_name: payload.source }); } catch (e) {}
            return showThanks();
          }
          reset();
          var code = (j && j.code) || '';
          var f = code.indexOf('bad-') === 0 ? code.slice(4) : '';
          if (code === 'rate-limited') showError('Too many tries in a row. Give it a minute and try again.');
          else if (f === 'email') showError('Please check your email address.', el.email);
          else if (f === 'phone') showError('That phone number looks off. Include the area code.', el.phone);
          else if (f) showError('Please check the ' + f.replace(/-/g, ' ') + ' field and try again.');
          else showError('We couldn’t save that just now. Please try again in a minute.');
        });
      }).catch(function () {
        reset();
        showError('Something went wrong. Check your connection and try again.');
      });
    });
  });
})();
