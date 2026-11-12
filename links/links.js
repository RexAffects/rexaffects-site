// /links: carry ?ref=ig|tt|yt|fb (and any utm_*) onto every link so the next page knows the platform.
// Internal links (/download, /live) get ?ref=...; outside links marked data-utm also get utm_* tags.
(function () {
  var q = new URLSearchParams(location.search);
  var ref = (q.get('ref') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 20).toLowerCase();
  var utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
    if (q.get(k)) utm[k] = q.get(k).slice(0, 80);
  });

  document.querySelectorAll('a[data-carry]').forEach(function (a) {
    var u = new URL(a.getAttribute('href'), location.href);
    var internal = u.origin === location.origin;
    if (ref) u.searchParams.set('ref', ref);
    Object.keys(utm).forEach(function (k) { u.searchParams.set(k, utm[k]); });
    if (!internal && a.hasAttribute('data-utm')) {
      if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', ref || 'rexaffects-links');
      if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'social');
      if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', 'linkinbio');
    }
    a.href = internal ? u.pathname + u.search + u.hash : u.toString();
  });
})();
