// Respects the OS "reduce motion" setting. When it's on we never auto-advance
// anything — the visitor drives the carousel with the numbered buttons instead.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ===== Hero Carousel =====
const hero = document.getElementById('hero');
const slides = document.querySelectorAll('.hero-slide');
const dots = document.querySelectorAll('.hero-dot');
let currentSlide = 0;
let carouselInterval;

function goToSlide(index) {
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  // Opacity alone does not hide a slide from screen readers, so the
  // inactive slides are explicitly hidden and only the active one is exposed.
  slides[currentSlide].setAttribute('aria-hidden', 'true');
  dots[currentSlide].setAttribute('aria-current', 'false');
  currentSlide = index;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
  slides[currentSlide].removeAttribute('aria-hidden');
  dots[currentSlide].setAttribute('aria-current', 'true');
}

function nextSlide() {
  goToSlide((currentSlide + 1) % slides.length);
}

function startCarousel() {
  if (prefersReducedMotion.matches) return;
  clearInterval(carouselInterval);
  carouselInterval = setInterval(nextSlide, 5000);
}

function stopCarousel() {
  clearInterval(carouselInterval);
}

function resetCarousel() {
  stopCarousel();
  startCarousel();
}

// Dot click navigation
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    goToSlide(parseInt(dot.dataset.slide));
    resetCarousel();
  });
});

// Hold the carousel still while a keyboard user is reading/tabbing inside the hero,
// and stop it entirely if "reduce motion" gets switched on mid-visit.
if (hero) {
  hero.addEventListener('focusin', stopCarousel);
  hero.addEventListener('focusout', (e) => {
    if (!hero.contains(e.relatedTarget)) startCarousel();
  });
}
prefersReducedMotion.addEventListener('change', () => {
  if (prefersReducedMotion.matches) stopCarousel();
  else startCarousel();
});

if (slides.length > 1) startCarousel();

// ===== Scroll-triggered fade-in animations =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ===== Mobile nav toggle =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

function setNavOpen(open) {
  navLinks.classList.toggle('active', open);
  navToggle.classList.toggle('active', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
}

navToggle.addEventListener('click', () => {
  setNavOpen(!navLinks.classList.contains('active'));
});

// Close mobile nav on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => setNavOpen(false));
});

// Escape closes the mobile nav and returns focus to the toggle
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navLinks.classList.contains('active')) {
    setNavOpen(false);
    navToggle.focus();
  }
});

// ===== Email reveal (anti-scrape) =====
const emailCard = document.getElementById('emailReveal');

function revealEmail(card) {
  if (card.classList.contains('revealed')) return;
  card.classList.add('revealed');
  const u = 'support';
  const d = 'rexaffects.com';
  const addr = u + '@' + d;
  const cta = card.querySelector('.connect-cta-reveal');
  cta.innerHTML = addr + ' <span aria-hidden="true">&rarr;</span>';
  card.style.cursor = 'default';
  // Wrap card in mailto link
  const link = document.createElement('a');
  link.href = 'mailto:' + addr;
  link.className = 'connect-card connect-email revealed fade-in visible';
  link.innerHTML = card.innerHTML;
  card.replaceWith(link);
  // Move focus onto the revealed address so keyboard and screen reader users
  // land on it instead of being dropped at the top of the page.
  link.focus();
}

emailCard.addEventListener('click', function () { revealEmail(this); });

// The card is a div acting as a button, so it needs its own key handling.
emailCard.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    revealEmail(this);
  }
});

// ===== Nav blur intensifies on scroll =====
const nav = document.querySelector('.nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });
