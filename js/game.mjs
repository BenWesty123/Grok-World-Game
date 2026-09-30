import { createMatcher } from "./match.mjs";

const CONTINENTS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania",
];

const DURATION = 15 * 60 * 1000;
const SVG_NS = "http://www.w3.org/2000/svg";

const svg = document.querySelector("#map");
const world = document.querySelector("#world");
const timeEl = document.querySelector("#time");
const scoreEl = document.querySelector("#score");
const totalEl = document.querySelector("#total");
const form = document.querySelector("#guess-form");
const input = document.querySelector("#guess");
const submitBtn = document.querySelector("#guess-btn");
const feedback = document.querySelector("#feedback");
const board = document.querySelector("#board");
const intro = document.querySelector("#intro");
const startBtn = document.querySelector("#start-btn");
const results = document.querySelector("#results");
const resultsBody = document.querySelector("#results-body");
const endBtn = document.querySelector("#end-btn");
const resultsBtn = document.querySelector("#results-btn");
const legendMiss = document.querySelector("#legend-miss");
const reviewBtn = document.querySelector("#review-btn");
const againBtn = document.querySelector("#again-btn");

let data = null;
let matcher = null;
let byId = new Map();
let found = new Set();
let state = "loading";
let endsAt = 0;
let timer = 0;
let view = { x: 0, y: 0, k: 1 };
let minK = 0.05;
let maxK = 160;
let endArmed = false;
let cullFrame = 0;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000 - 1e-6));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function setFeedback(text, kind) {
  feedback.textContent = text;
  feedback.className = kind ? `feedback ${kind}` : "feedback";
  if (kind === "bad" || kind === "hint") {
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
  }
}

function applyView() {
  if (!data) return;
  world.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`);
  const inverse = 1 / view.k;
  for (const country of data.countries) {
    country.pin.setAttribute(
      "transform",
      `translate(${country.label[0]} ${country.label[1]}) scale(${inverse})`,
    );
  }
  scheduleCull();
}

function clampView() {
  if (!data) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const mapW = data.width * view.k;
  const mapH = data.height * view.k;
  const margin = 36;
  if (mapW <= rect.width - margin) {
    view.x = (rect.width - mapW) / 2;
  } else {
    view.x = Math.min(margin, Math.max(rect.width - mapW - margin, view.x));
  }
  if (mapH <= rect.height - margin) {
    view.y = (rect.height - mapH) / 2;
  } else {
    view.y = Math.min(margin, Math.max(rect.height - mapH - margin, view.y));
  }
}

function fit() {
  const rect = svg.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) {
    requestAnimationFrame(fit);
    return;
  }
  const k = Math.min(rect.width / data.width, rect.height / data.height) * 0.98;
  view.k = k || 0.2;
  minK = view.k * 0.9;
  maxK = Math.max(150, view.k * 500);
  view.x = (rect.width - data.width * view.k) / 2;
  view.y = (rect.height - data.height * view.k) / 2;
  applyView();
}

function zoomAt(px, py, factor) {
  if (!data) return;
  const next = Math.min(maxK, Math.max(minK, view.k * factor));
  const scale = next / view.k;
  view.x = px - (px - view.x) * scale;
  view.y = py - (py - view.y) * scale;
  view.k = next;
  clampView();
  applyView();
}

function zoomCenter(factor) {
  const rect = svg.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, factor);
}

function scheduleCull() {
  cancelAnimationFrame(cullFrame);
  cullFrame = requestAnimationFrame(cullLabels);
}

function cullLabels() {
  const order = [...data.countries].sort((a, b) => {
    const aNamed = found.has(a.id) || state === "ended" ? 1 : 0;
    const bNamed = found.has(b.id) || state === "ended" ? 1 : 0;
    return bNamed - aNamed || b.area - a.area;
  });
  const shown = [];
  for (const country of order) {
    const rect = country.text.getBoundingClientRect();
    const box = {
      l: rect.left - 2,
      t: rect.top - 1,
      r: rect.right + 2,
      b: rect.bottom + 1,
    };
    const overlaps = shown.some(
      (other) => !(other.r < box.l || other.l > box.r || other.b < box.t || other.t > box.b),
    );
    country.text.classList.toggle("culled", overlaps);
    country.dot.classList.toggle("culled", !overlaps);
    if (!overlaps && rect.width > 0) shown.push(box);
  }
}

function syncCountry(country) {
  const named = found.has(country.id) || state === "ended";
  country.text.textContent = named ? country.short : "?";
  country.text.classList.toggle("q", !named);
  country.pin.classList.toggle("found", found.has(country.id));
  country.pin.classList.toggle("missed", state === "ended" && !found.has(country.id));
  country.path.classList.toggle("found", found.has(country.id));
  country.path.classList.toggle("missed", state === "ended" && !found.has(country.id));
  country.path.classList.remove("just-found");
  const cell = country.cell;
  cell.classList.toggle("found", found.has(country.id));
  cell.textContent = found.has(country.id) ? country.name : "";
}

function renderCounts() {
  for (const continent of CONTINENTS) {
    const countries = data.countries.filter((country) => country.continent === continent);
    const got = countries.filter((country) => found.has(country.id)).length;
    const slug = continent.toLowerCase().replace(/\s+/g, "-");
    document.querySelector(`#count-${slug}`).textContent = `${got} / ${countries.length}`;
  }
  scoreEl.textContent = String(found.size);
  document.title =
    state === "playing"
      ? `${found.size}/${data.countries.length} · Fifteen Minutes`
      : "Fifteen Minutes — Name every country";
}

function buildMap() {
  const defs = el("defs");
  const gradient = el("radialGradient", { id: "sea", cx: "50%", cy: "42%", r: "78%" });
  gradient.append(
    el("stop", { offset: "0%", "stop-color": "#e7f5fb" }),
    el("stop", { offset: "58%", "stop-color": "#a9d3e3" }),
    el("stop", { offset: "100%", "stop-color": "#7eafc4" }),
  );
  defs.append(gradient);
  svg.prepend(defs);

  const ocean = el("rect", {
    class: "ocean",
    x: -40,
    y: -40,
    width: data.width + 80,
    height: data.height + 80,
    fill: "url(#sea)",
  });
  const grat = el("g", { class: "graticule" });
  for (const d of data.graticule) grat.append(el("path", { d }));
  const lands = el("g", { class: "lands" });
  for (const d of data.other) lands.append(el("path", { class: "other", d }));
  const pins = el("g", { class: "pins" });

  for (const country of data.countries) {
    const path = el("path", { class: "country", d: country.d, "data-id": country.id });
    lands.append(path);
    const pin = el("g", { class: "pin" });
    const dot = el("circle", { class: "dot", r: "2.7" });
    const text = el("text", { class: "q", "text-anchor": "middle", "dominant-baseline": "central" });
    text.textContent = "?";
    pin.append(dot, text);
    pins.append(pin);
    country.path = path;
    country.pin = pin;
    country.dot = dot;
    country.text = text;
  }

  world.append(ocean, grat, lands, pins);
}

function buildBoard() {
  for (const continent of CONTINENTS) {
    const countries = data.countries
      .filter((country) => country.continent === continent)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    const section = document.createElement("section");
    section.className = "continent";
    section.innerHTML = `
      <header>
        <h3>${continent}</h3>
        <span class="count" id="count-${continent.toLowerCase().replace(/\s+/g, "-")}">0 / ${countries.length}</span>
      </header>
      <div class="cells"></div>
    `;
    const cells = section.querySelector(".cells");
    for (const country of countries) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.id = country.id;
      cells.append(cell);
      country.cell = cell;
    }
    board.append(section);
  }
}

function accept(country) {
  found.add(country.id);
  syncCountry(country);
  country.path.classList.add("just-found");
  renderCounts();
  scoreEl.classList.remove("bump");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("bump");
  setFeedback(`Yes — ${country.name}`, "ok");
  scheduleCull();
  if (found.size === data.countries.length) finish("complete");
}

function onGuess(raw) {
  if (state !== "playing") return;
  const result = matcher(raw);
  if (result.status === "empty") return;
  if (result.status === "correct") {
    const country = byId.get(result.id);
    if (found.has(country.id)) {
      setFeedback(`${country.name} is already on the map.`, "hint");
      return;
    }
    accept(country);
    input.value = "";
    return;
  }
  if (result.status === "ambiguous" || result.status === "hint") {
    setFeedback(result.message, "hint");
    return;
  }
  setFeedback("No match. Check the spelling.", "bad");
}

function tick() {
  const left = Math.max(0, endsAt - Date.now());
  timeEl.textContent = formatTime(left);
  timeEl.classList.toggle("urgent", left <= 60_000);
  if (left <= 0) finish("time");
}

function startGame() {
  state = "playing";
  found = new Set();
  endsAt = Date.now() + DURATION;
  intro.classList.add("hidden");
  results.classList.add("hidden");
  resultsBtn.classList.add("hidden");
  legendMiss.classList.add("hidden");
  endBtn.disabled = false;
  endBtn.textContent = "End game";
  endArmed = false;
  input.disabled = false;
  submitBtn.disabled = false;
  input.value = "";
  setFeedback("", "");
  for (const country of data.countries) syncCountry(country);
  renderCounts();
  timeEl.classList.remove("urgent");
  timeEl.textContent = formatTime(DURATION);
  clearInterval(timer);
  timer = setInterval(tick, 200);
  input.focus();
  scheduleCull();
}

function finish(reason) {
  if (state === "ended") return;
  state = "ended";
  clearInterval(timer);
  const left = Math.max(0, endsAt - Date.now());
  timeEl.textContent = formatTime(left);
  endBtn.disabled = true;
  input.disabled = true;
  submitBtn.disabled = true;
  legendMiss.classList.remove("hidden");
  for (const country of data.countries) syncCountry(country);
  renderCounts();
  scheduleCull();

  const total = data.countries.length;
  const missed = data.countries
    .filter((country) => !found.has(country.id))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const perfect = missed.length === 0;
  const timeNote = perfect
    ? `with ${formatTime(left)} remaining`
    : reason === "time"
      ? "when the clock hit zero"
      : `with ${formatTime(left)} left on the clock`;

  const groups = CONTINENTS.map((continent) => {
    const names = missed.filter((country) => country.continent === continent);
    if (!names.length) return "";
    return `
      <section>
        <h3>${continent}</h3>
        <ul>${names.map((country) => `<li>${country.name}</li>`).join("")}</ul>
      </section>
    `;
  }).join("");

  resultsBody.innerHTML = `
    <p class="kicker">${perfect ? "Clear atlas" : "Time's up"}</p>
    <h2 id="results-heading">${perfect ? "Every country" : "Final score"}</h2>
    <p class="final-score">${found.size} <span>/ ${total}</span></p>
    <p class="results-note">You named ${found.size} of ${total} countries ${timeNote}.</p>
    ${
      perfect
        ? `<p class="results-note">Nothing missed.</p>`
        : `<h3 class="missed-title">Countries you missed</h3><div class="missed-grid">${groups}</div>`
    }
  `;
  results.classList.remove("hidden");
  resultsBtn.classList.remove("hidden");
}

function resetToIntro() {
  state = "ready";
  found = new Set();
  clearInterval(timer);
  endsAt = 0;
  results.classList.add("hidden");
  resultsBtn.classList.add("hidden");
  legendMiss.classList.add("hidden");
  intro.classList.remove("hidden");
  endBtn.disabled = true;
  endBtn.textContent = "End game";
  input.disabled = true;
  submitBtn.disabled = true;
  input.value = "";
  setFeedback("", "");
  timeEl.textContent = "15:00";
  timeEl.classList.remove("urgent");
  for (const country of data.countries) syncCountry(country);
  renderCounts();
  fit();
}

function wireMap() {
  const pointers = new Map();
  let drag = null;
  let pinch = null;

  svg.addEventListener("pointerdown", (event) => {
    svg.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y };
      pinch = null;
      svg.classList.add("dragging");
    } else if (pointers.size === 2) {
      drag = null;
      const pts = [...pointers.values()];
      pinch = {
        dist: Math.max(12, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
        k: view.k,
      };
    }
  });

  svg.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinch) {
      const pts = [...pointers.values()];
      const dist = Math.max(12, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const rect = svg.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      const target = pinch.k * (dist / pinch.dist);
      const factor = target / view.k;
      if (Number.isFinite(factor) && factor > 0) zoomAt(midX, midY, factor);
      return;
    }
    if (!drag) return;
    view.x = drag.ox + (event.clientX - drag.x);
    view.y = drag.oy + (event.clientY - drag.y);
    clampView();
    applyView();
  });

  function release(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      drag = null;
      svg.classList.remove("dragging");
    }
  }
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  svg.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= rect.height;
      const factor = Math.exp(-delta * 0.0014);
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
    },
    { passive: false },
  );

  svg.addEventListener("dblclick", (event) => {
    const rect = svg.getBoundingClientRect();
    zoomAt(event.clientX - rect.left, event.clientY - rect.top, 1.8);
  });

  document.querySelector("#zoom-in").addEventListener("click", () => zoomCenter(1.35));
  document.querySelector("#zoom-out").addEventListener("click", () => zoomCenter(1 / 1.35));
  document.querySelector("#zoom-reset").addEventListener("click", fit);
  window.addEventListener("resize", () => {
    clampView();
    applyView();
  });
}

async function main() {
  wireMap();
  try {
    const response = await fetch("data/world.json");
    if (!response.ok) throw new Error(`Map data failed (${response.status})`);
    data = await response.json();
  } catch (error) {
    startBtn.disabled = true;
    document.querySelector("#intro-copy").textContent =
      "The map data didn't load. Serve this folder with a local web server and open the site from there.";
    console.error(error);
    return;
  }

  matcher = createMatcher(data.countries, data.territories);
  byId = new Map(data.countries.map((country) => [country.id, country]));
  totalEl.textContent = String(data.countries.length);
  document.querySelector("#intro-total").textContent = String(data.countries.length);
  buildMap();
  buildBoard();
  renderCounts();
  requestAnimationFrame(fit);
  document.fonts?.ready.then(() => scheduleCull());
  state = "ready";
  startBtn.disabled = false;

  startBtn.addEventListener("click", startGame);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onGuess(input.value);
  });
  endBtn.addEventListener("click", () => {
    if (state !== "playing") return;
    if (!endArmed) {
      endArmed = true;
      endBtn.textContent = "End now?";
      setTimeout(() => {
        if (endArmed && state === "playing") {
          endArmed = false;
          endBtn.textContent = "End game";
        }
      }, 2400);
      return;
    }
    finish("giveup");
  });
  reviewBtn.addEventListener("click", () => results.classList.add("hidden"));
  resultsBtn.addEventListener("click", () => results.classList.remove("hidden"));
  againBtn.addEventListener("click", resetToIntro);
}

main();
