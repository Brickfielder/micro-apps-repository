
---

# PROMPT.md (optional, for you/AI assistants)

```md
You are generating a new “Micro-App” page that MUST:
- Import ../shared/theme.css and ../shared/frame.js (+ clinician_feedback.js).
- Include <meta name="theme" content="bold dense"> and either <meta name="app-slug"> or explicit app-title/desc.
- Mount all UI inside <main id="app-root"> only (frame will inject hero + wrapper).
- Use theme tokens and utilities (buttons, grid, toolbar, pill).
- Avoid overriding colors/typography unless necessary; respect :root tokens.
- Support keyboard navigation and visible focus.
- If exporting CSV, just create a CSV—clinician note is auto-appended.
Return a SINGLE full HTML file ready to drop at /docs/apps/<slug>.html.
