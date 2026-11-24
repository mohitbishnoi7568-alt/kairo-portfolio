// Small progressive enhancements — the site works without this file too.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove('show'), 2200);
}

async function copyText(text, message = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch (error) {
    const field = document.createElement('textarea');
    field.value = text;
    document.body.appendChild(field);
    field.select();
    try {
      document.execCommand('copy');
      toast(message);
    } catch (failure) {
      toast('Copy failed — select the text manually');
    }
    field.remove();
  }
}

// Mobile navigation
const toggle = $('.nav-toggle');
const nav = $('#site-nav');
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

// Theme: saved choice first, then OS preference
const THEME_KEY = 'kairo-theme';
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  const button = $('#theme-toggle');
  if (button) {
    const dark = theme === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.setAttribute('title', dark ? 'Light theme' : 'Dark theme');
  }
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1b1418' : '#fff9fb');
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (error) { /* storage unavailable */ }
  }
}

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (error) { /* storage unavailable */ }
applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
$('#theme-toggle')?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
});

// Current year in footer
$$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

// Copy email and code blocks
$$('[data-copy]').forEach((button) => {
  button.addEventListener('click', () => copyText(button.dataset.copy, 'Email copied'));
});
$$('.copy-code').forEach((button) => {
  button.addEventListener('click', () => {
    const pre = button.closest('pre');
    const code = pre?.querySelector('code');
    if (code) copyText(code.textContent.trim(), 'Code copied');
  });
});

// Blog: search + category + saved filter
const SAVED_KEY = 'kairo-saved';
let savedPosts = new Set();
try { savedPosts = new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')); } catch (error) { /* ignore */ }

const searchInput = $('#post-search');
const filterButtons = $$('.filter-btn');
const postItems = $$('[data-category]');
const visibleCount = $('#visible-count');

function applyFilters() {
  const activeFilter = $('.filter-btn.active')?.dataset.filter || 'all';
  const query = (searchInput?.value || '').trim().toLowerCase();
  let visible = 0;

  postItems.forEach((item) => {
    const id = item.dataset.post;
    const categoryOK = activeFilter === 'all'
      || (activeFilter === 'saved' ? savedPosts.has(id) : item.dataset.category === activeFilter);
    const haystack = (item.dataset.search || item.textContent || '').toLowerCase();
    const show = categoryOK && (!query || haystack.includes(query));
    item.hidden = !show;
    if (show) visible += 1;

    const saveButton = $('.save-btn', item);
    if (saveButton) {
      const isSaved = savedPosts.has(id);
      saveButton.setAttribute('aria-pressed', String(isSaved));
      saveButton.setAttribute('aria-label', isSaved ? 'Remove from saved' : 'Save for later');
      saveButton.textContent = isSaved ? '★' : '☆';
    }
  });

  if (visibleCount) visibleCount.textContent = String(visible);
  const empty = $('#empty-state');
  if (empty) empty.hidden = visible > 0;
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((other) => {
      other.classList.remove('active');
      other.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
    applyFilters();
  });
});
searchInput?.addEventListener('input', applyFilters);

$$('.save-btn').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.save;
    if (savedPosts.has(id)) savedPosts.delete(id);
    else savedPosts.add(id);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify([...savedPosts])); } catch (error) { /* ignore */ }
    applyFilters();
    toast(savedPosts.has(id) ? 'Saved for later' : 'Removed from saved');
  });
});

document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName || '';
  if (event.key === '/' && !/INPUT|TEXTAREA/i.test(tag) && searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
});
applyFilters();

// Reading progress bar
const progressBar = $('#progress-bar');
if (progressBar) {
  const updateProgress = () => {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    const percent = range > 0 ? Math.min(100, Math.max(0, (window.scrollY / range) * 100)) : 0;
    progressBar.style.width = percent + '%';
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

// Floating back-to-top
const toTop = $('#to-top');
if (toTop) {
  const updateTop = () => toTop.classList.toggle('show', window.scrollY > 400);
  window.addEventListener('scroll', updateTop, { passive: true });
  updateTop();
  toTop.addEventListener('click', () => {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
}

// Article section links and share
$$('.anchor-copy').forEach((button) => {
  button.addEventListener('click', () => {
    const url = location.origin + location.pathname + '#' + button.dataset.anchor;
    copyText(url, 'Link to section copied');
  });
});
$('#share-post')?.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, text: 'A note by Kairo', url: location.href });
      return;
    } catch (error) { /* share cancelled — fall back to copy */ }
  }
  copyText(location.href, 'Post link copied');
});

// Contact form opens the visitor's email app (nothing is stored or sent by the site)
$('#contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name') || '').trim();
  const message = String(data.get('message') || '').trim();
  if (!name || !message) {
    toast('Add your name and a message');
    return;
  }
  const subject = encodeURIComponent('Hello Kairo — from ' + name);
  const body = encodeURIComponent(message + '\n\n— ' + name);
  window.location.href = 'mailto:noviqxofficial@gmail.com?subject=' + subject + '&body=' + body;
});

// Reveal sections as they enter the viewport
const reveals = $$('.reveal');
if (reveals.length && 'IntersectionObserver' in window) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveals.forEach((element) => element.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((element) => observer.observe(element));
  }
}

// Highlight the article heading currently in view
const tocLinks = $$('.toc a[href^="#"]');
if (tocLinks.length && 'IntersectionObserver' in window) {
  const sections = tocLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
      });
    });
  }, { rootMargin: '-15% 0px -70% 0px' });
  sections.forEach((section) => observer.observe(section));
}

// Offline support
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const path = $('meta[name="sw-path"]')?.getAttribute('content') || './sw.js';
  window.addEventListener('load', () => navigator.serviceWorker.register(path).catch(() => {}));
}
