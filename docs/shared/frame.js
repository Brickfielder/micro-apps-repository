/* frame.js
 * Standardizes layout and header injection for Micro Apps.
 * This script reads metadata about each app (via catalog.json or meta tags),
 * then inserts a hero section and wraps existing content in a common layout.
 */

(() => {
  async function loadCatalog() {
    try {
      const res = await fetch('/catalog.json');
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {
      // Catalog missing or offline; ignore.
    }
    return null;
  }

  function getSlug() {
    // Prefer meta tag if present
    const metaSlug = document.querySelector('meta[name="app-slug"]');
    if (metaSlug && metaSlug.content.trim()) return metaSlug.content.trim();
    // Fallback to folder name from path
    const parts = location.pathname.replace(/\/+$/, '').split('/');
    return parts.pop() || 'app';
  }

  function fallbackMeta() {
    const title = document.querySelector('meta[name="app-title"]')?.content || document.title;
    const desc = document.querySelector('meta[name="app-desc"]')?.content || '';
    return { title, desc };
  }

  async function init() {
    const slug = getSlug();
    let metaInfo = { title: '', desc: '' };
    // Try catalog.json
    const catalog = await loadCatalog();
    if (catalog && Array.isArray(catalog.apps)) {
      const found = catalog.apps.find(a => a.slug === slug || (a.path && a.path.includes(`/${slug}/`)));
      if (found) {
        // Fallback to `name` and `desc` keys if `title`/`description` are absent
        metaInfo.title = found.title || found.name || '';
        metaInfo.desc  = found.description || found.desc || '';
      }
    }
    // Fallback: page-level meta tags
    if (!metaInfo.title) {
      const fallback = fallbackMeta();
      metaInfo.title = fallback.title;
      metaInfo.desc = fallback.desc;
    }
    // Build wrapper
    const body = document.body;
    const wrap = document.createElement('div');
    wrap.className = 'app-wrap';
    // Hero section
    const hero = document.createElement('section');
    hero.className = 'app-hero';
    hero.innerHTML = `<h1>${metaInfo.title}</h1>` + (metaInfo.desc ? `<p class="lead">${metaInfo.desc}</p>` : '');
    // Move existing content into #app-root if necessary
    let appRoot = document.getElementById('app-root');
    if (!appRoot) {
      appRoot = document.createElement('main');
      appRoot.id = 'app-root';
      // Move all child nodes except the wrap into appRoot
      const nodes = Array.from(body.childNodes);
      nodes.forEach(n => {
        if (n !== wrap) appRoot.appendChild(n);
      });
    }
    wrap.appendChild(hero);
    wrap.appendChild(appRoot);
    // Clear body and mount new structure
    body.innerHTML = '';
    body.appendChild(wrap);
  }

  // Kick off when DOM ready
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();