const API = "https://api.harvardartmuseums.org";
const ROUNDS = 10;
const FIELDS = "id,title,people,dated,century,culture,classification,primaryimageurl,images,url";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Each mode says how to read the answer from a record and how to phrase the question.
const MODES = {
  artist: {
    prompt: "Who made this?",
    answer: (o) => {
      const name = o.people?.find((p) => p.role === "Artist")?.name;
      return name && !/unknown|unidentified|anonymous/i.test(name) ? name : null;
    },
    caption: (o) => [o.title, o.dated].filter(Boolean).join(", "),
  },
  century: {
    prompt: "When was this made?",
    answer: (o) => o.century || null,
    caption: (o) => o.title,
  },
  culture: {
    prompt: "Where is this from?",
    answer: (o) => o.culture || null,
    caption: (o) => o.title,
  },
};

// Blank out the answer (and each meaningful word of it) so titles like "Portrait of Jane Smith" don't give it away.
const PARTICLES = new Set(["van", "von", "der", "den", "del", "della", "des", "the", "and", "after", "attributed", "sir", "saint", "workshop", "circle", "school", "century", "younger", "elder", "jeune", "fils"]);
function redact(text, answer) {
  if (!text || !answer) return text || "";
  const words = answer.split(/[\s,.()]+/).filter((w) => w.length >= 3 && !PARTICLES.has(w.toLowerCase()));
  const parts = [answer, ...words].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![\\p{L}])(${parts.join("|")})(?![\\p{L}])`, "giu");
  return text.replace(re, "▇▇▇").replace(/(▇▇▇[\s,]*)+▇▇▇/g, "▇▇▇");
}

const game = { mode: null, items: [], pool: [], i: 0, score: 0, streak: 0, results: [] };

function getKey() {
  if (window.HAM_API_KEY) return window.HAM_API_KEY;
  try { return localStorage.getItem("ham_api_key") || ""; } catch { return ""; }
}

function askForKey() {
  return new Promise((resolve) => {
    $("key-form").onsubmit = () => {
      const key = $("key-input").value.trim();
      try { localStorage.setItem("ham_api_key", key); } catch {}
      resolve(key);
    };
    $("key-dialog").showModal();
  });
}

async function api(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set("apikey", getKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (res.status === 401) {
    try { localStorage.removeItem("ham_api_key"); } catch {}
    throw new Error("That API key was rejected. Reload the page to enter it again.");
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function fetchRandomWorks() {
  const data = await api("/object", { size: 100, sort: "random", hasimage: 1, fields: FIELDS });
  return data.records || [];
}

// Lowercase, strip accents and punctuation so "Nanteuil," matches "NANTEUIL".
const normalize = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Edit distance, so slightly misread text ("Nanteui1", "Nantevil") still counts as a match.
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Common short words in print captions ("par", "et", "de") that shouldn't be mistaken for initials.
const SHORT_WORDS = new Set(["a", "i", "o", "y", "e", "de", "du", "da", "di", "do", "des", "del", "dei", "et", "en", "la", "le", "les", "il", "lo", "un", "une", "au", "aux", "par", "pas", "ne", "ce", "ca", "sa", "se", "es", "est", "qui", "que", "the", "of", "and", "in", "on", "to", "by", "at", "an", "is", "it", "und", "von", "van", "der", "die", "das", "ex", "cum", "sc", "fec", "inv", "exc", "del", "pin", "imp", "no", "nr"]);

// Does a piece of recognized text contain any meaningful word of the answer, or the artist's initials?
function mentionsAnswer(text, answer) {
  const targets = answer.split(/[\s,.()]+/).filter((w) => w.length >= 3 && !PARTICLES.has(w.toLowerCase())).map(normalize).filter(Boolean);
  const initials = new Set(answer.split(/[\s,.()\-]+/).filter((w) => w && !PARTICLES.has(w.toLowerCase())).map((w) => normalize(w)[0]).filter(Boolean));
  // Monograms like "H.D." are read as short letter clusters ("hd", or misread as "bh"):
  // cover a 1-2 letter cluster with one of the artist's initials, or a 3-letter one with
  // at least two (so "DWR" counts but ordinary words like "has" don't).
  const short = text.split(/\s+/).map(normalize).filter((w) => /^\p{L}{1,3}$/u.test(w) && !SHORT_WORDS.has(w));
  if (short.some((w) => [...w].filter((c) => initials.has(c)).length >= (w.length === 3 ? 2 : 1))) return true;
  const words = text.split(/\s+/).map(normalize).filter((w) => w.length >= 3);
  return words.some((w) => targets.some((t) =>
    w === t || (t.length >= 5 && w.includes(t)) || (t.length >= 5 && Math.abs(w.length - t.length) <= 1 && editDistance(w, t) <= 1) ||
    // Handwritten signatures are often badly misread ("Castillo" -> "cailbe"), but usually
    // keep the first letters and a similar length.
    (t.length >= 5 && w.length >= 4 && w.slice(0, 2) === t.slice(0, 2) && Math.abs(w.length - t.length) <= 3 && editDistance(w, t) <= Math.ceil(t.length / 2))));
}

// The museum runs text recognition on its images. Use those results to cover only
// the lettering that names the answer (e.g. an engraver's credit), leaving the rest
// of the picture visible. Boxes are stored as percentages of the image so they scale with it.
async function fetchTextBoxes(o, answer) {
  const img = o.images?.find((i) => i.baseimageurl && o.primaryimageurl?.startsWith(i.baseimageurl)) || o.images?.[0];
  if (!img?.imageid || !img.width || !img.height) return [];
  try {
    const data = await api("/annotation", { q: `imageid:${img.imageid} AND type:text`, size: 100 });
    const hits = (data.records || []).flatMap((r) => {
      const m = /xywh=(\d+),(\d+),(\d+),(\d+)/.exec(r.selectors?.[0]?.value || "");
      if (!m || !r.body || !mentionsAnswer(r.body, answer)) return [];
      const [x, y, w, h] = m.slice(1).map(Number);
      const box = { left: (x / img.width) * 100, top: (y / img.height) * 100, width: (w / img.width) * 100, height: (h / img.height) * 100 };
      // Skip oversized regions (whole paragraphs or misreads of the picture itself).
      if (box.width * box.height > 600 || box.height > 12) return [];
      return [{ ...box, single: !/\s/.test(r.body.trim()) }];
    });
    // Prefer single-word boxes; fall back to whole lines only when no word box matched.
    const words = hits.filter((b) => b.single);
    return words.length ? words : hits;
  } catch {
    return [];
  }
}

function show(section) {
  for (const id of ["start", "play", "end"]) $(id).hidden = id !== section;
}

async function startGame(mode) {
  const m = MODES[mode];
  $("status").textContent = "Gathering works from the collection…";
  try {
    // Pull random works until there are enough usable ones and enough distinct answers for wrong choices.
    let usable = [];
    for (let tries = 0; tries < 4 && usable.length < ROUNDS + 10; tries++) {
      const batch = await fetchRandomWorks();
      usable.push(...batch.filter((o) => o.primaryimageurl && m.answer(o)));
    }
    const answers = [...new Set(usable.map(m.answer))];
    if (usable.length < ROUNDS || answers.length < 4) throw new Error("Couldn't find enough works for this round. Try again.");
    const items = shuffle(usable).slice(0, ROUNDS);
    await Promise.all(items.map(async (o) => { o.textBoxes = await fetchTextBoxes(o, m.answer(o)); }));
    for (const o of items) new Image().src = `${o.primaryimageurl}?width=900`; // preload
    Object.assign(game, { mode, i: 0, score: 0, streak: 0, results: [], items, pool: answers });
    $("status").textContent = "";
    show("play");
    renderQuestion();
  } catch (err) {
    $("status").textContent = err.message;
  }
}

function renderQuestion() {
  const m = MODES[game.mode];
  const o = game.items[game.i];
  const correct = m.answer(o);
  const wrong = shuffle(game.pool.filter((a) => a !== correct)).slice(0, 3);
  const choices = shuffle([correct, ...wrong]);

  $("round").textContent = `Work ${game.i + 1} of ${ROUNDS}`;
  $("score").textContent = `Score: ${game.score}`;
  $("streak").textContent = game.streak >= 2 ? `🔥 ${game.streak} in a row` : "";
  // Hide the frame until the new image loads so the last work (and its revealed lettering) doesn't linger.
  const frame = document.querySelector(".art-frame");
  frame.classList.add("loading");
  $("art-img").onload = $("art-img").onerror = () => frame.classList.remove("loading");
  $("art-img").src = `${o.primaryimageurl}?width=900`;
  $("art-masks").classList.remove("revealed");
  $("art-masks").innerHTML = o.textBoxes.map((b) =>
    `<span style="left:${b.left - 0.5}%;top:${b.top - 0.5}%;width:${b.width + 1}%;height:${b.height + 1}%"></span>`).join("");
  $("art-img").alt = redact(o.title, correct) || "Artwork";
  $("art-caption").textContent = redact(m.caption(o), correct);
  $("prompt").textContent = m.prompt;
  $("feedback").textContent = "";
  $("next-btn").hidden = true;
  $("choices").innerHTML = choices.map((c) => `<button class="choice" type="button">${esc(c)}</button>`).join("");
  for (const btn of $("choices").children) btn.onclick = () => answer(btn, correct, o);
}

function answer(btn, correct, o) {
  const right = btn.textContent === correct;
  for (const b of $("choices").children) {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add("correct");
  }
  if (right) {
    game.streak++;
    const points = 100 + Math.min(game.streak - 1, 4) * 25; // streak bonus caps at +100
    game.score += points;
    $("feedback").textContent = `Correct! +${points}`;
  } else {
    btn.classList.add("wrong");
    game.streak = 0;
    $("feedback").textContent = `Not quite — it's ${correct}.`;
  }
  // Reveal the full title now that the question is answered.
  $("art-caption").textContent = MODES[game.mode].caption(o) || "";
  $("art-img").alt = o.title || "Artwork";
  $("art-masks").classList.add("revealed");
  game.results.push({ o, right });
  $("score").textContent = `Score: ${game.score}`;
  $("streak").textContent = game.streak >= 2 ? `🔥 ${game.streak} in a row` : "";
  $("next-btn").textContent = game.i + 1 < ROUNDS ? "Next work →" : "See results →";
  $("next-btn").hidden = false;
  $("next-btn").focus();
}

function next() {
  game.i++;
  if (game.i < ROUNDS) return renderQuestion();
  const correct = game.results.filter((r) => r.right).length;
  const key = `ham_best_${game.mode}`;
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch {}
  const isBest = game.score > best;
  if (isBest) { try { localStorage.setItem(key, game.score); } catch {} }

  $("final-score").textContent = `${game.score} points · ${correct}/${ROUNDS} correct`;
  $("final-msg").textContent = (isBest ? "New personal best! " : `Your best: ${best}. `) +
    (correct >= 8 ? "You could give the gallery tours." : correct >= 5 ? "A solid eye for art." : "Every visit teaches something new.");
  $("recap").innerHTML = game.results.map(({ o, right }) => `
    <a href="${esc(o.url)}" target="_blank" rel="noopener" title="${esc(o.title)}">
      <img src="${esc(o.primaryimageurl)}?width=240" alt="${esc(o.title)}" loading="lazy">
      <span class="mark ${right ? "ok" : "no"}">${right ? "✓" : "✗"}</span>
    </a>`).join("");
  show("end");
}

for (const btn of document.querySelectorAll(".mode")) btn.onclick = () => startGame(btn.dataset.mode);
$("next-btn").onclick = next;
$("again").onclick = () => show("start");

(async function init() {
  if (!getKey()) await askForKey();
})();
