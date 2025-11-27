(function (global) {
  "use strict";

  const BOM = "\uFEFF";

  function normalizeValue(value) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" && !isFinite(value)) return "";
    return String(value);
  }

  function escapeCell(value, delimiter) {
    const str = normalizeValue(value).replace(/\r\n?|\n/g, "\n");
    const needsQuotes = str.includes("\n") || str.includes("\"") || str.includes(delimiter);
    if (!needsQuotes) return str;
    return '"' + str.replace(/"/g, '""') + '"';
  }

  function toRow(row, delimiter) {
    if (!Array.isArray(row)) {
      if (row && typeof row === "object") {
        return Object.values(row).map((v) => escapeCell(v, delimiter));
      }
      return [escapeCell(row, delimiter)];
    }
    return row.map((cell) => escapeCell(cell, delimiter));
  }

  function stringify(rows, options) {
    const opts = options || {};
    const delimiter = opts.delimiter || ",";
    const out = [];
    if (opts.header && opts.header.length) {
      out.push(toRow(opts.header, delimiter).join(delimiter));
    }
    if (Array.isArray(rows)) {
      for (let i = 0; i < rows.length; i += 1) {
        out.push(toRow(rows[i], delimiter).join(delimiter));
      }
    }
    const body = out.join("\r\n");
    return (opts.bom === false ? "" : BOM) + body;
  }

  function deriveColumns(records, explicit) {
    if (Array.isArray(explicit) && explicit.length) return explicit;
    const cols = new Set();
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      if (!record || typeof record !== "object") continue;
      Object.keys(record).forEach((key) => cols.add(key));
    }
    return Array.from(cols);
  }

  function fromRecords(records, options) {
    const opts = options || {};
    const cols = deriveColumns(records, opts.columns);
    const rows = [];
    if (opts.includeHeader !== false) rows.push(cols);
    for (let i = 0; i < records.length; i += 1) {
      const rec = records[i] || {};
      rows.push(cols.map((col) => rec[col]));
    }
    return stringify(rows, { delimiter: opts.delimiter, bom: opts.bom, header: null });
  }

  function buildCSV(source, options) {
    if (typeof source === "string") {
      const includeBom = options ? options.bom !== false : true;
      const text = source.replace(/^\uFEFF/, "");
      return (includeBom ? BOM : "") + text;
    }
    if (options && Array.isArray(options.records)) {
      return fromRecords(options.records, options);
    }
    if (Array.isArray(source)) {
      return stringify(source, options);
    }
    return stringify([], options);
  }

  function toBlob(source, options) {
    const csv = buildCSV(source, options);
    return new Blob([csv], { type: "text/csv;charset=utf-8;" });
  }

  function triggerDownload(config) {
    const opts = config || {};
    const filename = opts.filename || "results.csv";
    let csvText = "";
    if (typeof opts.csv === "string") {
      csvText = buildCSV(opts.csv, opts);
    } else if (Array.isArray(opts.records)) {
      csvText = fromRecords(opts.records, opts);
    } else {
      csvText = stringify(opts.rows || [], opts);
    }
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    const root = document.body || document.documentElement;
    if (root && root.appendChild) {
      root.appendChild(link);
      link.click();
      link.remove();
    } else {
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { csv: csvText, blob, url };
  }

  const api = {
    BOM,
    escapeCell,
    stringify,
    fromRecords,
    toBlob,
    triggerDownload,
  };

  global.sharedCSV = api;
})(window);
