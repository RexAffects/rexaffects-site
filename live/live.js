// /live: pick the wide or tall hero loop for the screen, nav background on scroll, fade-ins.
(function () {
  var v = document.getElementById('heroVideo');
  if (v) {
    var tall = window.matchMedia('(max-aspect-ratio: 4/5)').matches;
    v.poster = v.getAttribute(tall ? 'data-tall-poster' : 'data-wide-poster');
    v.src = v.getAttribute(tall ? 'data-tall' : 'data-wide');
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: the poster stays */ });
  }

  var nav = document.getElementById('liveNav');
  var onScroll = function () { if (nav) nav.classList.toggle('scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var els = document.querySelectorAll('.fade-in');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { io.observe(el); });
})();
