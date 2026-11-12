// The public download, in ONE place: /download/ reads everything it shows from here (version, file, link, size,
// SHA-256). Filled by plugin-player tools/download-page.mjs from the exact release folder that was uploaded, never by hand.
// Runbook: plugin-player docs/PUBLIC_DOWNLOAD.md.
//
// LIVE stays false until BOTH are true: the GitHub release is published (the link answers), and people can pay
// (Rex's rule: the public download opens only once buying works; until then /download/ points to the waiting list).
(function () {
  var D = window.RA_DOWNLOAD = {
    live: true,
    version: "0.2.1",            // e.g. '0.2.0' (the app's own version, the release tag is 'v' + this)
    date: "November 11, 2026",               // e.g. 'November 9, 2026'
    notes: "Decks, Blob Designer, your phone as a controller, and buttons you can actually see light up.",              // the release's first line ("What's new")
    windows: {
      file: "Plugin-Player-Setup-0.2.1.exe",             // Plugin-Player-Setup-<version>.exe
      url: "https://github.com/RexAffects/plugin-player-releases/releases/download/v0.2.1/Plugin-Player-Setup-0.2.1.exe",              // https://github.com/RexAffects/plugin-player-releases/releases/download/v<version>/<file>
      sha256: "daee34a74befe47c55aeeb5a8f46434f2f9b75ac7618f92c5fd605aab4118728",           // of that exact file (lower-case hex, 64 characters)
      bytes: 148488850,
    },
    mac: {                  // the signed + notarized universal DMG (Apple silicon + Intel), same release
      dmg: 'Plugin-Player-0.2.1-universal.dmg',              // Plugin-Player-<version>-universal.dmg
      link: 'https://github.com/RexAffects/plugin-player-releases/releases/download/v0.2.1/Plugin-Player-0.2.1-universal.dmg',
      hash: 'bcb1a355cb23af565e55e629d66f2d4d45612cbd7435fd843238ff6259d1e086',
      size: 252755958,
    },
  };

  var ok = function () {
    var w = D.windows;
    return D.live && /^\d+\.\d+\.\d+/.test(D.version) && /^https:\/\/github\.com\/RexAffects\/plugin-player-releases\/releases\/download\//.test(w.url) && /^[0-9a-f]{64}$/.test(w.sha256) && w.bytes > 50e6;
  };
  D.ready = ok;
  var macOk = function () { var m = D.mac; return ok() && /^https:\/\/github\.com\/RexAffects\/plugin-player-releases\/releases\/download\//.test(m.link) && /^[0-9a-f]{64}$/.test(m.hash) && m.size > 50e6; };
  D.macReady = macOk;

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
    var mOn = macOk(), m = D.mac;
    [].forEach.call(document.querySelectorAll('[data-dl-mac]'), function (el) { el.hidden = (el.getAttribute('data-dl-mac') === 'live') !== mOn; });
    if (mOn) {
      set('mac-file', m.dmg); set('mac-size', mb(m.size)); set('mac-sha256', m.hash);
      [].forEach.call(document.querySelectorAll('[data-dl-href="mac"]'), function (a) { a.href = m.link; });
    }
  }
  // Meta 'Download' event (Rex, Nov 11: ads optimize for downloads). Only fires when the pixel is loaded, i.e. after the visitor
  // chose Allow in the cookie notice (shared/pixel.js); declined / GPC = no fbq = nothing sent. Same pattern as list-form.js Lead.
  function track(platform) { try { if (window.fbq) window.fbq('trackCustom', 'Download', { platform: platform, version: D.version }); } catch (e) {} }
  function wire() {
    [].forEach.call(document.querySelectorAll('[data-dl-href]'), function (a) {
      if (a.__raTracked) return; a.__raTracked = true;
      a.addEventListener('click', function () { track(a.getAttribute('data-dl-href')); });
    });
  }
  function start() { fill(); wire(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
