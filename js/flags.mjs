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

const timeEl = document.querySelector("#time");
const scoreEl = document.querySelector("#score");
const totalEl = document.querySelector("#total");
const form = document.querySelector("#guess-form");
const input = document.querySelector("#guess");
const submitBtn = document.querySelector("#guess-btn");
const skipBtn = document.querySelector("#skip-btn");
const feedback = document.querySelector("#feedback");
const intro = document.querySelector("#intro");
const startBtn = document.querySelector("#start-btn");
const results = document.querySelector("#results");
const resultsBody = document.querySelector("#results-body");
const endBtn = document.querySelector("#end-btn");
const resultsBtn = document.querySelector("#results-btn");
const reviewBtn = document.querySelector("#review-btn");
const againBtn = document.querySelector("#again-btn");
const flagImg = document.querySelector("#flag-img");
const flagStatus = document.querySelector("#flag-status");

let data = null;
let codes = null;
let matcher = null;
let byId = new Map();
let queue = [];
let index = 0;
let found = new Set();
let state = "loading";
let endsAt = 0;
let timer = 0;
let endArmed = false;
let autoTimer = 0;
let advancing = false;

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000 - 1e-6));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
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

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function current() {
  return byId.get(queue[index]);
}

function renderScore() {
  scoreEl.textContent = String(found.size);
  const left = queue.length;
  flagStatus.textContent =
    state === "ended" && left === 0
      ? "Every flag named."
      : left === 1
        ? "1 flag left"
        : `${left} flags left`;
  document.title =
    state === "playing"
      ? `${found.size}/${data.countries.length} · Fifteen Minutes`
      : "Fifteen Minutes — Name every flag";
}

function showFlag() {
  const country = current();
  if (!country) {
    flagImg.removeAttribute("src");
    return;
  }
  flagImg.src = `flags/${codes[country.id]}.svg`;
  flagImg.alt = "Country flag";
  renderScore();
}

function clearAutoAccept() {
  clearTimeout(autoTimer);
  autoTimer = 0;
}

function accept(country) {
  found.add(country.id);
  queue.splice(index, 1);
  if (index >= queue.length) index = 0;
  scoreEl.classList.remove("bump");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("bump");
  setFeedback(`Yes — ${country.name}`, "ok");
  renderScore();
  if (queue.length === 0) {
    finish("complete");
    return;
  }
  advancing = true;
  input.disabled = true;
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  setTimeout(() => {
    advancing = false;
    if (state !== "playing") return;
    input.disabled = false;
    submitBtn.disabled = false;
    skipBtn.disabled = false;
    input.value = "";
    setFeedback("", "");
    showFlag();
    input.focus();
  }, 450);
}

function tryAutoAccept() {
  if (state !== "playing" || advancing) return;
  const raw = input.value;
  const id = matcher.exactId(raw);
  if (!id || id !== current()?.id) return;
  const run = () => {
    if (state !== "playing" || advancing || input.value !== raw) return;
    if (current()?.id !== id) return;
    accept(byId.get(id));
    setTimeout(() => {
      if (input.value === raw) input.value = "";
    }, 0);
  };
  if (matcher.hasLongerName(raw)) {
    autoTimer = setTimeout(run, 500);
    return;
  }
  run();
}

function onGuess(raw) {
  if (state !== "playing" || advancing) return;
  const result = matcher(raw);
  if (result.status === "empty") return;
  if (result.status === "correct") {
    if (result.id === current().id) {
      accept(byId.get(result.id));
      input.value = "";
      return;
    }
    setFeedback(`That's ${byId.get(result.id).name}.`, "hint");
    return;
  }
  if (result.status === "ambiguous" || result.status === "hint") {
    setFeedback(result.message, "hint");
    return;
  }
  setFeedback("No match. Check the spelling.", "bad");
}

function skip() {
  if (state !== "playing" || advancing) return;
  clearAutoAccept();
  if (queue.length <= 1) {
    setFeedback("This is the last flag.", "hint");
    return;
  }
  const [id] = queue.splice(index, 1);
  queue.push(id);
  if (index >= queue.length) index = 0;
  input.value = "";
  setFeedback("Skipped for now.", "hint");
  showFlag();
  input.focus();
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
  clearAutoAccept();
  advancing = false;
  queue = shuffle(data.countries.map((country) => country.id));
  index = 0;
  endsAt = Date.now() + DURATION;
  intro.classList.add("hidden");
  results.classList.add("hidden");
  resultsBtn.classList.add("hidden");
  endBtn.disabled = false;
  endBtn.textContent = "End game";
  endArmed = false;
  input.disabled = false;
  submitBtn.disabled = false;
  skipBtn.disabled = false;
  input.value = "";
  setFeedback("", "");
  timeEl.classList.remove("urgent");
  timeEl.textContent = formatTime(DURATION);
  clearInterval(timer);
  timer = setInterval(tick, 200);
  showFlag();
  input.focus();
}

function finish(reason) {
  if (state === "ended") return;
  state = "ended";
  clearInterval(timer);
  clearAutoAccept();
  advancing = false;
  const left = Math.max(0, endsAt - Date.now());
  timeEl.textContent = formatTime(left);
  endBtn.disabled = true;
  input.disabled = true;
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  renderScore();

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
        <ul>${names
          .map(
            (country) =>
              `<li class="missed-flag"><img src="flags/${codes[country.id]}.svg" alt=""><span>${escapeHtml(country.name)}</span></li>`,
          )
          .join("")}</ul>
      </section>
    `;
  }).join("");

  resultsBody.innerHTML = `
    <p class="kicker">${perfect ? "Every flag" : "Time's up"}</p>
    <h2 id="results-heading">${perfect ? "Every flag" : "Final score"}</h2>
    <p class="final-score">${found.size} <span>/ ${total}</span></p>
    <p class="results-note">You named ${found.size} of ${total} flags ${timeNote}.</p>
    ${
      perfect
        ? `<p class="results-note">Nothing missed.</p>`
        : `<h3 class="missed-title">Flags you missed</h3><div class="missed-grid">${groups}</div>`
    }
  `;
  results.classList.remove("hidden");
  resultsBtn.classList.remove("hidden");
}

function resetToIntro() {
  state = "ready";
  found = new Set();
  queue = data.countries.map((country) => country.id);
  index = 0;
  clearInterval(timer);
  clearAutoAccept();
  advancing = false;
  endsAt = 0;
  results.classList.add("hidden");
  resultsBtn.classList.add("hidden");
  intro.classList.remove("hidden");
  endBtn.disabled = true;
  endBtn.textContent = "End game";
  input.disabled = true;
  submitBtn.disabled = true;
  skipBtn.disabled = true;
  input.value = "";
  setFeedback("", "");
  flagImg.removeAttribute("src");
  timeEl.textContent = "15:00";
  timeEl.classList.remove("urgent");
  renderScore();
}

function applyCopy(total) {
  document.title = "Fifteen Minutes — Name every flag";
  document.querySelector("#brand-kicker").textContent = "Flags";
  document.querySelector("#guess-label").textContent = "Country name";
  input.placeholder = "Name the country";
  document.querySelector("#intro-kicker").textContent = "One flag at a time";
  document.querySelector("#intro-heading").textContent = "Name the flag.";
  document.querySelector("#intro-copy").textContent =
    `You have 15 minutes to name all ${total} flags. A flag appears, and you name its country. A full name is accepted as soon as you finish typing it. Press Enter for anything else. Skip leaves that flag for later.`;
  reviewBtn.textContent = "Close";
}

async function main() {
  document.documentElement.classList.add("mode-flags");
  skipBtn.classList.remove("hidden");
  applyCopy(197);
  try {
    const [worldResponse, codeResponse] = await Promise.all([
      fetch("data/world.json"),
      fetch("data/flag-codes.json"),
    ]);
    if (!worldResponse.ok) throw new Error(`Map data failed (${worldResponse.status})`);
    if (!codeResponse.ok) throw new Error(`Flag data failed (${codeResponse.status})`);
    data = await worldResponse.json();
    codes = await codeResponse.json();
    for (const country of data.countries) {
      if (!codes[country.id]) throw new Error(`Missing flag for ${country.id}`);
    }
  } catch (error) {
    startBtn.disabled = true;
    document.querySelector("#intro-copy").textContent =
      "The flags didn't load. Serve this folder with a local web server and open the site from there.";
    console.error(error);
    return;
  }

  matcher = createMatcher(data.countries, data.territories);
  byId = new Map(data.countries.map((country) => [country.id, country]));
  queue = data.countries.map((country) => country.id);
  totalEl.textContent = String(data.countries.length);
  applyCopy(data.countries.length);
  renderScore();
  state = "ready";
  startBtn.disabled = false;

  startBtn.addEventListener("click", startGame);
  input.addEventListener("input", () => {
    clearAutoAccept();
    tryAutoAccept();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearAutoAccept();
    onGuess(input.value);
  });
  skipBtn.addEventListener("click", skip);
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
