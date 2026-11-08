// The public download, in ONE place: /download/ reads everything it shows from here (version, file, link, size,
// SHA-256). Filled by plugin-player tools/download-page.mjs from the exact release folder that was uploaded, never by hand.
// Runbook: plugin-player docs/PUBLIC_DOWNLOAD.md.
//
// LIVE stays false until BOTH are true: the GitHub release is published (the link answers), and people can pay
// (Rex's rule: the public download opens only once buying works; until then /download/ points to the waiting list).
(function () {
  var D = window.RA_DOWNLOAD = {
    live: false,
    version: '',            // e.g. '0.2.0' (the app's own version, the release tag is 'v' + this)
    date: '',               // e.g. 'November 9, 2026'
    notes: '',              // the release's first line ("What's new")
    windows: {
      file: '',             // Plugin-Player-Setup-<version>.exe
      url: '',              // https://github.com/RexAffects/plugin-player-releases/releases/download/v<version>/<file>
      sha256: '',           // of that exact file (lower-case hex, 64 characters)
      bytes: 0,
    },
  };

  var ok = function () {
    var w = D.windows;
    return D.live && /^\d+\.\d+\.\d+/.test(D.version) && /^https:\/\/github\.com\/RexAffects\/plugin-player-releases\/releases\/download\//.test(w.url) && /^[0-9a-f]{64}$/.test(w.sha256) && w.bytes > 50e6;
  };
  D.ready = ok;

  function mb(n) { return Math.round(n / 1e6) + ' MB'; }
  function fill() {
    var on = ok();
    [].forEach.call(document.querySelectorAll('[data-dl-when]'), function (el) {
      el.hidden = (el.getAttribute('data-dl-when') === 'live') !== on;
    });
    if (!on) return;
    var w = D.windows;
    var set = function (k, v) { [].forEach.call(document.querySelectorAll('[data-dl="' + k + '"]'), function (el) { el.textContent = v; }); };
    set('version', D.version);
    set('date', D.date);
    set('notes', D.notes);
    set('file', w.file);
    set('size', mb(w.bytes));
    set('sha256', w.sha256);
    [].forEach.call(document.querySelectorAll('[data-dl-href="windows"]'), function (a) { a.href = w.url; });
    [].forEach.call(document.querySelectorAll('[data-dl-if="notes"]'), function (el) { el.hidden = !D.notes; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
