/* clinician_feedback.js
 * Adds a clinician comment box (if not present) and augments any CSV download
 * so that a `clinician_comment` column is included in the output.
 */

(function () {
  // ---- UI: ensure a comment box exists at the end of #app-root ----
  function ensureCommentBox() {
    const root = document.getElementById("app-root") || document.body;
    if (!root) return;

    if (document.getElementById("clinician-comment")) return; // already present

    const section = document.createElement("section");
    section.id = "clinician-notes";
    section.style.marginTop = "24px";

    section.innerHTML = `
      <div style="
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 12px;
        box-shadow: var(--shadow);
        padding: 16px;
      ">
        <label for="clinician-comment" style="display:block;font-weight:600;margin-bottom:8px;">
          Clinician comments (optional)
        </label>
        <textarea id="clinician-comment" rows="4" style="
          width:100%; padding:10px; border-radius:8px; border:1px solid var(--line);
          font: inherit; resize: vertical;
        " placeholder="Enter any notes relevant to this session..."></textarea>
        <p style="margin:8px 0 0; color: var(--muted); font-size: 0.9rem;">
          This note will be added as <code>clinician_comment</code> in the exported CSV.
        </p>
      </div>
    `;
    root.appendChild(section);
  }

  // ---- CSV augmenter ----
  function getComment() {
    const el = document.getElementById("clinician-comment");
    return (el && el.value) ? el.value.replace(/\r?\n/g, " ").trim() : "";
  }

  function isProbablyCSV(text) {
    // crude but practical: commas or semicolons + newlines
    return /[,;].*\n/.test(text) || text.startsWith("data:text/csv");
  }

  function augmentCSVText(csvText) {
    if (!csvText) return csvText;
    // Normalize line endings
    const lines = csvText.replace(/\r\n/g, "\n").split("\n");
    if (lines.length === 0) return csvText;

    const comment = getComment();
    const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";

    // If there’s a header, extend it; else create header + move data to next line
    let header = lines[0].trim();
    let dataStartIndex = 1;
    if (!header || /[^A-Za-z0-9_;,\- ]/.test(header)) {
      // Looks like no clean header; synthesize one
      header = "field1" + sep + "field2";
      lines.unshift(header);
      dataStartIndex = 1;
    }

    if (!header.split(sep).map(s => s.trim()).includes("clinician_comment")) {
      lines[0] = header + sep + "clinician_comment";
    }

    // Append comment to every non-empty data row
    for (let i = dataStartIndex; i < lines.length; i++) {
      if (lines[i].trim().length === 0) continue;
      // If row already has the same number of columns as header-1, append; else try to append anyway
      lines[i] = lines[i] + sep + `"${comment.replace(/"/g, '""')}"`;
    }
    return lines.join("\r\n");
  }

  // Fetch blob url → text
  async function blobUrlToText(href) {
    const res = await fetch(href);
    const blob = await res.blob();
    const text = await blob.text();
    return text;
  }

  async function handleAnchorDownload(a) {
    try {
      const downloadAttr = (a.getAttribute("download") || "").toLowerCase();
      const isCSVName = downloadAttr.endsWith(".csv");
      const href = a.getAttribute("href") || "";

      if (!isCSVName && !href.includes("text/csv")) return;

      // Get CSV text regardless of source
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

      // Update anchor to new CSV
      a.setAttribute("href", url);
      if (!downloadAttr) a.setAttribute("download", "results.csv"); // ensure a filename

    } catch (e) {
      console.warn("CSV augmentation failed:", e);
    }
  }

  // Intercept clicks on <a download ...>
  document.addEventListener("click", function (ev) {
    const a = ev.target && (ev.target.closest && ev.target.closest("a[download]"));
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href) return;

    // For blob/data URLs we can replace on the fly; let default click continue
    if (href.startsWith("blob:") || href.startsWith("data:text/csv") || href.endsWith(".csv")) {
      // We prevent immediately, rewrite, then re-click
      ev.preventDefault();
      handleAnchorDownload(a).then(() => {
        // re-trigger a click after we update href
        a.click();
      });
    }
  }, true);

  // As a fallback, if apps trigger programmatic downloads after a button press,
  // developers can call window.__augmentCSV(text) themselves.
  window.__augmentCSV = augmentCSVText;

  // Initialize
  ensureCommentBox();
})();
