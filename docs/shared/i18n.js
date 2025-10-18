/* docs/shared/i18n.js — zero-build i18n for Micro Apps (EN/IT/ES ready) */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const rtl = new Set(["ar","he","fa","ur"]);

  // Infer the site base like frame.js does: "/<user>.github.io"
  function basePath(){
    const parts = (location.pathname||"/").split("/").filter(Boolean);
    return parts.length ? `/${parts[0]}` : "";
  }
  const BASE = basePath();

  function getSlug(){
    const m = $('meta[name="app-slug"]');
    if (m && m.content) return m.content.trim();
    const m2 = location.pathname.match(/\/apps\/([^/]+)/);
    return m2 ? m2[1] : "";
  }
  function getDomains(){
    const m = $('meta[name="i18n-domains"]');
    return m?.content ? m.content.split(",").map(s=>s.trim()).filter(Boolean) : [];
  }
  function getSupported(){
    const m = $('meta[name="i18n-langs"]');
    return m?.content ? m.content.split(",").map(s=>s.trim()).filter(Boolean) : ["en","it","es"];
  }
  function pickLang(){
    const url = new URLSearchParams(location.search).get("lang");
    const saved = localStorage.getItem("i18n.lang");
    const nav = (navigator.language||"en").toLowerCase().split("-")[0];
    const cand = (url || saved || nav);
    const sup = new Set(getSupported());
    return sup.has(cand) ? cand : (sup.has("en") ? "en" : Array.from(sup)[0]);
  }

  const I18N = {
    lang: pickLang(),
    slug: getSlug(),
    dict: {},
    ready: null,
    t(key, vars={}){
      const v = key.split(".").reduce((o,k)=>o && o[k], I18N.dict);
      if (v && typeof v === "object" && "other" in v && "count" in vars){
        const pr = new Intl.PluralRules(I18N.lang);
        const form = v[pr.select(Number(vars.count))] || v.other;
        return interpolate(form, vars);
      }
      return interpolate(v ?? key, vars);
    },
    async setLang(code){
      if (!code || code === I18N.lang) return;
      localStorage.setItem("i18n.lang", code);
      I18N.lang = code;
      applyLangAttrs();
      await I18N.load();
      I18N.apply();
    },
    async load(){
      const paths = [
        `${BASE}/docs/shared/i18n/common.en.json`,
        `${BASE}/docs/shared/i18n/common.${I18N.lang}.json`,
        // domain packs
        ...getDomains().flatMap(d => [
          `${BASE}/docs/domains/${d}/i18n/en.json`,
          `${BASE}/docs/domains/${d}/i18n/${I18N.lang}.json`,
        ]),
        // per-app
        I18N.slug ? `${BASE}/docs/apps/${I18N.slug}/i18n/en.json` : null,
        I18N.slug ? `${BASE}/docs/apps/${I18N.slug}/i18n/${I18N.lang}.json` : null,
        // fallback if the repo hosts shared at /shared
        `${BASE}/shared/i18n/common.en.json`,
        `${BASE}/shared/i18n/common.${I18N.lang}.json`,
      ].filter(Boolean);

      const bags = [];
      for (const p of paths){
        try {
          const r = await fetch(p, { cache:"no-store" });
          if (r.ok) bags.push(await r.json());
        } catch {}
      }
      I18N.dict = mergeAll(bags);
      return I18N.dict;
    },
    apply(root=document){
      $$('[data-i18n]', root).forEach(el => {
        const key = el.getAttribute('data-i18n');
        const vars = readVars(el);
        el.textContent = I18N.t(key, vars);
      });
      $$('[data-i18n-attr]', root).forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attrs = el.getAttribute('data-i18n-attr').split(',').map(s=>s.trim());
        const vars = readVars(el);
        const val = I18N.t(key, vars);
        attrs.forEach(a => el.setAttribute(a, val));
      });
      ensureSwitcher();
    }
  };
  window.I18N = I18N;

  function mergeAll(list){ const out={}; for (const src of list) deepMerge(out, src); return out; }
  function deepMerge(t,s){ for (const k in s){ const v=s[k];
    if (v && typeof v==="object" && !Array.isArray(v)){ t[k]=t[k]&&typeof t[k]==="object"?t[k]:{}; deepMerge(t[k],v); }
    else t[k]=v;
  }}
  function interpolate(str,vars){ if (typeof str!=="string") return str;
    return str.replace(/\{(\w+)\}/g,(_,k)=> (vars[k] ?? `{${k}}`));
  }
  function readVars(el){
    const vars={};
    for (const {name,value} of Array.from(el.attributes)){
      if (name.startsWith("data-i18n-") && name!=="data-i18n" && name!=="data-i18n-attr"){
        const key = name.replace("data-i18n-","");
        vars[key] = key==="count" ? Number(value) : value;
      }
    }
    return vars;
  }

  function ensureSwitcher(){
    if (document.getElementById("i18n-switcher")) return;
    const supported = getSupported();
    if (supported.length <= 1) return;

    let host = $(".toolbar") || $(".app-hero") || $(".app-wrap") || document.body;
    const box = document.createElement("div");
    box.id = "i18n-switcher";
    box.style.display = "inline-flex";
    box.style.gap = "8px";
    box.style.alignItems = "center";
    box.style.margin = "8px";

    const label = document.createElement("span");
    label.className = "pill";
    label.textContent = I18N.t("ui.language") || "Language";

    const select = document.createElement("select");
    select.setAttribute("aria-label", I18N.t("ui.language") || "Language");
    for (const code of supported){
      const o = document.createElement("option");
      o.value = code; o.textContent = code.toUpperCase();
      if (code === I18N.lang) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener("change", () => I18N.setLang(select.value));

    box.appendChild(label);
    box.appendChild(select);
    host.appendChild(box);
  }

  function applyLangAttrs(){
    document.documentElement.setAttribute("lang", I18N.lang);
    document.documentElement.setAttribute("dir", rtl.has(I18N.lang) ? "rtl" : "ltr");
  }

  applyLangAttrs();
  I18N.ready = I18N.load().then(() => {
    if (document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", () => I18N.apply());
    } else I18N.apply();
  });
})();
