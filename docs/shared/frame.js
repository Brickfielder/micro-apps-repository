/* ==========================================================================
   Micro Apps Repository — Frame (v2)
   - Ensures shared CSS is loaded
   - Optional bold/dense theming via <meta name="theme" content="bold dense">
   - Reads title/desc from catalog.json using <meta name="app-slug">,
     with page-level overrides <meta name="app-title"> / <meta name="app-desc">
   - Injects a hero header and wraps #app-root in .app-wrap (once)
   ========================================================================== */

(() => {
  // --- Base path detection: assume /<user>.github.io/<repo>/...
  function getBasePath() {
    const parts = (window.location.pathname || "/").split("/").filter(Boolean);
    // e.g. /micro-apps-repository/emotion_chat/ -> repo is parts[0]
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

  // --- Ensure shared CSS is present
  function ensureAssets() {
    const cssHref = `${BASE}/docs/shared/theme.css`;
    if (!document.querySelector(`link[rel="stylesheet"][href="${cssHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssHref;
      document.head.appendChild(link);
    }
  }

  // --- Load catalog (best-effort)
  async function loadCatalog() {
    try {
      const res = await fetch(`${BASE}/docs/catalog.json`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Could not load catalog.json", e);
    }
    return null;
  }

  // --- Prepare metadata (slug → title/desc, with overrides)
  async function loadMeta() {
    const meta = {};
    const slugTag = document.querySelector('meta[name="app-slug"]');
    if (slugTag) meta.slug = slugTag.content;

    // Pull from catalog if possible
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

    // Page-level overrides
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

    // Ensure .app-wrap wrapper exists
    let wrap = root.closest(".app-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "app-wrap";
      if (root.parentNode) {
        root.parentNode.insertBefore(wrap, root);
        wrap.appendChild(root);
      } else {
        // As a fallback, append to body
        document.body.appendChild(wrap);
        wrap.appendChild(root);
      }
    }

    // If a hero already exists, don't duplicate
    const existingHero = wrap.querySelector(".app-hero");
    if (existingHero) return;

    const hero = document.createElement("header");
    hero.className = "app-hero hero-accent"; // gradient kicks in when brand-bold is active
    hero.innerHTML = `
      <h1>${metaInfo.title || ""}</h1>
      <p class="lead">${metaInfo.desc || ""}</p>
    `;
    wrap.insertBefore(hero, root);
  }

  // --- Init
  ensureAssets();
  loadMeta().then(meta => {
    placeHeroAndWrap(meta);
  });
})();
