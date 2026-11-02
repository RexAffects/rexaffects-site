// Plugin Player beta page. The signup form is handled by ../shared/list-form.js
// (endpoint + on/off switch in ../shared/list-config.js).

// If the clip file is missing, show the poster only (no dead 0:00 player bar).
(function () {
  var v = document.querySelector('.beta-video');
  var s = v && v.querySelector('source');
  if (!s) return;
  s.addEventListener('error', function () { v.removeAttribute('controls'); });
})();
