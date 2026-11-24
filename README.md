# Kairo — personal website

A static portfolio with a blog and docs section. No build step, no dependencies.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

- `index.html` — home: hero, toolkit, projects, recent posts, "now", contact form
- `blog.html` — archive with search, topic filters and saved posts
- `posts/*.html` — six individual articles
- `docs.html` — docs-style notes with sidebar and copyable code blocks
- `404.html` — custom not-found page
- `css/style.css` — light pink palette, dark palette, responsive layout, print styles
- `js/main.js` — theme, search/filters, saved posts, progress bar, share, contact form, service worker
- `feed.xml`, `sitemap.xml`, `robots.txt` — RSS and discovery files
- `manifest.webmanifest`, `sw.js`, `assets/` — installable app icons and offline cache

## Editing

- Find and replace `Kairo` and `noviqxofficial@gmail.com` to change identity details.
- Add a post: copy one file in `posts/`, add a matching block to `blog.html`, an item to `feed.xml`, and a URL to `sitemap.xml`.
- When adding/renaming files, bump `CACHE` in `sw.js` (v1 → v2, …) and update its `ASSETS` list.

## Publishing

The live copy is on GitHub Pages in the `kairo-portfolio` repository. After editing, upload the changed files to the repository; Pages rebuilds automatically.
