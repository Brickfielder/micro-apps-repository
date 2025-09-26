/* ==========================================================================
   Micro Apps Repository — Frame (v3.1 resilient)
   - Loads shared CSS once (root-relative)
   - Theme toggles via <meta name="theme" content="bold dense">
   - Title/desc from catalog.json via <meta name="app-slug">,
     with optional overrides <meta name="app-title"> / <meta name="app-desc">
   - Injects a hero header and wraps #app-root in .app-wrap
   - Supports global overrides: window.__CATALOG_URL__, window.__THEME_URL__, window.__FRAME_DEBUG__
   ========================================================================== */
(() => {
  // --- Resolve base path (e.g., "/micro-apps-repository")
  const BASE = (() => {
    const parts = (location.pathname || "/").split("/").filter(Boolean);
    return parts.length ? `/${parts[0]}` : "";
  })();

  const DEBUG = !!window.__FRAME_DEBUG__;
  const CATALOG_URL = window.__CATALOG_URL__ || `${BASE}/catalog.json`;
  const THEME_URL   = window.__THEME_URL__   || `${BASE}/shared/theme.css`;

  const log = (...a) => DEBUG && console.log("[frame]", ...a);
  const warn = (...a) => DEBUG && console.warn("[frame]", ...a);

  // --- Apply optional theme toggles
  (function applyThemeToggles() {
    const m = document.querySelector('meta[name="theme"]');
    if (!m) return;
    const raw = (m.content || "").toLowerCase();
    if (raw.includes("bold"))  document.documentElement.classList.add("brand-bold");
    if (raw.includes("dense")) document.documentElement.classList.add("dense");
  })();

  // --- Ensure shared CSS exists once
  function ensureTheme() {
    if (document.querySelector(`link[href="${THEME_URL}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = THEME_URL; // root-relative, published path
    link.setAttribute("data-frame-theme","1");
    document.head.appendChild(link);
    log("theme injected:", THEME_URL);
  }

  // --- Load catalog from the correct public URL
  async function loadCatalog() {
    try {
      const res = await fetch(CATALOG_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      log("catalog loaded", CATALOG_URL, json);
      return json;
    } catch (e) {
      warn("catalog fetch failed", CATALOG_URL, e);
      return null;
    }
  }

  // --- Helpers
  const getMeta = n => (document.querySelector(`meta[name="${n}"]`) || {}).content || "";

  async function loadMeta() {
    const meta = {
      slug:  getMeta("app-slug"),
      title: getMeta("app-title") || "",
      desc:  getMeta("app-desc")  || ""
    };

    if (meta.slug) {
      const catalog = await loadCatalog();
      if (Array.isArray(catalog)) {
        const found = catalog.find(x => x.slug === meta.slug || x.name === meta.slug);
        if (found) {
          meta.title ||= (found.title || found.name || "");
          meta.desc  ||= (found.description || found.desc || "");
        } else {
          warn("slug not found in catalog:", meta.slug);
        }
      }
    }
    return meta;
  }

  // --- Inject hero and wrap #app-root (only if we have something to show)
  function placeHeroAndWrap(metaInfo) {
    const root = document.getElementById("app-root") || document.body;
    if (!root) return;

    // Only add hero if we have title or desc
    if (!metaInfo.title && !metaInfo.desc) {
      log("no title/desc to inject; skipping hero");
      return;
    }

    let wrap = root.closest(".app-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "app-wrap";
      if (root.parentNode) {
        root.parentNode.insertBefore(wrap, root);
      } else {
        document.body.appendChild(wrap);
      }
      wrap.appendChild(root);
    }

    if (!wrap.querySelector(".app-hero")) {
      const hero = document.createElement("header");
      hero.className = "app-hero hero-accent app-hero--frame";
      hero.innerHTML = `
        <div class="hero-text" style="text-align:center;padding:10px 14px;">
          ${metaInfo.title ? `<h1 style="margin:0;font-weight:700;">${metaInfo.title}</h1>` : ""}
          ${metaInfo.desc  ? `<p class="lead" style="margin:.4rem 0 0;opacity:.85;">${metaInfo.desc}</p>` : ""}
        </div>
      `;
      wrap.insertBefore(hero, root);
      log("hero injected");
    }
  }

  // --- Init
  ensureTheme();
  loadMeta().then(placeHeroAndWrap);
})();
