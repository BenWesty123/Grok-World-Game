# Fifteen Minutes

A browser game: you have 15 minutes to name every country in the world, the capital city of every country, or the flag of every country.

The home page chooses the round. In the country round, a question mark marks each country that is still open. In the capitals round, the country name stays on the map and in the table, and the capital appears underneath once you name it. Scroll to zoom and drag to pan, which is how the small ones become readable. In the flags round, one flag appears at a time. Name its country, or skip it and it returns later. When the clock ends, you get your score and the full list of what you missed.

The quiz has 197 countries: the UN members, plus Vatican City, Palestine, Kosovo, and Taiwan. Dependent territories are drawn as part of the country that governs them. In the capitals round, a country with more than one capital accepts any of the listed names.

## Play

From this folder:

```bash
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765).

## Map data

Country shapes come from [Natural Earth](https://www.naturalearthdata.com/) 50m admin-0 countries (public domain). Rebuild `data/world.json` after changing the generator:

```bash
python3 scripts/build_world.py
node scripts/test_match.mjs
node scripts/test_capitals.mjs
node scripts/test_flags.mjs
```

The generator expects the Natural Earth file at `/tmp/ne50.geojson`, or at the path in `NE_GEOJSON`.

Flag artwork is the [flag-icons](https://github.com/lipis/flag-icons) 4x3 set (MIT), saved under `flags/` and keyed by `data/flag-codes.json`.
