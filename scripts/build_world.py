#!/usr/bin/env python3
"""Build data/world.json from Natural Earth 50m admin-0 countries.

The quiz set is the 193 UN member states plus Vatican City, Palestine,
Kosovo, and Taiwan. Dependent territories are drawn with the country that
governs them and are not separate answers.
"""

import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("NE_GEOJSON", "/tmp/ne50.geojson")
OUT = os.path.join(ROOT, "data", "world.json")

UN = {
    "AFG", "ALB", "DZA", "AND", "AGO", "ATG", "ARG", "ARM", "AUS", "AUT", "AZE",
    "BHS", "BHR", "BGD", "BRB", "BLR", "BEL", "BLZ", "BEN", "BTN", "BOL", "BIH",
    "BWA", "BRA", "BRN", "BGR", "BFA", "BDI", "CPV", "KHM", "CMR", "CAN", "CAF",
    "TCD", "CHL", "CHN", "COL", "COM", "COG", "COD", "CRI", "CIV", "HRV", "CUB",
    "CYP", "CZE", "PRK", "DNK", "DJI", "DMA", "DOM", "ECU", "EGY", "SLV", "GNQ",
    "ERI", "EST", "SWZ", "ETH", "FJI", "FIN", "FRA", "GAB", "GMB", "GEO", "DEU",
    "GHA", "GRC", "GRD", "GTM", "GIN", "GNB", "GUY", "HTI", "HND", "HUN", "ISL",
    "IND", "IDN", "IRN", "IRQ", "IRL", "ISR", "ITA", "JAM", "JPN", "JOR", "KAZ",
    "KEN", "KIR", "KWT", "KGZ", "LAO", "LVA", "LBN", "LSO", "LBR", "LBY", "LIE",
    "LTU", "LUX", "MDG", "MWI", "MYS", "MDV", "MLI", "MLT", "MHL", "MRT", "MUS",
    "MEX", "FSM", "MDA", "MCO", "MNG", "MNE", "MAR", "MOZ", "MMR", "NAM", "NRU",
    "NPL", "NLD", "NZL", "NIC", "NER", "NGA", "MKD", "NOR", "OMN", "PAK", "PLW",
    "PAN", "PNG", "PRY", "PER", "PHL", "POL", "PRT", "QAT", "KOR", "ROU", "RUS",
    "RWA", "KNA", "LCA", "VCT", "WSM", "SMR", "STP", "SAU", "SEN", "SRB", "SYC",
    "SLE", "SGP", "SVK", "SVN", "SLB", "SOM", "ZAF", "SDS", "ESP", "LKA", "SDN",
    "SUR", "SWE", "CHE", "SYR", "TJK", "TZA", "THA", "TLS", "TGO", "TON", "TTO",
    "TUN", "TUR", "TKM", "TUV", "UGA", "UKR", "ARE", "GBR", "USA", "URY", "UZB",
    "VUT", "VEN", "VNM", "YEM", "ZMB", "ZWE",
}
EXTRAS = {"VAT", "PSX", "KOS", "TWN"}
QUIZ = UN | EXTRAS
MERGE_INTO = {"CYN": "CYP", "SOL": "SOM"}

NAME_OVERRIDE = {
    "CIV": "Côte d'Ivoire",
    "FSM": "Micronesia",
    "SWZ": "Eswatini",
    "USA": "United States",
    "TLS": "Timor-Leste",
    "BHS": "Bahamas",
    "VAT": "Vatican City",
    "STP": "São Tomé and Príncipe",
    "COD": "Democratic Republic of the Congo",
    "SRB": "Serbia",
    "TZA": "Tanzania",
}

CONTINENT_OVERRIDE = {
    "MUS": "Africa",
    "SYC": "Africa",
    "MDV": "Asia",
}

SHORT = {
    "COD": "DR Congo",
    "CAF": "C. African Rep.",
    "COG": "Congo",
    "ARE": "UAE",
    "GBR": "UK",
    "DOM": "Dominican Rep.",
    "GNQ": "Eq. Guinea",
    "PNG": "Papua New Guinea",
    "BIH": "Bosnia & Herz.",
    "ATG": "Antigua & Barbuda",
    "VCT": "St. Vincent",
    "KNA": "St. Kitts & Nevis",
    "STP": "São Tomé",
    "TTO": "Trinidad & Tobago",
    "MKD": "N. Macedonia",
    "SLB": "Solomon Is.",
    "MHL": "Marshall Is.",
    "USA": "United States",
    "FSM": "Micronesia",
}

ALIASES = {
    "USA": ["United States of America", "USA", "US", "U.S.", "U.S.A.", "America"],
    "GBR": ["UK", "U.K.", "Britain", "Great Britain", "United Kingdom of Great Britain and Northern Ireland"],
    "ARE": ["UAE", "U.A.E.", "Emirates", "The Emirates"],
    "COD": ["DRC", "DR Congo", "D.R. Congo", "Congo Kinshasa", "Congo-Kinshasa", "Democratic Republic of Congo"],
    "COG": ["Congo Brazzaville", "Congo-Brazzaville", "Congo Republic", "Republic of Congo"],
    "CIV": ["Ivory Coast", "Cote d'Ivoire", "Cote dIvoire", "Cote d Ivoire"],
    "CZE": ["Czech Republic", "Czech"],
    "SWZ": ["Swaziland", "eSwatini"],
    "MMR": ["Burma"],
    "CPV": ["Cape Verde"],
    "TLS": ["East Timor", "Timor Leste"],
    "NLD": ["Holland", "The Netherlands"],
    "RUS": ["Russian Federation"],
    "KOR": ["Republic of Korea", "ROK", "S. Korea", "South Korea"],
    "PRK": ["DPRK", "Democratic People's Republic of Korea", "N. Korea", "North Korea"],
    "VAT": ["Vatican", "Holy See", "The Vatican"],
    "PSX": ["State of Palestine", "Palestinian Territories"],
    "TWN": ["Republic of China", "ROC"],
    "MKD": ["Macedonia", "FYROM"],
    "FSM": ["Federated States of Micronesia"],
    "BHS": ["The Bahamas"],
    "GMB": ["The Gambia"],
    "LAO": ["Lao PDR", "Lao People's Democratic Republic"],
    "BRN": ["Brunei Darussalam"],
    "MDA": ["Republic of Moldova"],
    "TZA": ["United Republic of Tanzania"],
    "SYR": ["Syrian Arab Republic"],
    "IRN": ["Islamic Republic of Iran", "Persia"],
    "VNM": ["Viet Nam"],
    "CAF": ["CAR"],
    "PNG": ["PNG", "Papua NG"],
    "KGZ": ["Kyrgyz Republic"],
    "SVK": ["Slovak Republic"],
    "BLR": ["Belorussia", "Byelorussia"],
    "KHM": ["Kampuchea"],
    "SUR": ["Surinam"],
    "PHL": ["Phillipines", "Philipines", "Phillippines"],
    "ARG": ["Argentine"],
    "STP": ["Sao Tome", "Sao Tome and Principe"],
    "GEO": ["Republic of Georgia"],
    "SRB": ["Republic of Serbia"],
    "TZA": ["United Republic of Tanzania"],
    "BOL": ["Bolivia Plurinational State"],
    "VEN": ["Venezuela Bolivarian Republic"],
    "KNA": ["St Kitts", "Saint Kitts", "St. Kitts and Nevis"],
    "LCA": ["St Lucia", "St. Lucia"],
    "VCT": ["St Vincent", "St. Vincent", "Saint Vincent"],
    "GNB": ["Guinea Bissau"],
}

T_ALIAS = {
    "MAC": ["Macau", "Macao"],
    "HKG": ["Hong Kong", "Hong Kong SAR"],
    "GRL": ["Greenland"],
    "PRI": ["Puerto Rico"],
    "FRO": ["Faroe Islands", "Faeroe Islands", "Faroes"],
    "CYN": ["Northern Cyprus", "North Cyprus", "Turkish Republic of Northern Cyprus"],
    "SOL": ["Somaliland"],
    "SAH": ["Western Sahara", "West Sahara"],
    "FLK": ["Falklands", "Falkland Islands", "Malvinas"],
    "SGS": ["South Georgia"],
}

W = 3600.0
LAT_MAX = 84.0
LAT_MIN = -58.0


def merc_y(lat):
    lat = max(LAT_MIN, min(LAT_MAX, lat))
    phi = math.radians(lat)
    return math.log(math.tan(math.pi / 4 + phi / 2))


Y_TOP = merc_y(LAT_MAX)
Y_BOT = merc_y(LAT_MIN)
H = W * (Y_TOP - Y_BOT) / (2 * math.pi)


def project(lon, lat):
    x = (lon + 180.0) / 360.0 * W
    y = (Y_TOP - merc_y(lat)) / (Y_TOP - Y_BOT) * H
    return x, y


def perp_dist(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def douglas_peucker(points, tol):
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        max_d = 0.0
        idx = None
        a = points[start]
        b = points[end]
        for i in range(start + 1, end):
            d = perp_dist(points[i], a, b)
            if d > max_d:
                max_d = d
                idx = i
        if idx is not None and max_d > tol:
            keep[idx] = True
            stack.append((start, idx))
            stack.append((idx, end))
    return [p for p, k in zip(points, keep) if k]


def ring_tol(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    span = max(max(xs) - min(xs), max(ys) - min(ys), 0.002)
    return min(0.045, max(span / 48.0, 0.0006))


def iter_polys(geom):
    if geom["type"] == "Polygon":
        yield geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            yield poly


def simplify_poly(poly):
    out = []
    for ring in poly:
        if len(ring) < 4:
            continue
        if sum(p[1] for p in ring) / len(ring) < -62:
            continue
        pts = [(p[0], p[1]) for p in ring]
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        simp = douglas_peucker(pts, ring_tol(pts))
        if len(simp) >= 4:
            out.append(simp)
    return out


def path_from_polys(polys):
    chunks = []
    all_pts = []
    for poly in polys:
        span = 0
        for ring in poly:
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            span = max(span, max(xs) - min(xs), max(ys) - min(ys))
        digits = 2 if span < 1.2 else 1
        for ring in poly:
            projected = []
            for lon, lat in ring:
                x, y = project(lon, lat)
                if projected:
                    px, py = projected[-1]
                    if abs(px - x) < 0.04 and abs(py - y) < 0.04:
                        continue
                projected.append((x, y))
            if len(projected) < 3:
                continue
            all_pts.extend(projected)
            fmt = f"{{:.{digits}f}}"
            cmds = [f"M{fmt.format(projected[0][0])} {fmt.format(projected[0][1])}"]
            for x, y in projected[1:]:
                cmds.append(f"L{fmt.format(x)} {fmt.format(y)}")
            cmds.append("Z")
            chunks.append("".join(cmds))
    if not all_pts:
        return "", 0.0
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    area = (max(xs) - min(xs)) * (max(ys) - min(ys))
    return "".join(chunks), area


def display_name(code, props):
    if code in NAME_OVERRIDE:
        return NAME_OVERRIDE[code]
    return props["ADMIN"]


def graticule():
    lines = []
    for lon in range(-180, 181, 30):
        pts = [project(lon, lat) for lat in [LAT_MIN + i * 2 for i in range(int((LAT_MAX - LAT_MIN) / 2) + 1)]]
        lines.append(open_path(pts, 0))
    for lat in (-30, 0, 30, 60):
        pts = [project(lon, lat) for lon in range(-180, 181, 3)]
        lines.append(open_path(pts, 0))
    return lines


def open_path(pts, digits):
    fmt = f"{{:.{digits}f}}"
    cmds = [f"M{fmt.format(pts[0][0])} {fmt.format(pts[0][1])}"]
    for x, y in pts[1:]:
        cmds.append(f"L{fmt.format(x)} {fmt.format(y)}")
    return "".join(cmds)


def main():
    with open(SRC) as f:
        geo = json.load(f)

    by_code = {}
    for feat in geo["features"]:
        props = feat["properties"]
        by_code[props["ADM0_A3"]] = feat

    missing = QUIZ - set(by_code)
    if missing:
        raise SystemExit(f"Missing quiz countries: {sorted(missing)}")

    sov_to_id = {}
    for code in QUIZ:
        props = by_code[code]["properties"]
        if props["ADMIN"] == props["SOVEREIGNT"]:
            sov_to_id[props["SOVEREIGNT"]] = code

    names = {}
    for code in QUIZ:
        names[code] = display_name(code, by_code[code]["properties"])

    buckets = {code: [] for code in QUIZ}
    other_polys = []
    territories = []
    seen_territory = set()

    def parent_for(props):
        code = props["ADM0_A3"]
        if code in MERGE_INTO:
            return MERGE_INTO[code]
        if code in QUIZ:
            return code
        return sov_to_id.get(props["SOVEREIGNT"])

    for feat in geo["features"]:
        props = feat["properties"]
        code = props["ADM0_A3"]
        polys = []
        if props["CONTINENT"] != "Antarctica":
            for poly in iter_polys(feat["geometry"]):
                simp = simplify_poly(poly)
                if simp:
                    polys.append(simp)
        parent = parent_for(props)
        if code in QUIZ:
            buckets[code].extend(polys)
        elif parent and polys:
            buckets[parent].extend(polys)
        elif polys:
            other_polys.extend(polys)

        if code in QUIZ:
            continue
        label = {
            "HKG": "Hong Kong",
            "MAC": "Macao",
            "ALD": "Åland",
        }.get(code, props["ADMIN"] or props["NAME"])
        alias_set = []
        for candidate in (props["ADMIN"], props["NAME"], props["NAME_LONG"], props.get("NAME_ALT")):
            if candidate and candidate not in alias_set:
                alias_set.append(candidate)
        for extra in T_ALIAS.get(code, []):
            if extra not in alias_set:
                alias_set.append(extra)
        if parent:
            note = f"{label} is part of {names[parent]} in this quiz."
        else:
            note = f"{label} isn't counted as a country in this quiz."
        key = label.strip().lower()
        if key in seen_territory:
            continue
        seen_territory.add(key)
        territories.append({
            "name": label,
            "aliases": [a for a in alias_set if a != label],
            "note": note,
        })

    countries = []
    for code in sorted(QUIZ):
        props = by_code[code]["properties"]
        d, area = path_from_polys(buckets[code])
        if not d:
            raise SystemExit(f"No geometry for {code}")
        name = names[code]
        lx, ly = project(props["LABEL_X"], props["LABEL_Y"])
        aliases = []
        for alias in ALIASES.get(code, []):
            if alias not in aliases and alias != name:
                aliases.append(alias)
        countries.append({
            "id": code,
            "name": name,
            "short": SHORT.get(code, name),
            "continent": CONTINENT_OVERRIDE.get(code, props["CONTINENT"]),
            "label": [round(lx, 2), round(ly, 2)],
            "area": round(area, 1),
            "aliases": aliases,
            "d": d,
        })

    countries.sort(key=lambda c: -c["area"])
    other_paths = []
    if other_polys:
        d, _ = path_from_polys(other_polys)
        if d:
            other_paths.append(d)

    continents = {}
    for c in countries:
        continents[c["continent"]] = continents.get(c["continent"], 0) + 1

    payload = {
        "width": round(W, 2),
        "height": round(H, 2),
        "graticule": graticule(),
        "other": other_paths,
        "countries": countries,
        "territories": territories,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print(f"countries {len(countries)} territories {len(territories)}")
    print("continents", dict(sorted(continents.items())))
    print(f"wrote {OUT} ({size/1024:.0f} KB) map {W:.0f}x{H:.0f}")
    long = [c["name"] for c in countries if len(c["name"]) > 22 and c["short"] == c["name"]]
    if long:
        print("long names without short label:", long)


if __name__ == "__main__":
    main()
