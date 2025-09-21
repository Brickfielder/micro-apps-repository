/* ==========================================================================
   Micro Apps Repository — Frame (v3 resilient)
   - Ensures shared CSS is loaded (tries /shared/ and /docs/shared/)
   - Optional bold/dense theming via <meta name="theme" content="bold dense">
   - Reads title/desc from catalog.json using <meta name="app-slug">,
     with page-level overrides <meta name="app-title"> / <meta name="app-desc">
   - Injects a hero header and wraps #app-root in .app-wrap (once)
   ========================================================================== */

(() => {
  // --- Base path detection: assume /<user>.github.io/<repo>/...
  function getBasePath() {
    const parts = (window.location.pathname || "/").split("/").filter(Boolean);
    return parts.length ? `/${parts[0]}` : "";
  }
  const BASE = getBasePath();

  // --- Optional theme toggles via meta tags
  (function applyThemeToggles(){
    const themeMeta = document.querySelector('meta[name="theme"]');
    if (!themeMeta) return;
    const raw = (themeMeta.content || "").toLowerCase();
    if (raw.includes("bold")) document.body.classList.add("brand-bold");
    if (raw.includes("dense")) document.body.classList.add("dense");
  })();

  // --- Ensure shared CSS is present (try both possible paths)
  function ensureAssets() {
    const tried = new Set();

    function addCSS(href){
      if (tried.has(href)) return;
      tried.add(href);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }

    addCSS(`${BASE}/shared/theme.css`);
    addCSS(`${BASE}/docs/shared/theme.css`);
  }

  // --- Load catalog.json (try both locations)
  async function loadCatalog() {
    for (const path of [
      `${BASE}/shared/catalog.json`,
      `${BASE}/docs/catalog.json`
    ]) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch {}
    }
    return null;
  }

  // --- Prepare metadata
  async function loadMeta() {
    const meta = {};
    const slugTag = document.querySelector('meta[name="app-slug"]');
    if (slugTag) meta.slug = slugTag.content;

    if (meta.slug) {
      const catalog = await loadCatalog();
      if (Array.isArray(catalog)) {
        const found = catalog.find(x => x.slug === meta.slug || x.name === meta.slug);
        if (found) {
          meta.title = found.title || found.name || "";
          meta.desc  = found.description || found.desc || "";
        }
      }
    }

    const titleTag = document.querySelector('meta[name="app-title"]');
    const descTag  = document.querySelector('meta[name="app-desc"]');
    if (titleTag) meta.title = titleTag.content;
    if (descTag)  meta.desc  = descTag.content;

    return meta;
  }

  // --- Inject hero and wrap #app-root
  function placeHeroAndWrap(metaInfo) {
    const root = document.getElementById("app-root") || document.body;
    if (!root) return;

    let wrap = root.closest(".app-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "app-wrap";
      if (root.parentNode) {
        root.parentNode.insertBefore(wrap, root);
        wrap.appendChild(root);
      } else {
        document.body.appendChild(wrap);
        wrap.appendChild(root);
      }
    }

    if (!wrap.querySelector(".app-hero")) {
      const hero = document.createElement("header");
      hero.className = "app-hero hero-accent";
      hero.innerHTML = `
        <h1>${metaInfo.title || ""}</h1>
        <p class="lead">${metaInfo.desc || ""}</p>
      `;
      wrap.insertBefore(hero, root);
    }
  }

  // --- Init
  ensureAssets();
  loadMeta().then(meta => { placeHeroAndWrap(meta); });
})();
