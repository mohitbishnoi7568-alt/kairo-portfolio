// Small progressive enhancements — the site works without this file too.

// Mobile navigation
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }
  });
}

// Current year in footer
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

// Blog category filters
const filterButtons = document.querySelectorAll('[data-filter]');
const visibleCount = document.getElementById('visible-count');
const posts = document.querySelectorAll('[data-category]');

function applyFilter(value) {
  let visible = 0;
  posts.forEach((post) => {
    const show = value === 'all' || post.dataset.category === value;
    post.hidden = !show;
    if (show) visible += 1;
  });
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (visibleCount) visibleCount.textContent = String(visible);
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => applyFilter(button.dataset.filter));
});

// Copy-to-clipboard button with a small inline label change
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const text = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = original; }, 1600);
    } catch (error) {
      button.textContent = 'Select email';
    }
  });
});

// Highlight the section currently in view in an article's table of contents
const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
if (tocLinks.length && 'IntersectionObserver' in window) {
  const sections = tocLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: '-15% 0px -70% 0px' });

  sections.forEach((section) => observer.observe(section));
}
