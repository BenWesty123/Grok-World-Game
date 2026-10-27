import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMatcher } from "../js/match.mjs";
import { applyAnswers, namesTheCountryInstead } from "../js/mode.mjs";

const world = JSON.parse(readFileSync(new URL("../data/world.json", import.meta.url), "utf8"));
const capitalsFile = JSON.parse(readFileSync(new URL("../data/capitals.json", import.meta.url), "utf8"));
const countries = structuredClone(world.countries);
const ids = new Set(countries.map((country) => country.id));

assert.equal(Object.keys(capitalsFile.capitals).length, 197);
for (const id of ids) assert.ok(capitalsFile.capitals[id], `missing capital ${id}`);
for (const id of Object.keys(capitalsFile.capitals)) assert.ok(ids.has(id), `extra capital ${id}`);

applyAnswers(countries, capitalsFile.capitals, "capitals");
const territories = [...world.territories, ...(capitalsFile.hints || [])];
const matcher = createMatcher(countries, territories);
const byId = new Map(countries.map((country) => [country.id, country]));

for (const country of countries) {
  const direct = matcher(country.name);
  assert.equal(direct.status, "correct", country.name);
  assert.equal(direct.id, country.id, country.name);
  assert.equal(matcher.exactId(country.name), country.id, country.name);
  for (const alias of country.aliases) {
    const result = matcher(alias);
    assert.equal(result.status, "correct", `${alias} -> ${country.name}`);
    assert.equal(result.id, country.id, alias);
    assert.equal(matcher.exactId(alias), country.id, alias);
  }
  assert.equal(country.place.length > 0, true);
  assert.equal(country.placeShort.length > 0, true);
}

const france = byId.get("FRA");
assert.equal(france.place, "France");
assert.equal(france.placeShort, "France");
assert.equal(france.short, "Paris");
const states = byId.get("USA");
assert.equal(states.placeShort, "United States");
assert.equal(states.short, "Washington");

function expectId(input, id) {
  const result = matcher(input);
  assert.equal(result.status, "correct", input);
  assert.equal(result.id, id, `${input} matched ${byId.get(result.id)?.name}`);
}

expectId("Paris", "FRA");
expectId("mexico city", "MEX");
expectId("mexico", "MEX");
expectId("guatemala", "GTM");
expectId("panama", "PAN");
expectId("kuwait", "KWT");
expectId("washington", "USA");
expectId("Washington, D.C.", "USA");
expectId("kotte", "LKA");
expectId("colombo", "LKA");
expectId("jerusalem", "ISR");
expectId("east jerusalem", "PSX");
expectId("ramallah", "PSX");
expectId("singapore", "SGP");
expectId("vatican city", "VAT");
expectId("andorra", "AND");
expectId("sao tome", "STP");

assert.equal(matcher.exactId("France"), null);
assert.equal(matcher.exactId("mexico"), null);
assert.equal(matcher.exactId("fran"), null);
assert.equal(matcher.hasLongerName("Washington"), true);
assert.equal(matcher.hasLongerName("Paris"), false);
assert.equal(matcher.hasLongerName("Kotte"), false);

assert.equal(matcher("Canada").status, "unknown");
assert.equal(matcher("Canberra").id, "AUS");
assert.equal(matcher("Algeria").status, "unknown");
assert.equal(matcher("Algiers").id, "DZA");
assert.equal(matcher("Tunisia").status, "unknown");
assert.equal(matcher("Tunis").id, "TUN");
assert.equal(matcher("Brazil").status, "unknown");
assert.equal(matcher("Brasilia").id, "BRA");

const hague = matcher("The Hague");
assert.equal(hague.status, "hint");
assert.match(hague.message, /not the capital/i);
const telAviv = matcher("Tel Aviv");
assert.equal(telAviv.status, "hint");
assert.match(telAviv.message, /isn't the capital/i);

function countryHint(input) {
  return namesTheCountryInstead(input, matcher, countries, "capitals");
}

assert.equal(countryHint("France"), true);
assert.equal(countryHint("USA"), true);
assert.equal(countryHint("Mongolia"), true);
assert.equal(countryHint("Colombia"), true);
assert.equal(countryHint("Mexico"), false);
assert.equal(countryHint("Guatemala"), false);
assert.equal(countryHint("Paris"), false);
assert.equal(countryHint("Singapore"), false);
assert.equal(countryHint("Sao Tome"), false);
assert.equal(namesTheCountryInstead("France", matcher, countries, "countries"), false);

const greenland = matcher("Greenland");
assert.equal(greenland.status, "hint");
assert.match(greenland.message, /Denmark/);

console.log("capitals ok", countries.length);
