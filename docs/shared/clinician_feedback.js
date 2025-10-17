/* ==========================================================================
   clinician_feedback.js — v2 resilient
   - Injects a clinician note card (styled by theme.css)
   - Appends shared metadata columns (app_slug, app_title, exported_at, clinician_comment)
   ========================================================================== */

(function () {
  let commentEl = null;
  let countEl = null;
  const NOTE_CHAR_LIMIT = 600;
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
      enhanceTextarea(commentEl);
      countEl = findCountElement(commentEl.closest("#clinician-notes"));
      bindCommentListener();
      return commentEl;
    }

    const section = document.createElement("section");
    section.id = "clinician-notes";
    section.className = "note-card";
    const limitAttr = NOTE_CHAR_LIMIT ? `maxlength="${NOTE_CHAR_LIMIT}"` : "";
    section.innerHTML = `
      <header class="note-card__head">
        <span class="note-card__badge">Clinician</span>
        <h2 class="note-card__title">Session notes</h2>
        <p class="note-card__subhead">Document professional observations for the care team.</p>
      </header>
      <div class="note-card__body">
        <label for="clinician-comment">Clinician comments (optional)</label>
        <textarea id="clinician-comment" rows="4" ${limitAttr} data-note-input
          placeholder="Enter any notes relevant to this session..."></textarea>
        <div class="note-card__footer">
          <p class="helper">
            This note will be added as <code>clinician_comment</code> in the exported CSV.
          </p>
          <span class="note-card__count" data-note-count></span>
        </div>
      </div>
    `;
    root.appendChild(section);
    commentEl = section.querySelector("#clinician-comment");
    countEl = section.querySelector("[data-note-count]");
    enhanceTextarea(commentEl);
    bindCommentListener();
    updateNoteCount();
    return commentEl;
  }

  function enhanceTextarea(el) {
    if (!el) return;
    if (NOTE_CHAR_LIMIT && !el.getAttribute("maxlength")) {
      el.setAttribute("maxlength", NOTE_CHAR_LIMIT);
    }
    el.setAttribute("data-note-input", "1");
  }

  function findCountElement(scope) {
    if (!scope) return null;
    let found = scope.querySelector("[data-note-count]");
    if (found) return found;
    const footer = scope.querySelector(".note-card__footer");
    if (footer) {
      found = document.createElement("span");
      found.className = "note-card__count";
      found.setAttribute("data-note-count", "");
      footer.appendChild(found);
      return found;
    }
    const helper = scope.querySelector(".helper");
    if (helper && helper.parentElement) {
      found = document.createElement("span");
      found.className = "note-card__count";
      found.setAttribute("data-note-count", "");
      helper.parentElement.appendChild(found);
      return found;
    }
    return null;
  }

  function updateNoteCount() {
    if (!commentEl) return;
    if (!countEl || !countEl.isConnected) {
      countEl = findCountElement(commentEl.closest("#clinician-notes"));
    }
    if (!countEl) return;
    const length = commentEl.value ? commentEl.value.length : 0;
    const maxAttr = parseInt(commentEl.getAttribute("maxlength"), 10);
    const limit = Number.isFinite(maxAttr) && maxAttr > 0 ? maxAttr : (NOTE_CHAR_LIMIT || null);
    if (limit) {
      countEl.textContent = `${length}/${limit}`;
      countEl.dataset.state = length >= limit * 0.9 ? "warn" : "ok";
    } else {
      countEl.textContent = `${length} characters`;
      countEl.dataset.state = "ok";
    }
  }

  function bindCommentListener() {
    if (!commentEl || commentEl.__clinicianBound) return;
    commentEl.__clinicianBound = true;
    commentEl.addEventListener("input", () => {
      updateNoteCount();
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
    updateNoteCount();
    notifyListeners();
  }

  function notifyListeners() {
    updateNoteCount();
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
  updateNoteCount();
  notifyListeners();
})();
