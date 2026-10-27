import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const world = JSON.parse(readFileSync(new URL("../data/world.json", import.meta.url), "utf8"));
const codes = JSON.parse(readFileSync(new URL("../data/flag-codes.json", import.meta.url), "utf8"));
const ids = world.countries.map((country) => country.id);

assert.equal(ids.length, 197);
assert.equal(Object.keys(codes).length, 197);
assert.equal(new Set(Object.values(codes)).size, 197);

for (const id of ids) {
  const code = codes[id];
  assert.equal(typeof code, "string", id);
  const svg = readFileSync(new URL(`../flags/${code}.svg`, import.meta.url), "utf8");
  assert.match(svg, /<svg\b/, code);
}

console.log("flags ok", ids.length);
