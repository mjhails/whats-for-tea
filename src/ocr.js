// Free recipe reading on the phone itself, used when the Claude helper isn't set up.
// Tesseract reads the text from the photos (the reading files download once from a
// public CDN, then the browser caches them), and parseRecipe turns that text into a
// draft meal for the "Check the scanned meal" form. Nothing is sent to a paid service.

let workerP = null;
let progressCb = null;

function getWorker() {
  if (!workerP) {
    workerP = import("tesseract.js")
      .then(({ createWorker }) =>
        createWorker("eng", 1, {
          logger: (m) => {
            if (progressCb && m && typeof m.progress === "number") progressCb(m.status || "", m.progress);
          },
        })
      )
      .catch((e) => {
        workerP = null;
        throw e;
      });
  }
  return workerP;
}

// Greyscale and stretch the contrast so printed text stands out from coloured
// card backgrounds and glare. Tesseract does the black-and-white step itself.
async function prep(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = y; hist[y]++; }
  const n = d.length / 4; let lo = 0, hi = 255, acc = 0;
  while (lo < 254 && (acc += hist[lo]) < n * 0.02) lo++;
  acc = 0; while (hi > lo + 1 && (acc += hist[hi]) < n * 0.02) hi--;
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] - lo) * k)); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(im, 0, 0);
  return c;
}

// A word worth keeping: read confidently and shaped like a real word, number or amount.
const NUMISH = /^[(]?\d+([.,/]\d+)?(g|kg|ml|l|x|tbsp|tsp|mins?|kcal)?[)]?[,.]?$/i;
function goodWord(w) {
  const t = (w.text || "").trim();
  if (!t) return false;
  if (NUMISH.test(t) || /^[½¼¾⅓⅔&-]$/.test(t)) return w.confidence >= 55;
  if (w.confidence < 70) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < t.replace(/[.,:;!()'’-]/g, "").length) return false; // stray symbols mixed in
  if (letters.length === 1) return /^[aAI]$/.test(letters);
  return /[aeiouy]/i.test(letters) && !/[bcdfghjklmnpqrstvwxz]{4,}/i.test(letters);
}

// Turns pasted text (for example copied with Live Text) into the same shape readImages returns.
export function textToPages(text) {
  return [String(text || "").split(/\r?\n/).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).map((t, i) => ({ text: t, h: i === 0 ? 1 : 0, conf: 100 }))];
}

// Reads each image and returns its lines with their height on the page,
// so the biggest text (usually the meal name) can be picked out.
export async function readImages(images, onProgress) {
  progressCb = onProgress || null;
  const worker = await getWorker();
  const pages = [];
  for (let i = 0; i < images.length; i++) {
    if (onProgress) onProgress("reading photo " + (i + 1) + " of " + images.length, 0);
    let img = images[i];
    try { img = await prep(images[i]); } catch (e) { /* read the photo as it is */ }
    const { data } = await worker.recognize(img, {}, { text: true, blocks: true });
    const lines = [];
    (data.blocks || []).forEach((b) =>
      (b.paragraphs || []).forEach((p) =>
        (p.lines || []).forEach((l) => {
          const ws = (l.words || []).filter(goodWord);
          // keep the line only if most of it was read cleanly and it has at least one real word
          if (!ws.length || ws.length < (l.words || []).length * 0.6) return;
          if (!ws.some((w) => /[A-Za-z]{3}/.test(w.text))) return;
          const text = ws.map((w) => w.text).join(" ").trim();
          lines.push({ text, h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0, conf: l.confidence || 0 });
        })
      )
    );
    pages.push(lines);
  }
  progressCb = null;
  return pages;
}

/* ---------- turning text into a meal ---------- */

const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const UNIT_RE = "(kg|g|grams?|gr|ml|millilitres?|l|litres?|tbsp|tablespoons?|tsp|teaspoons?|tins?|cans?|cartons?|packs?|pack|cloves?|x|pcs?|pieces?|slices?|bags?|sachets?|pots?|cups?)";
const QTY_RE = "(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|[½¼¾⅓⅔]|\\d+\\s*[½¼¾])";
const LEAD = new RegExp("^[-•*·]?\\s*" + QTY_RE + "\\s*" + UNIT_RE + "?\\b\\.?\\s*(?:of\\s+)?(.+)$", "i");
const TRAIL = new RegExp("^[-•*·]?\\s*(.+?)[\\s,(:]+" + QTY_RE + "\\s*" + UNIT_RE + "?\\)?$", "i");
const ING_HEAD = /^(ingredients?|you will need|what you need|what you'll need|from your box|in your box|shopping list)\b/i;
const METHOD_HEAD = /^(method|instructions?|directions?|steps?|let'?s cook|how to make( it)?|preparation|cooking instructions)\b/i;
const STOP_WORDS = new Set("a an and or of the fresh large small medium chopped diced sliced finely roughly sprig handful pinch to taste optional free range british pack packs tin tins can cans x g kg ml for with in your box from".split(" "));
const SKIP_ING = /^(salt|black pepper|salt (and|&) pepper|pepper and salt|water|seasoning)$/i;
const CUP_HINT = /(salt|pepper|oil|stock|spice|seasoning|paprika|cumin|chilli flakes|powder|herbs?|oregano|thyme|basil|sauce|vinegar|honey|sugar|mustard|ketchup|cornflour|flour|garlic granules)/i;

function num(q) {
  if (!q) return null;
  q = q.replace(",", ".").trim();
  if (FRACTIONS[q] != null) return FRACTIONS[q];
  const mixed = q.match(/^(\d+)\s*([½¼¾⅓⅔])$/);
  if (mixed) return +mixed[1] + FRACTIONS[mixed[2]];
  const frac = q.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return +frac[2] ? +frac[1] / +frac[2] : null;
  const n = parseFloat(q);
  return Number.isFinite(n) ? n : null;
}

function normUnit(u) {
  if (!u) return null;
  u = u.toLowerCase();
  if (/^kg/.test(u)) return "kg";
  if (/^(g|gr|gram)/.test(u)) return "g";
  if (/^(ml|millil)/.test(u)) return "ml";
  if (/^(l|litre)/.test(u)) return "l";
  if (/^(tbsp|tables|tsp|teas|sachet|cup)/.test(u)) return "spoon";
  if (/^(tin|can|carton)/.test(u)) return "tin";
  if (/^clove/.test(u)) return "clove";
  if (/^slice/.test(u)) return "slice";
  if (/^bag/.test(u)) return "bag";
  return "x";
}

const words = (s) => s.toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
const stem = (w) => w.replace(/(oes|ies|es|s)$/, (m) => (m === "ies" ? "y" : m === "oes" ? "o" : ""));

// Ranks the shopping-list ingredients whose names match the text, best first.
export function matchIngredient(text, ING, skip) {
  const tw = words(text).map(stem);
  if (!tw.length) return null;
  const cupish = CUP_HINT.test(text);
  const ranked = [];
  Object.keys(ING).forEach((k) => {
    if (skip && skip.has(k)) return;
    const iw = words(ING[k].n).map(stem);
    if (!iw.length) return;
    const hits = iw.filter((w) => tw.includes(w)).length;
    if (!hits) return;
    // reward covering the ingredient's own words, then sauces/stock/spices going to the cupboard;
    // break ties toward shorter names
    const score = hits / iw.length + hits * 0.25 - iw.length * 0.01 + (cupish && ING[k].a === "cup" ? 0.3 : 0);
    if (score >= 0.5) ranked.push([score, k]);
  });
  ranked.sort((a, b) => b[0] - a[0]);
  return ranked.length ? ranked[0][1] : null;
}

function cleanName(s) {
  return s.replace(/\(.*?\)/g, " ").replace(/[^A-Za-z&' -]+/g, " ")
    .replace(/(^|\s)(g|kg|ml|l|x|tbsp|tsp|cartons?|tins?|cans?|sachets?|packs?|pots?|pcs?)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ").trim().replace(/^(of)\s+/i, "");
}

function parseIngLine(line) {
  let m = line.match(LEAD);
  if (m && /[a-z]{3}/i.test(m[3])) return { q: num(m[1]), unit: normUnit(m[2]), name: cleanName(m[3]) };
  m = line.match(TRAIL);
  if (m && /[a-z]{3}/i.test(m[1])) return { q: num(m[2]), unit: normUnit(m[3]), name: cleanName(m[1]) };
  return null;
}

function toQty(p, def) {
  if (p.q == null) return 1;
  if (def.u === "g") return p.unit === "kg" ? p.q * 1000 : p.unit === "g" ? p.q : p.unit === "x" || !p.unit ? p.q * 150 : p.q;
  if (def.u === "ml") return p.unit === "l" ? p.q * 1000 : p.unit === "spoon" ? p.q * 15 : p.q;
  if (def.u === "clove") return p.unit === "g" ? Math.max(1, Math.round(p.q / 5)) : p.q;
  if (def.u === "tin") return p.unit === "g" || p.unit === "ml" ? Math.max(1, Math.round(p.q / 400)) : p.q;
  if (p.unit === "g" || p.unit === "ml" || p.unit === "kg" || p.unit === "l") return 1;
  return p.q;
}

const PROTEIN_WORDS = [
  ["chicken", /chicken/i], ["turkey", /turkey/i], ["beef", /beef|steak|corned/i],
  ["pork", /pork|sausage|ham|bacon|gammon|chorizo/i], ["fish", /fish|salmon|cod|haddock|tuna|prawn|basa|pollock/i], ["egg", /\begg/i],
];

// pages: [[{text, h}]] in the order the photos were taken (front of the card first).
export function parseRecipe(pages, ING) {
  const all = pages.flat().map((l) => ({ ...l, text: l.text.replace(/[|]/g, "I").trim() })).filter((l) => l.text.length > 1);
  if (!all.length) return null;
  const text = all.map((l) => l.text).join("\n");

  // Name: the tallest proper-looking line on the first photo.
  const first = (pages[0] || []).filter((l) => /^[A-Za-z][A-Za-z&',' -]{5,70}$/.test(l.text.trim()) && !ING_HEAD.test(l.text) && !METHOD_HEAD.test(l.text) && words(l.text).length >= 2);
  let name = "";
  if (first.length) name = first.slice().sort((a, b) => b.h - a.h)[0].text.trim();
  name = name.replace(/\s+/g, " ").replace(/\b([a-z])/g, (c, x, i) => (i === 0 ? c.toUpperCase() : c));

  const kcalM = text.match(/(\d{3,4})\s*k?cal/i) || text.match(/(?:energy|calories)\D{0,12}(\d{3,4})/i);
  const minsM = text.match(/(\d{1,3})\s*(?:-|to)?\s*(?:\d{1,3}\s*)?(?:mins?|minutes)\b/i);

  // Split into the ingredients and method sections when there are headings.
  const lines = all.map((l) => l.text);
  let ingStart = lines.findIndex((l) => ING_HEAD.test(l));
  let methStart = lines.findIndex((l, i) => i > ingStart && METHOD_HEAD.test(l));
  const ingLines = ingStart >= 0 ? lines.slice(ingStart + 1, methStart > ingStart ? methStart : undefined) : lines;
  const methodLines = methStart >= 0 ? lines.slice(methStart + 1) : lines.filter((l) => /^\s*\d{1,2}[.)]\s+\S/.test(l) || l.split(" ").length >= 8);

  const ing = [], newIng = {}, seen = new Set();
  ingLines.forEach((line) => {
    if (METHOD_HEAD.test(line) || line.split(" ").length > 9) return;
    const p = parseIngLine(line);
    const nameText = p ? p.name : ingStart >= 0 && /^[A-Za-z][A-Za-z ,'-]{2,40}$/.test(line) ? cleanName(line) : null;
    if (!nameText || words(nameText).length === 0 || SKIP_ING.test(nameText)) return;
    if (p && p.q != null && (p.q <= 0 || p.q > 3000)) return; // misread number
    const k = matchIngredient(nameText, ING, seen);
    if (k) {
      seen.add(k);
      const def = ING[k];
      ing.push(def.a === "cup" ? [k] : [k, Math.round(toQty(p || {}, def) * 100) / 100]);
    } else {
      const key = "x_" + nameText.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
      if (seen.has(key)) return;
      seen.add(key);
      const cup = CUP_HINT.test(nameText) || (p && p.unit === "spoon");
      const u = p && p.unit === "kg" ? "g" : p && p.unit === "l" ? "ml" : p && ["g", "ml", "tin", "clove", "slice", "bag"].includes(p.unit) ? p.unit : "x";
      const q = p && p.q != null ? (p.unit === "kg" || p.unit === "l" ? p.q * 1000 : p.q) : 1;
      newIng[key] = cup ? { n: nameText.slice(0, 60), a: "cup" } : { n: nameText.slice(0, 60), a: "veg", u };
      ing.push(cup ? [key] : [key, q]);
    }
  });

  // Method: numbered lines start a new step; other lines continue the current one.
  const steps = [];
  const numbered = methodLines.some((l) => /^\s*\d{1,2}[.)]?\s+[A-Za-z]/.test(l));
  methodLines.forEach((line) => {
    if (ING_HEAD.test(line) || parseIngLine(line) && line.split(" ").length < 6) return;
    const m = line.match(/^\s*(\d{1,2})[.)]?\s+(.*)$/);
    if (m && +m[1] <= 12 && m[2].length > 3) steps.push(m[2]);
    else if (steps.length && (numbered || !/[.!]$/.test(steps[steps.length - 1]))) steps[steps.length - 1] += " " + line;
    else if (line.split(" ").length >= 5) steps.push(line);
  });
  const tidy = steps.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 8).slice(0, 10);

  const pool = name + " " + ing.map(([k]) => (ING[k] || newIng[k] || {}).n || "").join(" ");
  const prot = (PROTEIN_WORDS.find(([, re]) => re.test(pool)) || ["veg"])[0];

  if (!name && !ing.length && !tidy.length) return null;
  return {
    name: name || "Scanned meal",
    kcal: kcalM ? Math.min(1200, Math.max(100, +kcalM[1])) : 450,
    mins: minsM ? Math.min(300, Math.max(5, +minsM[1])) : 30,
    simple: 1,
    p: prot,
    ing,
    steps: tidy.length ? tidy : ["Check the card and add the method here."],
    _newIng: newIng,
  };
}
