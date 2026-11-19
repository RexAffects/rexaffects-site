// The business's public identity and the legal pages' versions, in ONE place for all of rexaffects.com.
// Every page footer, the four legal pages (/terms/ /refunds/ /eula/ /privacy/), /cookies/ and the store's BUY sheet read
// from here. Change a value here and it changes everywhere; nothing else in the site repeats the address.
//
// ADDRESS: NOT CONFIRMED until Form 1583 is done (the USPS form for the business mailbox, Unit #639). It is a business
// mailbox, never Rex's home. To hide it everywhere, set ADDRESS = '' : footers then read "USA" and the legal pages fall
// back to the text already in the page ("Fayetteville, AR").
//
// VERSIONS / DATES: [to be set at publish]. Blank = the pages show "[to be set at publish]". When the pages go live, fill
// them here AND the same versions in plugin-player app/shared/legal.cjs (EULA_VERSION, TERMS_VERSION), so the app and
// the website record the same version in an order's consent (rexaffects-store lib/v2.ts consentOf: 1-20 of A-Z a-z 0-9 . _ -).
(function () {
  var ADDRESS = '1590 E Joyce Blvd #8543, Fayetteville, AR 72703'; // USPS PO Box 8543 with Street Addressing (confirmed Tue Nov 10)

  var L = window.RA_LEGAL = {
    trade: 'RexAffects',
    owner: 'RexAffects LLC', // the seller: RexAffects LLC, an Arkansas limited liability company (back in Good Standing Nov 17, 2026; was Rex Roberts, sole proprietor)
    address: ADDRESS,
    country: 'USA',
    support: 'support@rexaffects.com',
    // [to be set at publish]
    // DRAFT (branch drop-waiver, Rex Nov 19): set the real go-live date in these three lines at publish, and the same versions in
    // plugin-player app/shared/legal.cjs. 1.4 / 1.3 / 1.4: the 14-day waiver box is gone; EU/EEA/UK buyers keep 14 days to cancel.
    terms:   { version: '1.4', effective: 'November 19, 2026', updated: 'November 19, 2026' }, // 1.4: no waiver box, 3.2 + 7.1 + 7.2 (Nov 19 draft). 1.3: seller is now RexAffects LLC (Nov 17). 1.2: 2.8 the Pass (renewal, cancel, price lock, grace), US spelling (Nov 16). 1.1: box C dropped, beta list corrected (Nov 15)
    eula:    { version: '1.2', effective: 'November 17, 2026', updated: 'November 17, 2026' }, // 1.2: seller is now RexAffects LLC, US spelling (Nov 17). 1.1: 7.1 list corrected, 7.3 no box (Nov 15)
    refunds: { version: '1.3', effective: 'November 19, 2026', updated: 'November 19, 2026' }, // 1.3: section 1 + 7, EU/EEA/UK 14 days to cancel (Nov 19 draft). 1.2: seller is now RexAffects LLC, US spelling (Nov 17). 1.1: section 4 beta list corrected (Nov 15)
    privacy: { version: '1.5', effective: 'November 11, 2026', updated: 'November 19, 2026' }, // 1.5: the consent row names the Terms box (Nov 19 draft; after branch privacy-counts' 1.4, the anonymous counts). 1.3: RexAffects LLC is the controller, US spelling (Nov 17)
    cookies: { version: '1.0', effective: 'November 11, 2026', updated: 'November 11, 2026' },
  };
  // what the BUY sheet sends as consent.eula / consent.termsVersion (same shape as the app's legal-model.js consentFor)
  L.eulaVersion = L.eula.version;
  L.termsVersion = L.terms.version;

  var TBD = '[to be set at publish]';

  function fill() {
    // <span data-legal="address">Fayetteville, AR</span>: the full address, or the page's own fallback text when blank
    [].forEach.call(document.querySelectorAll('[data-legal="address"]'), function (el) { if (L.address) el.textContent = L.address; });
    // <span data-legal="address-line">USA</span>: "address, USA" in footers, or just "USA"
    [].forEach.call(document.querySelectorAll('[data-legal="address-line"]'), function (el) { el.textContent = L.address ? L.address + ', ' + L.country : L.country; });
    // <span data-legal="terms.version">[to be set at publish]</span> etc.
    [].forEach.call(document.querySelectorAll('[data-legal*="."]'), function (el) {
      var k = el.getAttribute('data-legal').split('.'), doc = L[k[0]];
      if (doc && typeof doc === 'object' && k[1] in doc) el.textContent = doc[k[1]] || TBD;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
