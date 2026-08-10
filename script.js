/*
 * script.js — Intelligence Brief landing page
 *
 * Table of contents
 * ─────────────────
 *  1. Theme toggle         — dark/light, persisted in localStorage
 *  2. Live dates           — ISO week number + formatted date stamped into DOM
 *  3. Nav condense         — adds .scrolled class after 40px scroll
 *  5. Scroll reveal        — IntersectionObserver drives .in-view on sections
 *  6. Hero parallax        — newsletter card translates ±9px on mouse move
 *  7. Magnetic buttons     — CTA buttons follow cursor within ±6px
 *  8. Toggle pill helper   — sliding pill for the sample tier toggle
 *  9. Sample tier toggle   — Free / Premium content gate (blur + lock overlay)
 * 10. Pricing              — single annual plan, no toggle
 * 11. Vignette slider      — auto-advances every 4s, dot controls
 * 12. Word counter         — counts from 0 → 1,500 when tile enters viewport
 * 13. Timeline fill        — animated accent line draws as you scroll
 * 14. Keyboard shortcuts   — S → pricing, / → footer email
 */

/* ============================================================
   1. THEME TOGGLE
   Reads saved preference from localStorage on load.
   Toggles data-theme on <html> and saves to localStorage.
   CSS handles all visual switching via [data-theme] selectors.
   ============================================================ */
const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

const savedTheme = localStorage.getItem('ib-theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('ib-theme', next);
});

/* ============================================================
   2. LIVE DATES
   Computes the current ISO week number and formats today's date.
   Stamps three places in the DOM:
   — Hero issue label   "ISSUE №17 · Fri, 18 Apr 2026"
   — Newsletter preview card date
   — Sample issue header date
   ============================================================ */
function isoWeek(d) {
  /* ISO 8601 week: week containing the first Thursday of the year is week 1. */
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const jan4 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - jan4) / 864e5 - 3 + (jan4.getDay() + 6) % 7) / 7);
}

const now      = new Date();
const weekNum  = isoWeek(now);
const dateStr  = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dateUpper = dateStr.toUpperCase();

const heroIssueEl  = document.getElementById('heroIssue');
const nlCardDateEl = document.getElementById('nlCardDate');
const sampleDateEl = document.getElementById('sampleDate');

/* Week number is only a placeholder until the real issue number loads. */
if (heroIssueEl)  heroIssueEl.textContent  = `ISSUE №${weekNum} · ${dateStr}`;
if (nlCardDateEl) nlCardDateEl.textContent = dateUpper;
if (sampleDateEl) sampleDateEl.textContent = dateUpper;

/* The archive index is the only source of truth for what the latest issue
   actually is. Without this the hero shows an ISO week number, which does
   not match the issue numbers published on the archive page. */
fetch('archive/index.json')
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(entries => {
    if (!entries || !entries.length) return;
    const latest = entries[0];
    const when = new Date(latest.date + 'T00:00:00').toLocaleDateString('en-US',
      { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    if (heroIssueEl) heroIssueEl.textContent = `ISSUE №${latest.issue} · ${when}`;
    const readLatest = document.getElementById('readLatest');
    if (readLatest) {
      readLatest.href = latest.file;
      readLatest.removeAttribute('target');
    }
  })
  .catch(() => { /* keep the placeholder; the page still works offline */ });

/* ============================================================
   3. NAV CONDENSE
   Adds .scrolled after 40px — triggers glass-morphism backdrop
   and height reduction defined in CSS.
   ============================================================ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ============================================================
   5. SCROLL REVEAL
   IntersectionObserver adds .in-view to each .reveal-section.
   CSS then transitions:
   — .reveal-heading  via clip-path (mask-slide-up effect)
   — .reveal-block    via opacity + translateY
   Once in-view, stays visible (no un-observe needed here).
   ============================================================ */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('in-view');
  });
}, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

document.querySelectorAll('.reveal-section').forEach(s => revealObs.observe(s));

/* ============================================================
   6. HERO PARALLAX
   The newsletter preview card translates ±9px based on cursor
   position relative to the viewport centre.
   Only runs on desktop (hover: hover media query).
   ============================================================ */
const heroPreview = document.getElementById('heroPreview');
if (heroPreview && window.matchMedia('(hover: hover)').matches) {
  document.addEventListener('mousemove', e => {
    const x = (e.clientX / window.innerWidth  - 0.5) * 18;
    const y = (e.clientY / window.innerHeight - 0.5) * 18;
    heroPreview.style.transform = `translate(${x}px, ${y}px)`;
  });
}

/* ============================================================
   7. MAGNETIC BUTTONS
   .btn-magnetic elements follow the cursor within ±6px using
   30% of the offset from the button's centre — feels attracted,
   not glued. Resets on mouseleave.
   ============================================================ */
document.querySelectorAll('.btn-magnetic').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r   = btn.getBoundingClientRect();
    const x   = (e.clientX - r.left - r.width  / 2) * 0.3;
    const y   = (e.clientY - r.top  - r.height / 2) * 0.3;
    const max = 6;
    btn.style.transform = `translate(${Math.max(-max, Math.min(max, x))}px, ${Math.max(-max, Math.min(max, y))}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});

/* ============================================================
   8. TOGGLE PILL HELPER
   Shared utility for the sliding pill selector used in both
   the Tier toggle (Free / Premium) and the Billing toggle
   (Monthly / Annual).
   Returns an updatePill(activeBtn) function to call on click.
   ============================================================ */
function initPill(pill, buttons) {
  function updatePill(activeBtn) {
    /* Slide pill to cover whichever button is active */
    const idx   = [...buttons].indexOf(activeBtn);
    const firstW = buttons[0].offsetWidth;
    pill.style.width     = activeBtn.offsetWidth + 'px';
    pill.style.transform = idx === 0 ? 'translateX(0)' : `translateX(${firstW}px)`;
  }
  /* Initialise to whichever button has .active on load */
  const active = [...buttons].find(b => b.classList.contains('active')) || buttons[0];
  pill.style.width = active.offsetWidth + 'px';
  updatePill(active);
  return updatePill;
}

/* ============================================================
   9. SAMPLE TIER TOGGLE
   Switches data-tier attribute on #sampleCard between
   "free" and "premium". CSS uses that attribute to blur
   .prem-content and show a lock overlay in free mode,
   and to animate content in via revealIn in premium mode.
   ============================================================ */
const sampleCard = document.getElementById('sampleCard');
const tierBtns   = document.querySelectorAll('.tier-btn');
const tierPill   = document.getElementById('tierPill');

if (sampleCard && tierPill && tierBtns.length) {
  const updateTierPill = initPill(tierPill, tierBtns);
  sampleCard.setAttribute('data-tier', 'free'); /* default state */

  tierBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tierBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      sampleCard.setAttribute('data-tier', btn.dataset.tier);
      updateTierPill(btn);
    });
  });
}

/* ============================================================
   10. PRICING
   Single annual plan ($19.99/yr founding rate) — no billing toggle, no price
   animation. The CTA links straight to the Stripe payment link
   in the markup.
   ============================================================ */

/* ============================================================
   11. VIGNETTE SLIDER
   Auto-advances between three "What Most People Miss" quotes
   every 4 seconds. Dot buttons let users jump directly to
   any slide. Clicking a dot resets the timer.
   ============================================================ */
const vignettes = document.querySelectorAll('.vignette');
const dots      = document.querySelectorAll('.dot');
let current = 0, vigTimer;

function showVignette(idx) {
  vignettes.forEach((v, i) => v.classList.toggle('active', i === idx));
  dots.forEach((d, i)      => d.classList.toggle('active', i === idx));
  current = idx;
}

function startVigTimer() {
  vigTimer = setInterval(() => showVignette((current + 1) % vignettes.length), 4000);
}

dots.forEach(d => {
  d.addEventListener('click', () => {
    clearInterval(vigTimer);
    showVignette(+d.dataset.idx);
    startVigTimer();
  });
});

if (vignettes.length) startVigTimer();

/* ============================================================
   12. WORD COUNTER ANIMATION
   Counts from 0 → 1,500 over ~1.8s using setInterval at 60fps.
   Fires once when the tile scrolls into view (IntersectionObserver
   disconnects after first trigger).
   ============================================================ */
const wordCounterEl = document.getElementById('wordCounter');
if (wordCounterEl) {
  const wcObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      let count = 0;
      const target = 1500;
      const step   = target / (1800 / 16); /* ~60fps over 1.8s */
      const t = setInterval(() => {
        count = Math.min(count + step, target);
        wordCounterEl.textContent = Math.round(count).toLocaleString();
        if (count >= target) clearInterval(t);
      }, 16);
      wcObs.disconnect();
    }
  }, { threshold: 0.5 });
  wcObs.observe(wordCounterEl);
}

/* ============================================================
   13. TIMELINE FILL
   Draws an accent line down the timeline track as the user
   scrolls through the "How it works" section.
   Height is calculated as: how far the viewport has consumed
   the timeline element, clamped 0–100%.
   ============================================================ */
const timelineFill = document.getElementById('timelineFill');
const timelineEl   = document.querySelector('.timeline');

if (timelineFill && timelineEl) {
  function updateTimeline() {
    const r     = timelineEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1,
      (window.innerHeight - r.top) / (r.height + window.innerHeight * 0.6)
    ));
    timelineFill.style.height = (ratio * 100) + '%';
  }
  window.addEventListener('scroll', updateTimeline, { passive: true });
  updateTimeline();
}

/* ============================================================
   14. KEYBOARD SHORTCUTS
   S  — smooth-scroll to #pricing
   /  — scroll to footer, focus email input
   Both are suppressed when focus is inside a text field,
   and when meta/ctrl modifiers are held (browser shortcuts).
   ============================================================ */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.metaKey || e.ctrlKey) return;

  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (e.key === '/') {
    e.preventDefault();
    const fe = document.getElementById('footerEmail');
    if (fe) {
      fe.scrollIntoView({ behavior: 'smooth', block: 'center' });
      /* Small delay so scroll completes before focusing */
      setTimeout(() => fe.focus(), 380);
    }
  }
});
