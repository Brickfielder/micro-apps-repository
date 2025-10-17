/* ==========================================================================
   Micro Apps Repository — Frame (v3.1 resilient)
   - Loads shared CSS once (root-relative)
   - Theme toggles via <meta name="theme" content="bold dense">
   - Title/desc from catalog.json via <meta name="app-slug">,
     with optional overrides <meta name="app-title"> / <meta name="app-desc">
   - Injects a hero header and wraps #app-root in .app-wrap
   - Exposes `sharedNative` shim for host/native wrappers
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

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

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
      const formattedSlug = metaInfo.slug
        ? escapeHtml(metaInfo.slug.replace(/[\-_]+/g, " "))
        : "";
      const titleHtml = metaInfo.title
        ? `<h1 class="hero-title">${escapeHtml(metaInfo.title)}</h1>`
        : "";
      const descHtml = metaInfo.desc
        ? `<p class="hero-lead">${escapeHtml(metaInfo.desc)}</p>`
        : "";
      const badgeHtml = formattedSlug
        ? `<span class="hero-badge" aria-label="App slug">${formattedSlug}</span>`
        : "";
      const hero = document.createElement("header");
      hero.className = "app-hero hero-accent app-hero--frame";
      hero.innerHTML = `
        <div class="hero-inner">
          <div class="hero-copy">
            ${badgeHtml}
            ${titleHtml}
            ${descHtml}
          </div>
          <div class="hero-visual" aria-hidden="true">
            <span class="hero-orbit hero-orbit--lg"></span>
            <span class="hero-orbit hero-orbit--md"></span>
            <span class="hero-orbit hero-orbit--sm"></span>
          </div>
        </div>
      `;
      wrap.insertBefore(hero, root);
      log("hero injected");
    }
  }

  // --- Init
  ensureTheme();
  function initNativeShim(metaInfo) {
    if (window.sharedNative && window.sharedNative.__isSharedNative) {
      return window.sharedNative;
    }

    const meta = metaInfo || {};
    const slugFromMeta = meta.slug || "";
    const slugFromPath = (() => {
      const part = (location.pathname || "").split("/").filter(Boolean).pop() || "";
      return part.replace(/\.html?$/i, "");
    })();
    const getMetaTag = (name) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      return el ? el.content || "" : "";
    };

    const nativeMeta = {
      slug: slugFromMeta || getMetaTag("app-slug") || slugFromPath,
      title:
        meta.title ||
        getMetaTag("app-title") ||
        document.title ||
        slugFromMeta ||
        slugFromPath ||
        "micro-app",
      desc: meta.desc || getMetaTag("app-desc") || getMetaTag("description") || "",
      theme: getMetaTag("theme") || "",
    };

    const queue = [];
    const listeners = new Set();
    const getBridge = () => window.ReactNativeWebView || window.__MICRO_APP_NATIVE__ || null;

    const tryPost = (raw) => {
      const bridge = getBridge();
      if (!bridge || typeof bridge.postMessage !== "function") return false;
      try {
        bridge.postMessage(raw);
        return true;
      } catch (err) {
        warn("native post failed", err);
        return false;
      }
    };

    const enqueue = (message) => {
      const raw = typeof message === "string" ? message : JSON.stringify(message);
      if (!tryPost(raw)) {
        queue.push(raw);
      }
      return raw;
    };

    const flushQueue = () => {
      if (!queue.length) return;
      const pending = queue.splice(0);
      while (pending.length) {
        const raw = pending.shift();
        if (!tryPost(raw)) {
          queue.unshift(raw, ...pending);
          break;
        }
      }
    };

    const sharedNative = {
      __isSharedNative: true,
      getMeta() {
        return { ...nativeMeta };
      },
      isNative() {
        return !!getBridge();
      },
      emit(type, payload) {
        if (!type) return false;
        const message = {
          type,
          payload: payload === undefined ? null : payload,
          meta: { slug: nativeMeta.slug, title: nativeMeta.title },
          timestamp: Date.now(),
        };
        enqueue(message);
        flushQueue();
        return message;
      },
      post(message) {
        const raw = enqueue(message);
        flushQueue();
        return raw;
      },
      shareCSV(csvText, extras) {
        if (!csvText) return false;
        const info = Object.assign({ csv: csvText }, extras || {});
        sharedNative.emit("share_csv", info);
        return true;
      },
      ready(extras) {
        sharedNative.emit("app_ready", Object.assign({}, extras || {}));
      },
      flush: flushQueue,
      onMessage(fn) {
        if (typeof fn !== "function") return () => {};
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    window.addEventListener("message", (event) => {
      if (!listeners.size) return;
      listeners.forEach((fn) => {
        try {
          fn(event.data, event);
        } catch (err) {
          warn("native listener error", err);
        }
      });
    });

    window.addEventListener("focus", flushQueue);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) flushQueue();
    });

    const flushTimer = setInterval(flushQueue, 2000);
    window.addEventListener("beforeunload", () => clearInterval(flushTimer));

    window.sharedNative = sharedNative;
    setTimeout(() => {
      sharedNative.ready();
      flushQueue();
    }, 0);

    return sharedNative;
  }

  loadMeta().then((meta) => {
    placeHeroAndWrap(meta);
    initNativeShim(meta);
  });
})();
