import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMatcher } from "../js/match.mjs";

const world = JSON.parse(readFileSync(new URL("../data/world.json", import.meta.url), "utf8"));
const matcher = createMatcher(world.countries, world.territories);
const byId = new Map(world.countries.map((country) => [country.id, country]));

assert.equal(world.countries.length, 197);

const counts = {};
for (const country of world.countries) {
  counts[country.continent] = (counts[country.continent] || 0) + 1;
  const direct = matcher(country.name);
  assert.equal(direct.status, "correct", country.name);
  assert.equal(direct.id, country.id, country.name);
  for (const alias of country.aliases) {
    const result = matcher(alias);
    assert.equal(result.status, "correct", `${alias} -> ${country.name}`);
    assert.equal(result.id, country.id, alias);
  }
}

assert.deepEqual(counts, {
  Africa: 54,
  Asia: 49,
  Europe: 45,
  "North America": 23,
  Oceania: 14,
  "South America": 12,
});

function expectId(input, id) {
  const result = matcher(input);
  assert.equal(result.status, "correct", input);
  assert.equal(result.id, id, `${input} matched ${byId.get(result.id)?.name}`);
}

expectId("usa", "USA");
expectId("U.S.A.", "USA");
expectId("United States of America", "USA");
expectId("uk", "GBR");
expectId("Great Britain", "GBR");
expectId("holland", "NLD");
expectId("burma", "MMR");
expectId("czech republic", "CZE");
expectId("Côte d'Ivoire", "CIV");
expectId("cote d ivoire", "CIV");
expectId("ivory coast", "CIV");
expectId("dr congo", "COD");
expectId("democratic republic of the congo", "COD");
expectId("republic of the congo", "COG");
expectId("eswatini", "SWZ");
expectId("swaziland", "SWZ");
expectId("cape verde", "CPV");
expectId("east timor", "TLS");
expectId("vatican", "VAT");
expectId("holy see", "VAT");
expectId("sao tome", "STP");
expectId("st lucia", "LCA");
expectId("saint vincent", "VCT");
expectId("bosnia", "BIH");
expectId("dominican", "DOM");
expectId("dominica", "DMA");
expectId("guinea", "GIN");
expectId("guinea-bissau", "GNB");
expectId("equatorial guinea", "GNQ");
expectId("papua new guinea", "PNG");
expectId("sudan", "SDN");
expectId("south sudan", "SDS");
expectId("niger", "NER");
expectId("nigeria", "NGA");
expectId("uae", "ARE");
expectId("the bahamas", "BHS");
expectId("the gambia", "GMB");
expectId("phillipines", "PHL");
expectId("argintina", "ARG");

assert.equal(matcher("congo").status, "ambiguous");
assert.equal(matcher("korea").status, "ambiguous");
assert.equal(matcher("united").status, "ambiguous");
assert.equal(matcher("").status, "empty");
assert.equal(matcher("zzzzzz").status, "unknown");

const greenland = matcher("greenland");
assert.equal(greenland.status, "hint");
assert.match(greenland.message, /Denmark/);

const sahara = matcher("western sahara");
assert.equal(sahara.status, "hint");

console.log("match tests passed");
