#!/usr/bin/env python3
"""
pipeline.py — SiteSnap master pipeline.

Triggered by Claude Code when you say "run the pipeline".
Walks through all 7 steps interactively, pausing for your input at key moments.

Steps:
  1. Prospect  — find Paris businesses with no website
  2. Choose    — you pick one from the list
  3. Research  — Claude Code auto-fetches business info + Unsplash images
  4. Design    — ask you for theme + section preferences
  5. Build     — generate the 4-page site
  6. Preview   — serve locally at http://localhost:8080
  7. Deploy    — push to GitHub + Netlify on your confirmation
"""

import json
import os
import re
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ── Helpers ───────────────────────────────────────────────────────────────────

def hr(char="─", n=55): print(char * n)

def ask(prompt: str, default: str = "") -> str:
    try:
        val = input(f"\n{prompt} ").strip()
        return val or default
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(0)

def kill_port(port: int):
    """Kill whatever is already running on a given port."""
    try:
        result = subprocess.run(["lsof","-ti",f":{port}"], capture_output=True, text=True)
        pids = result.stdout.strip().split()
        for pid in pids:
            os.kill(int(pid), signal.SIGTERM)
        if pids:
            print(f"  Killed existing process on :{port}")
        time.sleep(0.5)
    except Exception:
        pass

# ── Step 1: Prospect ──────────────────────────────────────────────────────────

def step_prospect() -> list[dict]:
    hr()
    print("STEP 1 — Finding businesses with no website")
    hr()
    from prospector import run as prospect_run
    businesses = prospect_run(max_results=15)
    return businesses

# ── Step 2: Choose ────────────────────────────────────────────────────────────

def step_choose(businesses: list[dict]) -> dict:
    hr()
    print("STEP 2 — Choose a business")
    hr()
    for i, b in enumerate(businesses, 1):
        print(f"  {i:>2}. {b['name']} ({b['category']}) — {b['address']}")
    print()
    while True:
        raw = ask("Enter number (1–{}):".format(len(businesses)))
        if raw.isdigit() and 1 <= int(raw) <= len(businesses):
            chosen = businesses[int(raw) - 1]
            print(f"\n  ✅ Selected: {chosen['name']}")
            return chosen
        print("  ❌ Invalid choice, try again.")

# ── Step 3: Research ──────────────────────────────────────────────────────────

def step_research(business: dict) -> tuple[dict, list[str]]:
    """
    Claude Code executes this step autonomously:
    - Searches for full business info (phone, hours, address, description)
    - Finds Unsplash images matching the business category
    Returns enriched business dict + list of image URLs.
    """
    hr()
    print("STEP 3 — Researching business info + images")
    print("  (Claude Code will search the web autonomously)")
    hr()

    # Check if Claude Code already wrote enriched data
    enriched_path = Path("enriched.json")
    images_path   = Path("images.json")

    if enriched_path.exists():
        business = json.loads(enriched_path.read_text())
        print(f"  ✅ Loaded enriched business data from enriched.json")
    else:
        print(f"  ℹ️  No enriched.json found — Claude Code should research:")
        print(f"     - Search: '{business['name']} {business['address']} Paris'")
        print(f"     - Find: phone, hours, description")
        print(f"     - Write results to enriched.json")

    images = []
    if images_path.exists():
        images = json.loads(images_path.read_text())
        print(f"  ✅ Loaded {len(images)} image URLs from images.json")
    else:
        print(f"  ℹ️  No images.json found — Claude Code should find 6 Unsplash images")
        print(f"     for category: {business.get('category','restaurant')}")
        print(f"     and write their URLs to images.json")

    return business, images

# ── Step 4: Design preferences ────────────────────────────────────────────────

THEME_OPTIONS = {
    "1": ("fresh",   "🌿 Fresh / Nature — florist, grocer, organic"),
    "2": ("warm",    "🔥 Warm / Terracotta — restaurant, bakery, café"),
    "3": ("mono",    "⬛ Mono / Minimalist — barber, tailor, repair"),
    "4": ("bold",    "💜 Bold / Dark — bar, nightlife"),
    "5": ("elegant", "✨ Elegant / Gold — luxury, spa, jewellery"),
}

def step_design(business: dict) -> tuple[str, str]:
    hr()
    print("STEP 4 — Design preferences")
    hr()

    # Suggest theme based on category
    from builder import CATEGORY_THEME
    suggested_key = CATEGORY_THEME.get(business.get("category",""), "warm")
    suggested_num = next((k for k,v in THEME_OPTIONS.items() if v[0]==suggested_key), "2")

    print("  Choose a colour theme:")
    for k, (_, label) in THEME_OPTIONS.items():
        marker = " ← suggested" if k == suggested_num else ""
        print(f"    {k}. {label}{marker}")

    raw = ask(f"  Theme [{suggested_num}]:") or suggested_num
    theme = THEME_OPTIONS.get(raw, THEME_OPTIONS[suggested_num])[0]
    print(f"  ✅ Theme: {theme}")

    details = ask("  Any specific details? (e.g. 'add a reservation button', or press Enter to skip):")
    return theme, details

# ── Step 5: Build ─────────────────────────────────────────────────────────────

def step_build(business: dict, theme: str, images: list[str]) -> str:
    hr()
    print("STEP 5 — Building the website")
    hr()
    from builder import build
    out_dir = build(business, theme_key=theme, images=images)
    print(f"  ✅ 4 pages generated in {out_dir}/")
    return out_dir

# ── Step 6: Preview ───────────────────────────────────────────────────────────

def step_preview(out_dir: str) -> subprocess.Popen:
    hr()
    print("STEP 6 — Local preview")
    hr()
    kill_port(8080)
    proc = subprocess.Popen(
        ["python3", "-m", "http.server", "8080", "--directory", out_dir],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1.2)
    url = "http://localhost:8080/index.html"
    print(f"  🌐 Preview running at: {url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    return proc

# ── Step 7: Deploy ────────────────────────────────────────────────────────────

def step_deploy(out_dir: str, business_name: str):
    hr()
    print("STEP 7 — Deploy to GitHub + Netlify")
    hr()
    safe = re.sub(r"[^a-z0-9]", "-", business_name.lower()).strip("-")

    # Copy site to repo root (adjust path if your repo structure differs)
    deploy_dir = Path("sites") / safe
    deploy_dir.mkdir(parents=True, exist_ok=True)

    cmds = [
        ["cp", "-r", f"{out_dir}/.", str(deploy_dir)],
        ["git", "add", "."],
        ["git", "commit", "-m", f"feat: add site for {business_name}"],
        ["git", "push", "origin", "main"],
    ]

    for cmd in cmds:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0 and cmd[0] != "cp":
            print(f"  ⚠️  {' '.join(cmd)}: {result.stderr.strip()}")
        else:
            print(f"  ✅ {' '.join(cmd[:2])}")

    # Netlify deploy
    print("\n  Deploying to Netlify...")
    netlify = subprocess.run(
        ["npx", "netlify", "deploy", "--prod", "--dir", str(deploy_dir)],
        capture_output=True, text=True
    )
    if netlify.returncode == 0:
        # Extract URL from output
        for line in netlify.stdout.splitlines():
            if "https://" in line:
                print(f"\n  🚀 LIVE URL: {line.strip()}")
    else:
        print(f"  ⚠️  Netlify deploy issue: {netlify.stderr[:200]}")
        print("  Try manually: npx netlify deploy --prod --dir", str(deploy_dir))

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "═"*55)
    print("  🏙️  SiteSnap Pipeline")
    print("═"*55)

    preview_proc = None
    try:
        # 1 — Prospect
        businesses = step_prospect()
        if not businesses:
            print("\n❌ No verified businesses found. Try again later.")
            return

        # 2 — Choose
        business = step_choose(businesses)

        # 3 — Research (Claude Code does this autonomously)
        business, images = step_research(business)

        # Pause for Claude Code to complete research if files aren't ready
        if not Path("enriched.json").exists() or not Path("images.json").exists():
            print("\n  ⏳ Waiting for Claude Code to finish research...")
            print("     (Claude Code: search for business info + images, write enriched.json + images.json)")
            ask("  Press Enter when research is complete...")
            business, images = step_research(business)

        # 4 — Design
        theme, details = step_design(business)
        if details:
            business["_details"] = details

        # 5 — Build
        out_dir = step_build(business, theme, images)

        # 6 — Preview
        preview_proc = step_preview(out_dir)

        confirm = ask("\n  Happy with the preview? (yes / no):").lower()
        if confirm not in ("yes","y","oui","o"):
            print("\n  ❌ Preview rejected — not deploying. Edit builder.py and re-run.")
            return

        # 7 — Deploy
        step_deploy(out_dir, business["name"])

        hr("═")
        print("  ✅ Pipeline complete!")
        hr("═")

    except KeyboardInterrupt:
        print("\n\n  Pipeline cancelled.")
    finally:
        if preview_proc:
            preview_proc.terminate()
            print("  Preview server stopped.")

if __name__ == "__main__":
    main()
