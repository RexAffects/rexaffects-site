// /download/'s email box (Rex, Nov 14). ~100% of the ad traffic is phones, and Plugin Player installs on a computer.
// A phone or tablet sees "On your phone? Send me the download link" at the top of the card (source phone-link: the store
// mails the link at once, with the monthly-free-scene confirm button). A computer sees the smaller "Get a free scene
// every month" box under the download buttons (source desktop-monthly, the usual double opt-in).
// The forms themselves are shared/list-form.js + shared/list-config.js (the one list, the one switch).
// ?sl=phone or ?sl=desktop forces one (local review / screenshots).
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPadOS asks for the desktop site
  var phone = /iPhone|iPad|iPod|Android|Windows Phone|webOS|BlackBerry|Mobi/i.test(ua) || iPadOs;
  var force = new URLSearchParams(location.search).get('sl');
  if (force === 'phone') phone = true; else if (force === 'desktop') phone = false;
  var want = phone ? 'phone' : 'desktop';
  [].forEach.call(document.querySelectorAll('[data-sl]'), function (el) { el.hidden = el.getAttribute('data-sl') !== want; });
  if (phone) document.documentElement.classList.add('sl-on-phone');
})();
