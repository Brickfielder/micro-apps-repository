# AGENT.md

**Purpose**  
This document instructs the coding agent to generate Micro-Apps that share a consistent look & feel by consuming the shared assets and following the conventions below.

---

## 1) Shared assets (must be present)

Place these files at:

- `docs/shared/theme.css`  
- `docs/shared/frame.js`  
- `docs/shared/clinician_feedback.js`

All apps live in `docs/apps/` and must import the shared assets with `../shared/...`.

---

## 2) Required head tags & mount point

Every new app **must** include the following in `<head>` and the single mount point in `<body>`:

```html
<link rel="stylesheet" href="../shared/theme.css" />
<meta name="theme" content="bold dense" />
<meta name="app-slug" content="your-app-slug" />
<script defer src="../shared/frame.js"></script>
<script defer src="../shared/clinician_feedback.js"></script>
