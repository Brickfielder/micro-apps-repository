# Micro-Apps Repository

A collection of static, browser-based micro-apps designed to support recovery after acquired brain injury.

## Repository structure
- `docs/` — GitHub Pages root for the live site.
  - `index.html` and `catalog.json` power the catalog page.
  - `apps/` contains each micro-app in its own folder (e.g., `docs/apps/example-app/index.html`).
  - `shared/` holds reusable assets (`shared/css/theme.css`, `shared/js/*.js`, and `shared/i18n/`).
  - `assets/` and `domains/` remain available for site-wide media or domain groupings.
- `docs-meta/` — contributor documentation such as `PROMPT.md` and `STYLEGUIDE.md`.
- `tools/` — development utilities (e.g., `add_clinician_comment.py`).
- `legacy/` — archived legacy builds that previously lived under `/apps`.
- Root files such as `Micro_Apps_Banner.png`, `rename-map.json`, `Please_read_before_using.txt`, `LICENSE` remain unchanged.

## Adding or updating an app
1. Create `docs/apps/<kebab-case-slug>/index.html` and load shared assets with `../shared/...` paths:
   ```html
   <link rel="stylesheet" href="../shared/css/theme.css" />
   <meta name="theme" content="bold dense" />
   <meta name="app-slug" content="<kebab-case-slug>" />
   <script defer src="../shared/js/frame.js"></script>
   <script defer src="../shared/js/clinician_feedback.js"></script>
   <main id="app"></main>
   ```
2. Place any app-specific media in `docs/apps/<slug>/assets/`.
3. Add or update the metadata entry for the app in `docs/catalog.json`.
