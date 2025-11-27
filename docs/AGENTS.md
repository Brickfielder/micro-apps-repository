# AGENT.md

**Purpose**
Ensure Micro-Apps share a consistent look & feel by consuming shared assets and following the conventions below.

---

## 1) Shared assets (must be present)
- `docs/shared/css/theme.css`
- `docs/shared/js/frame.js`
- `docs/shared/js/clinician_feedback.js`
- Other shared utilities live in `docs/shared/js/`, and translations live in `docs/shared/i18n/`.

All live apps live in `docs/apps/<slug>/` and must import the shared assets with `../shared/...` relative paths. App-specific media should stay inside `docs/apps/<slug>/assets/` when needed.

---

## 2) Required head tags & mount point
Include the following in `<head>` and mount your app inside a single element in `<body>`:

```html
<link rel="stylesheet" href="../shared/css/theme.css" />
<meta name="theme" content="bold dense" />
<meta name="app-slug" content="your-app-slug" />
<script defer src="../shared/js/frame.js"></script>
<script defer src="../shared/js/clinician_feedback.js"></script>
```

```html
<body>
  <main id="app"></main>
</body>
```

---

## 3) Repository layout notes
- GitHub Pages root is `docs/` with metadata in `docs/catalog.json` and shared assets in `docs/shared/`.
- Contributor docs live in `docs-meta/`; tooling scripts live in `tools/`; archived legacy builds are kept in `legacy/`.
