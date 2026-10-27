/** Quiz variant: name countries, or name each country's capital. */

import { expandKeys, normalize } from "./match.mjs";

export const COPY = {
  countries: {
    kicker: "Countries",
    documentTitle: "Fifteen Minutes — Name every country",
    label: "Country name",
    placeholder: "Name a country",
    progress:
      "Each column is a continent. Empty cells are countries you haven't named. A name fills its cell when you get it right.",
    foot: "{n} countries: the UN members, plus Vatican City, Palestine, Kosovo, and Taiwan. Territories are drawn with their country. Map shapes from Natural Earth.",
    introKicker: "A blank atlas",
    introTitle: "Name them all.",
    intro:
      "You have 15 minutes to name all {n} countries. A question mark sits on each one until you get it. A full name is accepted as soon as you finish typing it. Press Enter for anything else. Zoom and drag to reach the small ones. Territories count with their country. A continent turns green when every country in it is named.",
    noun: "countries",
    perfectHeading: "Every country",
    missedTitle: "Countries you missed",
    mapLabel: "World map. Each country is marked until you name it.",
  },
  capitals: {
    kicker: "Capital cities",
    documentTitle: "Fifteen Minutes — Name every capital",
    label: "Capital city",
    placeholder: "Name a capital",
    progress:
      "Each column is a continent. Every cell names a country until you name its capital.",
    foot: "{n} capitals, one for each country: the UN members, plus Vatican City, Palestine, Kosovo, and Taiwan. Where a country has more than one capital, any accepted name counts. Territories are drawn with their country.",
    introKicker: "A blank atlas",
    introTitle: "Name every capital.",
    intro:
      "You have 15 minutes to name the capital of all {n} countries. Each country is labeled on the map and in the table. A correct capital replaces that name. A full capital name is accepted as soon as you finish typing it. Press Enter for anything else. Zoom and drag to reach the small ones. A continent turns green when every capital in it is named.",
    noun: "capitals",
    perfectHeading: "Every capital",
    missedTitle: "Capitals you missed",
    mapLabel: "World map. Each country is labeled. Name its capital.",
  },
};

export function gameMode() {
  const value = new URLSearchParams(location.search).get("game");
  return value === "capitals" ? "capitals" : "countries";
}

export function fill(template, total) {
  return template.replaceAll("{n}", String(total));
}

/** Remember the country, then point name/short/aliases at the answer for this mode. */
export function applyAnswers(countries, capitalsById, mode) {
  for (const country of countries) {
    country.place = country.name;
    country.placeShort = country.short;
    country.placeAliases = [...(country.aliases || [])];
    if (mode !== "capitals") continue;
    const capital = capitalsById[country.id];
    if (!capital) throw new Error(`Missing capital for ${country.id}`);
    country.name = capital.name;
    country.short = capital.short || capital.name;
    country.aliases = capital.aliases || [];
  }
}

/** A typed country name in the capitals round, when it is not itself the capital. */
export function namesTheCountryInstead(raw, matcher, countries, mode) {
  if (mode !== "capitals") return false;
  const key = normalize(raw);
  if (!key) return false;
  const isCountry = countries.some((country) =>
    [country.place, ...(country.placeAliases || [])].some((name) => expandKeys(name).includes(key)),
  );
  if (!isCountry) return false;
  const result = matcher(raw);
  if (result.status !== "correct") return result.status === "unknown";
  if (matcher.exactId(raw) === result.id) return false;
  const matched = countries.find((country) => country.id === result.id);
  const prefix = [matched.name, ...(matched.aliases || [])]
    .flatMap((name) => expandKeys(name))
    .some((candidate) => candidate.startsWith(key));
  return !prefix;
}
