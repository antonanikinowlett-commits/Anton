#!/usr/bin/env python3
"""
verify_no_website.py

Takes a list of businesses (from prospector.py / Overpass) and keeps ONLY the
ones that genuinely have no website of their own.

For each business it runs a web search on "<name> <address>" and inspects the
result URLs. If any result looks like the business's OWN site (i.e. not a
directory / aggregator / social page), the business is discarded.

Usage:
    from verify_no_website import filter_no_website
    clean = filter_no_website(businesses)

Each business is a dict with at least: {"name": str, "address": str}

Note: ported to use the stdlib (urllib) instead of the `requests` package,
since `requests`/pip are not available in this environment.
"""

import re
import time
import urllib.error
import urllib.parse
import urllib.request

# ----------------------------------------------------------------------------
# Directories / aggregators / socials. A hit on one of these does NOT count as
# the business having its own website — these list everyone.
# ----------------------------------------------------------------------------
DIRECTORY_DOMAINS = {
    "tripadvisor.com", "tripadvisor.fr",
    "thefork.com", "thefork.fr", "lafourchette.com",
    "yelp.com", "yelp.fr",
    "google.com", "google.fr", "maps.google.com", "goo.gl",
    "facebook.com", "m.facebook.com", "instagram.com",
    "twitter.com", "x.com", "linkedin.com", "tiktok.com",
    "pagesjaunes.fr", "petitfute.com", "mappy.com",
    "ubereats.com", "deliveroo.fr", "deliveroo.com", "just-eat.fr",
    "foursquare.com", "yellowpages.com", "bing.com",
    "youtube.com", "wikipedia.org", "restaurantguru.com",
    "theforkmanager.com", "michelin.com", "guide.michelin.com",
    "opentable.com", "resy.com", "zenchef.com",
}


def _domain(url: str) -> str:
    try:
        netloc = urllib.parse.urlparse(url).netloc.lower()
        return netloc[4:] if netloc.startswith("www.") else netloc
    except Exception:
        return ""


def _is_directory(url: str) -> bool:
    d = _domain(url)
    return any(d == dd or d.endswith("." + dd) for dd in DIRECTORY_DOMAINS)


def _name_tokens(name: str):
    """Significant words from a business name, lowercased, short words dropped."""
    stop = {"le", "la", "les", "du", "de", "des", "au", "aux", "the", "a", "l",
            "restaurant", "cafe", "café", "bar", "chez", "et"}
    tokens = re.findall(r"[a-zA-Zà-ÿ0-9]+", name.lower())
    return [t for t in tokens if len(t) > 2 and t not in stop]


def _looks_like_own_site(url: str, name: str) -> bool:
    """
    Heuristic: a result is the business's own site if it's NOT a directory AND
    at least one significant word from the business name appears in the domain.
    """
    if _is_directory(url):
        return False
    domain = _domain(url)
    if not domain:
        return False
    tokens = _name_tokens(name)
    return any(tok in domain for tok in tokens)


def _search_duckduckgo(query: str):
    """
    Query DuckDuckGo's HTML endpoint and return a list of result URLs.
    No API key required.
    """
    url = "https://html.duckduckgo.com/html/"
    data = urllib.parse.urlencode({"q": query}).encode("utf-8")
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; SiteSnapBot/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, urllib.error.HTTPError):
        return []

    # DuckDuckGo wraps real result URLs in a redirect like
    # //duckduckgo.com/l/?uddg=<encoded-real-url>
    raw = re.findall(r'uddg=([^&"]+)', html)
    return [urllib.parse.unquote(r) for r in raw]


def has_own_website(business: dict, pause: float = 1.5) -> bool:
    """
    True if the business appears to have its own website, False otherwise.
    """
    name = business.get("name", "")
    address = business.get("address", "")
    query = f"{name} {address}".strip()
    if not query:
        return False

    results = _search_duckduckgo(query)
    time.sleep(pause)  # be polite, avoid rate-limiting

    for url in results[:10]:
        if _looks_like_own_site(url, name):
            return True
    return False


def filter_no_website(businesses, pause: float = 1.5, verbose: bool = True):
    """
    Return only the businesses that have NO website of their own.
    """
    kept = []
    for b in businesses:
        own = has_own_website(b, pause=pause)
        if verbose:
            tag = "HAS SITE -> drop" if own else "no site  -> keep"
            print(f"[{tag}] {b.get('name','?')} — {b.get('address','?')}")
        if not own:
            kept.append(b)
    if verbose:
        print(f"\n{len(kept)}/{len(businesses)} businesses kept (no website).")
    return kept


# ----------------------------------------------------------------------------
# Quick self-test when run directly
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    sample = [
        {"name": "Le Dalou", "address": "30 Place de la Nation, Paris"},
        {"name": "Le Boucl'art", "address": "99 Rue d'Avron, Paris"},
        {"name": "Le Roi du Pot-au-Feu", "address": "34 Rue Vignon, Paris"},
    ]
    filter_no_website(sample)
