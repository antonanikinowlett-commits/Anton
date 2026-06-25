#!/usr/bin/env python3
"""
prospector.py — Step 1 of the SiteSnap pipeline.

Finds small businesses in Paris (restaurants, florists, barbers, grocers)
that genuinely have no website. Two-layer filter:
  1. Overpass/OSM query that excludes anything tagged website or contact:website
  2. DuckDuckGo web search per business to catch sites that OSM didn't tag

Outputs a numbered list and writes results to businesses.json.
No API key needed.

Note: uses the stdlib (urllib) instead of the `requests` package, since
`requests`/pip are not available in this environment.
"""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

# ── Config ────────────────────────────────────────────────────────────────────

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

CATEGORIES = [
    ("restaurant",  '[amenity=restaurant]'),
    ("cafe",        '[amenity=cafe]'),
    ("florist",     '[shop=florist]'),
    ("barber",      '[shop=barber]'),
    ("hairdresser", '[shop=hairdresser]'),
    ("grocery",     '[shop=convenience]'),
    ("bakery",      '[shop=bakery]'),
]

# Paris bounding box
BBOX = "48.8155,2.2241,48.9022,2.4699"

DIRECTORY_DOMAINS = {
    "tripadvisor.com","tripadvisor.fr","thefork.com","lafourchette.com",
    "yelp.com","yelp.fr","google.com","google.fr","facebook.com",
    "instagram.com","twitter.com","x.com","pagesjaunes.fr","petitfute.com",
    "mappy.com","ubereats.com","deliveroo.fr","just-eat.fr","foursquare.com",
    "youtube.com","wikipedia.org","restaurantguru.com","michelin.com",
    "opentable.com","zenchef.com","linkedin.com","tiktok.com",
}

# ── Overpass ──────────────────────────────────────────────────────────────────

def fetch_category(tag: str) -> list[dict]:
    """Query OSM for businesses of one type with no website tag."""
    query = f"""
[out:json][timeout:30];
(
  node{tag}[!"website"][!"contact:website"](bbox:{BBOX});
  way{tag}[!"website"][!"contact:website"](bbox:{BBOX});
);
out center tags;
"""
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {"User-Agent": "curl/8.14.1"}
    request = urllib.request.Request(OVERPASS_URL, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload.get("elements", [])
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f"  Overpass error for {tag}: {e}")
        return []


def parse_element(el: dict, category: str) -> dict | None:
    tags = el.get("tags", {})
    name = tags.get("name", "").strip()
    if not name:
        return None

    if el["type"] == "node":
        lat, lon = el.get("lat"), el.get("lon")
    else:
        center = el.get("center", {})
        lat, lon = center.get("lat"), center.get("lon")

    street  = tags.get("addr:street", "")
    housen  = tags.get("addr:housenumber", "")
    city    = tags.get("addr:city", "Paris")
    address = f"{housen} {street}".strip() or city
    phone   = tags.get("phone") or tags.get("contact:phone", "")
    hours   = tags.get("opening_hours", "")

    return {
        "name": name,
        "category": category,
        "address": address,
        "city": city,
        "phone": phone,
        "hours": hours,
        "lat": lat,
        "lon": lon,
    }

# ── Search verification ───────────────────────────────────────────────────────
# Note: duckduckgo.com is unreachable from this environment's network, so
# verification uses Bing's HTML search instead (same heuristic approach).

def _domain(d: str) -> str:
    d = d.lower().strip()
    return d[4:] if d.startswith("www.") else d

def _is_directory(domain: str) -> bool:
    d = _domain(domain)
    return any(d == dd or d.endswith("." + dd) for dd in DIRECTORY_DOMAINS)

def _name_tokens(name: str) -> list[str]:
    stop = {"le","la","les","du","de","des","au","aux","the","a","l",
            "restaurant","cafe","café","bar","chez","et","boulangerie"}
    tokens = re.findall(r"[a-zA-Zà-ÿ0-9]+", name.lower())
    return [t for t in tokens if len(t) > 2 and t not in stop]

def _search_bing(query: str) -> list[str]:
    """Return the result domains shown by Bing's HTML search for a query."""
    url = "https://www.bing.com/search?" + urllib.parse.urlencode({"q": query})
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, urllib.error.HTTPError):
        return []
    return re.findall(r'<a class="tilk" aria-label="([^"]+)"', html)

def has_own_website(business: dict) -> bool:
    """True if web search finds the business's own domain."""
    name    = business["name"]
    address = business["address"]
    query   = f"{name} {address} site"
    domains = _search_bing(query)
    tokens  = _name_tokens(name)
    for domain in domains[:10]:
        if _is_directory(domain):
            continue
        d = _domain(domain)
        if d and any(t in d for t in tokens):
            return True
    return False

# ── Main ──────────────────────────────────────────────────────────────────────

def run(max_results: int = 20) -> list[dict]:
    print("🔍 Step 1 — Searching OSM for businesses without websites...\n")
    candidates = []

    for category, tag in CATEGORIES:
        elements = fetch_category(tag)
        for el in elements:
            b = parse_element(el, category)
            if b:
                candidates.append(b)
        print(f"  {category}: {len(elements)} raw results from OSM")
        time.sleep(0.5)

    # Deduplicate by name
    seen, unique = set(), []
    for b in candidates:
        key = b["name"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(b)

    print(f"\n✅ {len(unique)} unique businesses found by OSM (no website tag).")
    print("🌐 Running web search verification — this takes ~1s per business...\n")

    verified = []
    for b in unique:
        has_site = has_own_website(b)
        status = "❌ has site, skipping" if has_site else "✅ no site found"
        print(f"  {status}: {b['name']} — {b['address']}")
        if not has_site:
            verified.append(b)
        time.sleep(0.8)
        if len(verified) >= max_results:
            break

    print(f"\n🎯 {len(verified)} verified businesses with no website.\n")

    with open("businesses.json", "w", encoding="utf-8") as f:
        json.dump(verified, f, ensure_ascii=False, indent=2)

    return verified


if __name__ == "__main__":
    results = run()
    print("=" * 55)
    for i, b in enumerate(results, 1):
        print(f"  {i}. {b['name']} ({b['category']}) — {b['address']}")
    print("=" * 55)
    print(f"\nSaved to businesses.json")
