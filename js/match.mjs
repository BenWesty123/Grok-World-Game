/** Normalize a typed country name for comparison. */
export function normalize(raw) {
  let s = String(raw ?? "").normalize("NFD").replace(/\p{M}/gu, "");
  s = s.replace(/[’']/g, "");
  s = s.replace(/&/g, " and ");
  s = s.toLowerCase();
  s = s.replace(/\./g, "");
  s = s.replace(/[^a-z0-9]+/g, " ");
  s = s.trim().replace(/\s+/g, " ");
  s = s.replace(/^the /, "");
  return s;
}

function expandKeys(raw) {
  const n = normalize(raw);
  if (!n) return [];
  const keys = new Set([n]);
  const queue = [n];
  while (queue.length) {
    const key = queue.pop();
    const variants = [];
    if (key.includes(" the ")) variants.push(key.replace(/ the /g, " "));
    if (key.includes("saint ")) variants.push(key.replaceAll("saint ", "st "));
    for (const variant of variants) {
      if (variant && !keys.has(variant)) {
        keys.add(variant);
        queue.push(variant);
      }
    }
  }
  return [...keys];
}

const AMBIGUOUS = new Map([
  ["congo", "There are two Congos. Name the republic, or DR Congo."],
  ["korea", "Name North Korea or South Korea."],
]);

function levenshtein(a, b, limit) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Build a guess function for the quiz set.
 * Countries win over territory hints when a string matches both.
 */
export function createMatcher(countries, territories = []) {
  const exact = new Map();
  const entries = [];

  function add(key, id) {
    if (!key) return;
    const existing = exact.get(key);
    if (existing && existing !== id) {
      throw new Error(`Alias clash "${key}" between ${existing} and ${id}`);
    }
    exact.set(key, id);
  }

  for (const country of countries) {
    const keys = new Set();
    for (const raw of [country.name, ...(country.aliases || [])]) {
      for (const key of expandKeys(raw)) keys.add(key);
    }
    for (const key of keys) add(key, country.id);
    entries.push({ id: country.id, keys: [...keys] });
  }

  const hints = new Map();
  for (const territory of territories) {
    for (const raw of [territory.name, ...(territory.aliases || [])]) {
      for (const key of expandKeys(raw)) {
        if (exact.has(key) || hints.has(key)) continue;
        hints.set(key, territory.note);
      }
    }
  }

  return function guess(raw) {
    const key = normalize(raw);
    if (!key || key.length < 2) return { status: "empty" };
    if (exact.has(key)) return { status: "correct", id: exact.get(key) };
    if (AMBIGUOUS.has(key)) {
      return { status: "ambiguous", message: AMBIGUOUS.get(key) };
    }
    if (hints.has(key)) return { status: "hint", message: hints.get(key) };

    if (key.length >= 5) {
      const hits = new Set();
      for (const entry of entries) {
        if (entry.keys.some((candidate) => candidate.startsWith(key))) hits.add(entry.id);
      }
      if (hits.size === 1) return { status: "correct", id: [...hits][0] };
      if (hits.size > 1) return { status: "ambiguous", message: "Be more specific." };
    }

    if (key.length >= 6) {
      const limit = key.length >= 8 ? 2 : 1;
      const scored = [];
      for (const entry of entries) {
        let best = limit + 1;
        for (const candidate of entry.keys) {
          const distance = levenshtein(key, candidate, limit);
          if (distance < best) best = distance;
        }
        if (best <= limit) scored.push({ id: entry.id, d: best });
      }
      scored.sort((a, b) => a.d - b.d);
      if (scored.length && (scored.length === 1 || scored[0].d < scored[1].d)) {
        return { status: "correct", id: scored[0].id };
      }
    }

    return { status: "unknown" };
  };
}
