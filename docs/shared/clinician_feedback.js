/* clinician_feedback.js — style-free UI + CSV augmentation */

(function () {
  // ---- UI: ensure a comment box exists at the end of #app-root ----
  function ensureCommentBox() {
    const root = document.getElementById("app-root") || document.body;
    if (!root || document.getElementById("clinician-comment")) return;

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
  }

  // ---- CSV augmenter ----
  function getComment() {
    const el = document.getElementById("clinician-comment");
    return (el && el.value) ? el.value.replace(/\r?\n/g, " ").trim() : "";
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

    let header = lines[0].trim();
    let dataStartIndex = 1;

    if (!header || /[^A-Za-z0-9_;,\- ]/.test(header)) {
      header = "field1" + sep + "field2";
      lines.unshift(header);
      dataStartIndex = 1;
    }

    if (!header.split(sep).map(s => s.trim()).includes("clinician_comment")) {
      lines[0] = header + sep + "clinician_comment";
    }

    for (let i = dataStartIndex; i < lines.length; i++) {
      if (lines[i].trim().length === 0) continue;
      lines[i] = lines[i] + sep + `"${comment.replace(/"/g, '""')}"`;
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

  // Fallback API for programmatic CSV strings
  window.__augmentCSV = augmentCSVText;

  // Init
  ensureCommentBox();
})();
