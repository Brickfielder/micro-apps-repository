/* frame.js
 * Standardizes layout and header injection for Micro Apps.
 * - Detects the correct base path for assets and catalog.json automatically.
 * - Inserts a hero header with title/description.
 */

(() => {
  // Detect base path (repo name under /<user>.github.io/<repo>/...)
  function getBasePath() {
    // e.g. /micro-apps-repository/emotion_chat/
    const pathParts = window.location.pathname.split("/");
    // Find repo name (assume first non-empty segment is repo)
    // e.g. ["", "micro-apps-repository", "emotion_chat", ""]
    if (pathParts.length > 1) {
      return "/" + pathParts[1];
    }
    return "";
  }

  const BASE = getBasePath();

  async function loadCatalog() {
    try {
      const res = await fetch(`${BASE}/docs/catalog.json`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Could not load catalog.json", e);
    }
    return null;
  }

  async function init() {
    const metaInfo = {};
    const slugTag = document.querySelector("meta[name=app-slug]");
    if (slugTag) {
      metaInfo.slug = slugTag.content;
    }

    const catalog = await loadCatalog();
    if (catalog && metaInfo.slug) {
      const found = catalog.find(
        (x) => x.slug === metaInfo.slug || x.name === metaInfo.slug
      );
      if (found) {
        metaInfo.title = found.title || found.name || "";
        metaInfo.desc = found.description || found.desc || "";
      }
    }

    // Override with page-specific meta if present
    const titleTag = document.querySelector("meta[name=app-title]");
    const descTag = document.querySelector("meta[name=app-desc]");
    if (titleTag) metaInfo.title = titleTag.content;
    if (descTag) metaInfo.desc = descTag.content;

    // Build hero header
    const hero = document.createElement("header");
    hero.style.padding = "1.5rem";
    hero.style.textAlign = "center";
    hero.style.borderBottom = "1px solid var(--line)";
    hero.innerHTML = `
      <h1 style="margin:0;font-size:2rem;color:var(--text)">${metaInfo.title || ""}</h1>
      <p style="margin:0.5rem 0 0;color:var(--muted)">${metaInfo.desc || ""}</p>
    `;
    const root = document.getElementById("app-root");
    if (root) {
      root.prepend(hero);
    }
  }

  // Inject shared CSS/JS dynamically in case index.html missed it
  function ensureAssets() {
    const cssHref = `${BASE}/docs/shared/theme.css`;
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssHref;
      document.head.appendChild(link);
    }
  }

  ensureAssets();
  init();
})();
