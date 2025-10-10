/* ==========================================================================
   clinician_feedback.js — v2 resilient
   - Injects a clinician note card (styled by theme.css)
   - Appends shared metadata columns (app_slug, app_title, exported_at, clinician_comment)
   ========================================================================== */

(function () {
  let commentEl = null;
  const listeners = new Set();

  function getAppMeta() {
    try {
      if (window.sharedNative && typeof window.sharedNative.getMeta === "function") {
        const meta = window.sharedNative.getMeta() || {};
        if (meta && (meta.slug || meta.title)) return meta;
      }
    } catch (err) {
      console.warn("sharedNative meta failed", err);
    }
    const getMetaTag = (name) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      return el ? el.content || "" : "";
    };
    const slugFromPath = (() => {
      const part = (location.pathname || "").split("/").filter(Boolean).pop() || "";
      return part.replace(/\.html?$/i, "");
    })();
    return {
      slug: getMetaTag("app-slug") || slugFromPath,
      title: getMetaTag("app-title") || document.title || slugFromPath || "micro-app",
      desc: getMetaTag("app-desc") || getMetaTag("description") || "",
    };
  }

  function ensureCommentBox() {
    if (commentEl && document.body.contains(commentEl)) return commentEl;
    const root = document.getElementById("app-root") || document.body;
    if (!root) return null;

    commentEl = document.getElementById("clinician-comment");
    if (commentEl) {
      bindCommentListener();
      return commentEl;
    }

    const section = document.createElement("section");
    section.id = "clinician-notes";
    section.className = "note-card";
    section.innerHTML = `
      <label for="clinician-comment">Clinician comments (optional)</label>
      <textarea id="clinician-comment" rows="4"
        placeholder="Enter any notes relevant to this session..."></textarea>
      <p class="helper">
        This note will be added as <code>clinician_comment</code> in the exported CSV.
      </p>
    `;
    root.appendChild(section);
    commentEl = section.querySelector("#clinician-comment");
    bindCommentListener();
    return commentEl;
  }

  function bindCommentListener() {
    if (!commentEl || commentEl.__clinicianBound) return;
    commentEl.__clinicianBound = true;
    commentEl.addEventListener("input", () => {
      notifyListeners();
    });
  }

  function getComment() {
    const el = ensureCommentBox();
    return (el && el.value) ? el.value.replace(/\r?\n/g, " ").trim() : "";
  }

  function setComment(value) {
    const el = ensureCommentBox();
    if (!el) return;
    el.value = value || "";
    notifyListeners();
  }

  function notifyListeners() {
    const note = getComment();
    listeners.forEach((fn) => {
      try {
        fn(note);
      } catch (err) {
        console.warn("clinician note listener failed", err);
      }
    });
  }

  function isProbablyCSV(text) {
    return /[,;].*\n/.test(text) || text.startsWith("data:text/csv");
  }

  function augmentCSVText(csvText) {
    if (!csvText) return csvText;
    const lines = csvText.replace(/\r\n/g, "\n").split("\n");
    if (lines.length === 0) return csvText;

    const comment = getComment();
    const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
    const meta = getAppMeta();
    const exportedAt = new Date().toISOString();

    const escape = (value) => {
      if (window.sharedCSV && typeof window.sharedCSV.escapeCell === "function") {
        return window.sharedCSV.escapeCell(value, sep);
      }
      const str = String(value || "");
      return '"' + str.replace(/"/g, '""') + '"';
    };

    let header = lines[0].trim();
    let dataStartIndex = 1;

    if (!header || /[^A-Za-z0-9_;,\- ]/.test(header)) {
      header = "field1" + sep + "field2";
      lines.unshift(header);
      dataStartIndex = 1;
    }

    const additions = [
      { name: "app_slug", value: meta.slug || "" },
      { name: "app_title", value: meta.title || "" },
      { name: "exported_at", value: exportedAt },
      { name: "clinician_comment", value: comment },
    ];

    const headerCells = lines[0].split(sep);
    const headerNames = headerCells.map((s) => s.trim());
    const toAppend = [];

    additions.forEach((entry) => {
      if (!headerNames.includes(entry.name)) {
        headerCells.push(entry.name);
        headerNames.push(entry.name);
        toAppend.push(entry);
      }
    });

    if (toAppend.length) {
      lines[0] = headerCells.join(sep);
      for (let i = dataStartIndex; i < lines.length; i++) {
        if (lines[i].trim().length === 0) continue;
        let row = lines[i];
        toAppend.forEach((entry) => {
          row = row + sep + escape(entry.value);
        });
        lines[i] = row;
      }
    }
    return lines.join("\r\n");
  }

  async function blobUrlToText(href) {
    const res = await fetch(href);
    const blob = await res.blob();
    return await blob.text();
  }

  async function handleAnchorDownload(a) {
    try {
      const downloadAttr = (a.getAttribute("download") || "").toLowerCase();
      const isCSVName = downloadAttr.endsWith(".csv");
      const href = a.getAttribute("href") || "";
      if (!isCSVName && !href.includes("text/csv")) return;

      let csvText = "";
      if (href.startsWith("blob:")) {
        csvText = await blobUrlToText(href);
      } else if (href.startsWith("data:text/csv")) {
        csvText = decodeURIComponent(href.split(",")[1] || "");
      } else if (href.startsWith("http")) {
        const res = await fetch(href);
        csvText = await res.text();
      } else {
        return;
      }

      if (!isProbablyCSV(csvText)) return;

      const newCsv = augmentCSVText(csvText);
      if (!newCsv) return;

      const blob = new Blob([newCsv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      a.setAttribute("href", url);
      if (!downloadAttr) a.setAttribute("download", "results.csv");

    } catch (e) {
      console.warn("CSV augmentation failed:", e);
    }
  }

  document.addEventListener("click", function (ev) {
    const a = ev.target && (ev.target.closest && ev.target.closest("a[download]"));
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href) return;

    if (href.startsWith("blob:") || href.startsWith("data:text/csv") || href.endsWith(".csv")) {
      ev.preventDefault();
      handleAnchorDownload(a).then(() => a.click());
    }
  }, true);

  // Fallback API
  window.__augmentCSV = augmentCSVText;
  window.__clinicianNotes = {
    getNote: getComment,
    setNote: setComment,
    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  // Init
  ensureCommentBox();
  bindCommentListener();
  notifyListeners();
})();
