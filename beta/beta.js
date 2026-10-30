// Plugin Player beta signup.
// Same capture pattern as vjacademy.info's EmailSignupModal: POST the form to a
// Google Apps Script Web App (the form's data-endpoint, ends in /exec), which
// appends a row to a Google Sheet Rex owns. no-cors = fire-and-forget (Apps
// Script answers opaquely), then show the thank-you. Setup: docs/beta-signup.md
(function () {
  var form = document.getElementById('betaForm');
  var thanks = document.getElementById('betaThanks');
  var errorEl = document.getElementById('betaError');
  var submit = document.getElementById('betaSubmit');
  if (!form) return;

  var LABEL = submit.textContent;
  var sending = false;
  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };

  // Where the visitor came from (?ref=reel or ?utm_source=instagram), so the sheet can tell the reel apart.
  var q = new URLSearchParams(location.search);
  form.elements.ref.value = (q.get('ref') || q.get('utm_source') || '').slice(0, 60);

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function showThanks() {
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return; // double-submit guard
    errorEl.hidden = true;

    // Honeypot filled = bot. Pretend it worked, send nothing.
    if (String(form.elements.company.value || '').trim()) { showThanks(); return; }

    var email = form.elements.email.value.trim();
    if (!isEmail(email)) {
      showError('Please enter a valid email.');
      form.elements.email.focus();
      return;
    }

    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(endpoint) && !/^http:\/\/(localhost|127\.0\.0\.1)[:\/]/.test(endpoint)) {
      // Not wired yet: don't pretend we saved it.
      console.warn('[beta] data-endpoint is not set: nothing was stored. See docs/beta-signup.md');
      showError('Signups open in a moment. For now, DM "beta" to @rexaffects on Instagram.');
      return;
    }

    form.elements.submittedAt.value = new Date().toISOString();
    var body = new URLSearchParams(new FormData(form)); // urlencoded = simple request, no CORS preflight

    sending = true;
    submit.disabled = true;
    submit.textContent = 'Sending...';

    fetch(endpoint, { method: 'POST', body: body, mode: 'no-cors' })
      .then(showThanks)
      .catch(function () {
        sending = false;
        submit.disabled = false;
        submit.textContent = LABEL;
        showError('Something went wrong. Check your connection and try again.');
      });
  });
})();

// Until the clip file exists, show the poster only (no dead 0:00 player bar).
(function () {
  var v = document.querySelector('.beta-video');
  var s = v && v.querySelector('source');
  if (!s) return;
  s.addEventListener('error', function () { v.removeAttribute('controls'); });
})();
