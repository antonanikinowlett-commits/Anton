import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CSV_FILE = "businesses.csv"
MIN_RESULTS = 10
MAX_RESULTS = 20

# OSM tag (key, value) -> our "type" label
CATEGORIES = [
    ("shop", "florist", "florist"),
    ("shop", "hairdresser", "barber"),
    ("amenity", "restaurant", "restaurant"),
]

# Bounding box roughly covering the city of Paris (south, west, north, east)
PARIS_BBOX = "48.8155,2.2241,48.9022,2.4699"

QUERY_TEMPLATE = """
[out:json][timeout:50];
(
  node["{key}"="{value}"]["name"]["phone"][!"website"][!"contact:website"]({bbox});
  way["{key}"="{value}"]["name"]["phone"][!"website"][!"contact:website"]({bbox});
);
out body;
"""


def fetch_category(key, value):
    query = QUERY_TEMPLATE.format(key=key, value=value, bbox=PARIS_BBOX)
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {
        "User-Agent": "prospector/1.0 (small business research script)",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    request = urllib.request.Request(OVERPASS_URL, data=data, headers=headers)

    max_attempts = 4
    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return payload.get("elements", [])
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 504) and attempt < max_attempts:
                wait = 15 * attempt
                print(f"  Got HTTP {exc.code}, retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise


def build_address(tags):
    housenumber = tags.get("addr:housenumber", "")
    street = tags.get("addr:street", "")
    if housenumber and street:
        return f"{housenumber} {street}"
    if street:
        return street
    return ""


def element_to_row(element, business_type):
    tags = element.get("tags", {})
    name = tags.get("name")
    phone = tags.get("phone") or tags.get("contact:phone")
    address = build_address(tags)

    if not name or not phone or not address:
        return None

    city = tags.get("addr:city", "Paris")
    postcode = tags.get("addr:postcode", "")
    if city.lower() != "paris" and not postcode.startswith("75"):
        return None
    city = "Paris"

    return {
        "name": name,
        "address": address,
        "phone": phone,
        "city": city,
        "type": business_type,
    }


def main():
    rows = []
    seen = set()
    per_category_cap = -(-MAX_RESULTS // len(CATEGORIES))  # ceil division

    for index, (key, value, business_type) in enumerate(CATEGORIES):
        if index > 0:
            time.sleep(5)
        print(f"Querying Overpass API for {business_type}s...")
        elements = fetch_category(key, value)
        category_rows = []
        for element in elements:
            row = element_to_row(element, business_type)
            if row is None:
                continue
            dedupe_key = (row["name"], row["address"])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            category_rows.append(row)
            if len(category_rows) >= per_category_cap:
                break
        rows.extend(category_rows)

    rows = rows[:MAX_RESULTS]

    if len(rows) < MIN_RESULTS:
        print(f"Warning: only found {len(rows)} businesses (wanted at least {MIN_RESULTS}).")

    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "address", "phone", "city", "type"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} businesses to {CSV_FILE}")


if __name__ == "__main__":
    main()
