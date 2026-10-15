// Free recipe reading on the phone itself, used when the Claude helper isn't set up.
// Tesseract reads the text from the photos (the reading files download once from a
// public CDN, then the browser caches them), and parseRecipe turns that text into a
// draft meal for the "Check the scanned meal" form. Nothing is sent to a paid service.

let workerP = null;
let progressCb = null;

function getWorker() {
  if (!workerP) {
    workerP = import("tesseract.js")
      .then((mod) => (mod.createWorker || (mod.default && mod.default.createWorker))("eng", 1, {
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

// Draws the photo turned by `angle` degrees, no bigger than `max` pixels, in greyscale with the
// contrast stretched so printed text stands out from coloured panels. With `adaptive` it also
// evens out glare and shadow by comparing each pixel with its own neighbourhood.
async function prep(blob, angle, max, adaptive) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const bw = Math.round(bmp.width * s), bh = Math.round(bmp.height * s);
  const rad = (angle * Math.PI) / 180, cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const c = document.createElement("canvas");
  c.width = Math.round(bw * cos + bh * sin); c.height = Math.round(bw * sin + bh * cos);
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2);
  g.rotate(rad);
  g.drawImage(bmp, -bw / 2, -bh / 2, bw, bh);
  const W = c.width, H = c.height;
  const im = g.getImageData(0, 0, W, H), d = im.data, n = W * H;
  const y = new Uint8ClampedArray(n), hist = new Uint32Array(256);
  for (let i = 0, j = 0; j < n; i += 4, j++) { y[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; hist[y[j]]++; }
  let lo = 0, hi = 255, acc = 0;
  while (lo < 254 && (acc += hist[lo]) < n * 0.02) lo++;
  acc = 0; while (hi > lo + 1 && (acc += hist[hi]) < n * 0.02) hi--;
  const k = 255 / Math.max(1, hi - lo);
  for (let j = 0; j < n; j++) y[j] = (y[j] - lo) * k;
  if (adaptive) {
    // Bradley thresholding with an integral image: dark compared with the local average = ink.
    const ii = new Uint32Array((W + 1) * (H + 1));
    for (let r = 1; r <= H; r++) { let row = 0; for (let x = 1; x <= W; x++) { row += y[(r - 1) * W + x - 1]; ii[r * (W + 1) + x] = ii[(r - 1) * (W + 1) + x] + row; } }
    const half = Math.max(8, Math.round(Math.max(W, H) / 32));
    for (let r = 0; r < H; r++) {
      const y0 = Math.max(0, r - half), y1 = Math.min(H, r + half + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(W, x + half + 1);
        const sum = ii[y1 * (W + 1) + x1] - ii[y0 * (W + 1) + x1] - ii[y1 * (W + 1) + x0] + ii[y0 * (W + 1) + x0];
        y[r * W + x] = y[r * W + x] * (x1 - x0) * (y1 - y0) < sum * 0.85 ? 0 : 255;
      }
    }
  }
  for (let i = 0, j = 0; j < n; i += 4, j++) d[i] = d[i + 1] = d[i + 2] = y[j];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(im, 0, 0);
  return c;
}

// A word worth keeping: read confidently and shaped like a real word, number or amount.
const NUMISH = /^[(]?\d+([.,/]\d+)?\s?(g|kg|ml|l|x|tbsp|tsp|mins?|kcal|p|cartons?|sachets?|tins?|cans?|packs?|pots?|cloves?|bags?)?[)]?[,.]?$/i;
const AMOUNT_WORD = /^(g|kg|ml|l|x|tbsp|tsp|cartons?|tins?|cans?|sachets?|packs?|pots?|cloves?|bags?|pcs?|[½¼¾⅓⅔])$/i;
const tidyWord = (t) => (t || "").replace(/[*†‡™®©•·"“”«»_|~^]+/g, "").replace(/^[^A-Za-z0-9(½¼¾⅓⅔&-]+|[^A-Za-z0-9)%.,!?:;'’&]+$/g, "").trim();
function goodWord(w) {
  const t = tidyWord(w.text);
  if (!t) return false;
  if (NUMISH.test(t) || AMOUNT_WORD.test(t) || /^[&-]$/.test(t)) return w.confidence >= 45;
  if (w.confidence < 55) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < t.replace(/[.,:;!?()'’%-]/g, "").length - 1) return false; // stray symbols mixed in
  if (letters.length === 1) return /^[aAI]$/.test(letters);
  if (letters.length <= 3 && w.confidence < 70) return false;
  return /[aeiouy]/i.test(letters) && !/[bcdfghjklmnpqrstvwxz]{5,}/i.test(letters);
}
const isAmount = (t) => NUMISH.test(t) || AMOUNT_WORD.test(t);

// Turns pasted text (for example copied with Live Text) into the same shape readImages returns.
export function textToPages(text) {
  return [String(text || "").split(/\r?\n/).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).map((t, i) => ({ text: t, h: i === 0 ? 1 : 0, conf: 100 }))];
}

// Splits Tesseract's lines into segments wherever there's a wide gap (so two columns don't
// run together), and sorts them into text segments and amount-only segments (like "2  3  4"
// or "120g"), keeping their positions so amounts can be put back on the right ingredient row.
function segments(data, W) {
  const named = [], amounts = [];
  (data.blocks || []).forEach((b) => (b.paragraphs || []).forEach((p) => (p.lines || []).forEach((l) => {
    const ws = (l.words || []).filter((w) => w.bbox && tidyWord(w.text)).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (!ws.length) return;
    const hs = ws.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b), h = hs[hs.length >> 1] || 10;
    const groups = [];
    ws.forEach((w, i) => {
      if (!i || w.bbox.x0 - ws[i - 1].bbox.x1 > Math.max(h * 2.2, W * 0.035)) groups.push([]);
      groups[groups.length - 1].push(w);
    });
    groups.forEach((grp) => {
      const good = grp.filter(goodWord);
      if (!good.length || good.length < grp.length * 0.5) return;
      // within a text segment, trailing amounts still get their own positions
      let cut = good.length;
      while (cut > 0 && isAmount(tidyWord(good[cut - 1].text))) cut--;
      const yc = (w) => (w.bbox.y0 + w.bbox.y1) / 2;
      good.slice(cut).forEach((w) => amounts.push({ text: tidyWord(w.text), x0: w.bbox.x0, y: yc(w), h }));
      const words = good.slice(0, cut);
      if (!words.length) return;
      const text = words.map((w) => tidyWord(w.text)).join(" ");
      if (!/[A-Za-z]{3}/.test(text)) return;
      named.push({ text, x0: words[0].bbox.x0, x1: words[words.length - 1].bbox.x1, y: yc(words[0]), y0: Math.min(...words.map((w) => w.bbox.y0)), h, amts: [] });
    });
  })));
  return { named, amounts };
}

// Puts amounts (from any of the reads of this photo) back on the text to their left in the
// same row, then reads column by column, top to bottom.
function assemble(named, amountLists, W) {
  amountLists.flat().forEach((a) => {
    const row = named.filter((t) => t.x1 < a.x0 + 5 && Math.abs(t.y - a.y) < Math.max(t.h, a.h) * 0.9);
    if (!row.length) return;
    // a number sitting just before a line of text is a step number, not an amount
    if (named.some((u) => u.x0 > a.x0 && u.x0 - a.x0 < a.h * 4 && Math.abs(u.y - a.y) < a.h)) return;
    const t = row.sort((p, q) => q.x1 - p.x1)[0];
    if (a.x0 - t.x1 > W * 0.5) return;
    if (t.amts.some((b) => Math.abs(b.x0 - a.x0) < a.h * 0.8)) return; // already have this one
    t.amts.push(a);
  });
  const xs = named.map((s) => s.x0).sort((a, b) => a - b), cuts = [];
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > W * 0.12) cuts.push((xs[i] + xs[i - 1]) / 2);
  const col = (s) => cuts.filter((c) => s.x0 > c).length;
  return named
    .slice()
    .sort((a, b) => col(a) - col(b) || a.y0 - b.y0)
    .map((s) => ({ text: [s.text].concat(s.amts.sort((a, b) => a.x0 - b.x0).map((a) => a.text)).join(" "), h: s.h, conf: 80 }));
}

// How far the text lines slope, in degrees, from the baselines of the longer lines.
function skewOf(data, W) {
  const sl = [];
  (data.blocks || []).forEach((b) => (b.paragraphs || []).forEach((p) => (p.lines || []).forEach((l) => {
    const bl = l.baseline;
    if (bl && bl.has_baseline !== false && bl.x1 - bl.x0 > W * 0.12 && l.confidence > 50) sl.push((bl.y1 - bl.y0) / (bl.x1 - bl.x0));
  })));
  if (sl.length < 3) return 0;
  sl.sort((a, b) => a - b);
  const deg = (Math.atan(sl[sl.length >> 1]) * 180) / Math.PI;
  return Math.abs(deg) < 0.4 || Math.abs(deg) > 15 ? 0 : deg;
}

const score = (lines) => lines.reduce((t, l) => t + (l.text.match(/[A-Za-z]{3,}/g) || []).length, 0);

// Reads each image and returns its lines with their height on the page,
// so the biggest text (usually the meal name) can be picked out.
export async function readImages(images, onProgress) {
  progressCb = null;
  const worker = await getWorker();
  const say = (t) => onProgress && onProgress(t, 0);
  const read = async (canvas, psm) => {
    await worker.setParameters({ tessedit_pageseg_mode: psm, user_defined_dpi: "300", preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const seg = segments(data, canvas.width);
    seg.lines = assemble(seg.named.map((t) => ({ ...t, amts: [] })), [seg.amounts], canvas.width);
    seg.skew = skewOf(data, canvas.width);
    seg.W = canvas.width;
    return seg;
  };
  const pages = [];
  for (let i = 0; i < images.length; i++) {
    const of = images.length > 1 ? " " + (i + 1) + " of " + images.length : "";
    let angle = 0, skew = 0, best = null;
    try {
      // Which way up? Try a quick small read at each turn unless the photo already reads well.
      say("checking which way up photo" + of + " is");
      const tries = [];
      for (const a of [0, 90, 270, 180]) {
        const seg = await read(await prep(images[i], a, 1300, false), "3");
        tries.push([score(seg.lines), a, seg.skew]);
        if (a === 0 && score(seg.lines) >= 25) break;
      }
      tries.sort((x, y) => y[0] - x[0]);
      angle = tries[0][1];
      skew = tries[0][2] || 0; // straighten a tilted card so each row of the ingredients table lines up
      // Full-size read, plain and with glare/shadow evening, using two layout modes; keep the best.
      // Normal reads for the words; the sparse-text read also catches lone numbers in tables.
      const passes = [[false, "3"], [true, "3"], [false, "11"]], reads = [];
      for (let n = 0; n < passes.length; n++) {
        say("reading photo" + of + " (step " + (n + 1) + " of 3)");
        reads.push(await read(await prep(images[i], angle - skew, 2600, passes[n][0]), passes[n][1]));
      }
      const text = reads.slice(0, 2).sort((a, b) => score(b.lines) - score(a.lines))[0];
      best = assemble(text.named, reads.map((r) => r.amounts), text.W);
    } catch (e) {
      if (!best) { try { best = (await read(images[i], "3")).lines; } catch (e2) { best = []; } }
    }
    pages.push(best || []);
  }
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
  if (/\d\s?g\b/i.test(line)) line = line.replace(/\b(\d{1,3}[05])9\b/g, "$1g");
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
  const allMins = [...text.matchAll(/(\d{1,3})\s*(?:mins?|minutes)\b/gi)].map((m) => +m[1]).filter((n) => n >= 5 && n <= 240);
  const minsM = allMins.length ? [null, Math.max(...allMins)] : null;

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
    else if (steps.length && (numbered || !(/^[A-Z]/.test(line) && /[.,;!]$/.test(steps[steps.length - 1])))) steps[steps.length - 1] += " " + line;
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
