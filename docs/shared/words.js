(function (global) {
  "use strict";

  const pluralGuard = new Set([
    "glasses",
    "scissors",
    "pants",
    "trousers",
    "jeans",
    "shorts",
    "pajamas",
    "pyjamas",
    "binoculars",
    "tweezers",
    "pliers",
    "tongs",
    "shears",
    "headphones",
    "stairs",
    "measles",
    "mumps",
    "diabetes",
    "arthritis",
    "news",
    "species",
    "series",
    "algae",
    "barracks",
    "aircraft",
    "deer",
    "sheep",
    "salmon",
    "bass",
    "police",
    "people",
    "children",
    "men",
    "women",
    "teeth",
    "feet",
  ]);

  function stripDiacritics(text) {
    if (typeof text.normalize === "function") {
      return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    }
    return text;
  }

  function singularizeToken(token) {
    const base = token;
    if (pluralGuard.has(base)) return base;
    if (base.endsWith("ies") && base.length > 3) return base.slice(0, -3) + "y";
    if (/(aves|ives)$/.test(base) && base.length > 4) return base.slice(0, -3) + "f";
    if (/(sses|zzes|ches|shes|xes)$/.test(base) && base.length > 4) return base.slice(0, -2);
    if (base.endsWith("es") && base.length > 3 && !/[aeiou]ses$/.test(base)) return base.slice(0, -2);
    if (base.endsWith("s") && base.length > 3 && !/ss$/.test(base)) return base.slice(0, -1);
    return base;
  }

  function normalizeWord(input, options) {
    const opts = options || {};
    if (input === null || input === undefined) return "";
    const asString = String(input)
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"');
    let lowered = stripDiacritics(asString)
      .toLowerCase()
      .replace(/[^a-z\u00c0-\u024f\s'\-]/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!lowered) return "";
    const tokens = lowered.split(" ").map((token) => {
      let cleaned = token;
      if (!opts.keepPossessive) {
        cleaned = cleaned.replace(/'s\b/, "").replace(/'\b/, "");
      }
      if (opts.keepPlural) return cleaned;
      return singularizeToken(cleaned);
    });
    return tokens.join(" ");
  }

  global.sharedWords = {
    normalizeWord,
  };
  global.normalizeWord = normalizeWord;
})(window);
