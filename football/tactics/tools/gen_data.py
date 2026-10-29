#!/usr/bin/env python3
"""Generates tactics/data (formations, teams, index). Run from the football/ folder:
    python3 tactics/tools/gen_data.py
The generated JSON is committed; this script is only a convenience."""
import json
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

FORMATIONS = {
    "4-4-2": [
        ("GK", 0.03, 0.50),
        ("LB", 0.22, 0.12), ("CB", 0.19, 0.37), ("CB", 0.19, 0.63), ("RB", 0.22, 0.88),
        ("LM", 0.43, 0.10), ("CM", 0.40, 0.38), ("CM", 0.40, 0.62), ("RM", 0.43, 0.90),
        ("ST", 0.62, 0.39), ("ST", 0.62, 0.61),
    ],
    "4-3-3": [
        ("GK", 0.03, 0.50),
        ("LB", 0.23, 0.12), ("CB", 0.19, 0.37), ("CB", 0.19, 0.63), ("RB", 0.23, 0.88),
        ("CDM", 0.35, 0.50), ("CM", 0.45, 0.28), ("CM", 0.45, 0.72),
        ("LW", 0.66, 0.10), ("ST", 0.71, 0.50), ("RW", 0.66, 0.90),
    ],
    "3-5-2": [
        ("GK", 0.03, 0.50),
        ("CB", 0.20, 0.24), ("CB", 0.17, 0.50), ("CB", 0.20, 0.76),
        ("LWB", 0.40, 0.06), ("CM", 0.42, 0.30), ("CDM", 0.34, 0.50), ("CM", 0.42, 0.70), ("RWB", 0.40, 0.94),
        ("ST", 0.63, 0.39), ("ST", 0.63, 0.61),
    ],
    "4-2-3-1": [
        ("GK", 0.03, 0.50),
        ("LB", 0.22, 0.12), ("CB", 0.19, 0.37), ("CB", 0.19, 0.63), ("RB", 0.22, 0.88),
        ("CDM", 0.34, 0.38), ("CDM", 0.34, 0.62),
        ("LW", 0.55, 0.11), ("CAM", 0.54, 0.50), ("RW", 0.55, 0.89),
        ("ST", 0.69, 0.50),
    ],
}

# Stat offsets relative to the team strength, per role family.
PROFILES = {
    "GK": dict(pace=-20, acceleration=-18, stamina=-12, agility=0, strength=-6, passing=-14, vision=-12,
               shooting=-48, dribbling=-45, control=-18, tackling=-48, positioning=6, aggression=-28,
               goalkeeping=12, reflexes=10),
    "CB": dict(pace=-8, acceleration=-8, stamina=0, agility=-10, strength=10, passing=-6, vision=-8,
               shooting=-24, dribbling=-18, control=-8, tackling=11, positioning=6, aggression=8),
    "FB": dict(pace=5, acceleration=3, stamina=8, agility=0, strength=-2, passing=0, vision=-2,
               shooting=-14, dribbling=-2, control=0, tackling=4, positioning=0, aggression=0),
    "CDM": dict(pace=-4, acceleration=-5, stamina=6, agility=-4, strength=6, passing=2, vision=0,
                shooting=-10, dribbling=-6, control=0, tackling=10, positioning=4, aggression=6),
    "CM": dict(pace=0, acceleration=0, stamina=6, agility=0, strength=0, passing=6, vision=4,
               shooting=-2, dribbling=2, control=4, tackling=0, positioning=2, aggression=0),
    "CAM": dict(pace=0, acceleration=2, stamina=-2, agility=6, strength=-8, passing=8, vision=10,
                shooting=4, dribbling=8, control=8, tackling=-14, positioning=4, aggression=-8),
    "WIDE": dict(pace=10, acceleration=10, stamina=2, agility=8, strength=-10, passing=2, vision=0,
                 shooting=0, dribbling=10, control=4, tackling=-16, positioning=0, aggression=-8),
    "ST": dict(pace=2, acceleration=4, stamina=-2, agility=0, strength=4, passing=-4, vision=-2,
               shooting=12, dribbling=2, control=4, tackling=-22, positioning=10, aggression=0),
}
FAMILY = {"GK": "GK", "CB": "CB", "LB": "FB", "RB": "FB", "LWB": "FB", "RWB": "FB", "CDM": "CDM",
          "CM": "CM", "CAM": "CAM", "LM": "WIDE", "RM": "WIDE", "LW": "WIDE", "RW": "WIDE",
          "CF": "ST", "ST": "ST"}
HEIGHT = {"GK": 190, "CB": 186, "FB": 177, "CDM": 181, "CM": 179, "CAM": 176, "WIDE": 175, "ST": 183}

SURNAMES = ["Alder", "Bishop", "Calder", "Dorsey", "Eames", "Falk", "Garrow", "Hale", "Ibsen", "Jarvis",
            "Kesler", "Lund", "Marsh", "Nolan", "Ortega", "Pryce", "Quill", "Rafferty", "Stroud", "Tamsin",
            "Ulmer", "Vance", "Wick", "Yardley", "Zorn", "Ashby", "Brandt", "Corbin", "Dunmore", "Ellery",
            "Fenwick", "Gage", "Harlow", "Irving", "Jessop", "Kirby", "Lowell", "Mercer", "Novak", "Oakes",
            "Paxton", "Rowan", "Sloane", "Tilden", "Upton", "Voss", "Weston", "Yates", "Zeller", "Abbot",
            "Baxter", "Crane", "Drummond", "Estes", "Forbes", "Grady", "Holt", "Ives", "Joss", "Keane",
            "Larkin", "Moss", "Neville", "Orr", "Pike", "Rhodes", "Sutton", "Thorne", "Vaughn", "Wilder"]
INITIALS = "ABCDEFGHIJKLMNOPRSTW"

TEAMS = [
    dict(id="reds", name="Red Rovers", short="RED", primary="#d62828", secondary="#ffffff", gk="#2dd4bf",
         formation="4-4-2", strength=70, pressing=0.60, line_height=0.55, width=0.55, tempo=0.55,
         mentality=0.55, corner="far_post", fk="direct"),
    dict(id="blues", name="Blue Rangers", short="BLU", primary="#1d4ed8", secondary="#ffffff", gk="#f59e0b",
         formation="4-3-3", strength=74, pressing=0.70, line_height=0.65, width=0.65, tempo=0.60,
         mentality=0.60, corner="near_post", fk="direct"),
    dict(id="greens", name="Green Hornets", short="GRN", primary="#15803d", secondary="#fde047", gk="#f472b6",
         formation="4-2-3-1", strength=67, pressing=0.45, line_height=0.45, width=0.50, tempo=0.45,
         mentality=0.45, corner="short", fk="direct"),
    dict(id="yellows", name="Yellow Hammers", short="YEL", primary="#facc15", secondary="#111827", gk="#7c3aed",
         formation="3-5-2", strength=64, pressing=0.50, line_height=0.40, width=0.70, tempo=0.65,
         mentality=0.50, corner="far_post", fk="direct"),
    dict(id="blacks", name="Black Knights", short="BLK", primary="#1f2937", secondary="#f3f4f6", gk="#fb923c",
         formation="4-4-2", strength=78, pressing=0.55, line_height=0.60, width=0.45, tempo=0.50,
         mentality=0.65, corner="near_post", fk="direct"),
    dict(id="oranges", name="Orange Orbit", short="ORG", primary="#f97316", secondary="#1e3a8a", gk="#22d3ee",
         formation="4-3-3", strength=61, pressing=0.40, line_height=0.35, width=0.55, tempo=0.40,
         mentality=0.35, corner="short", fk="direct"),
]

BENCH_ROLES = ["GK", "CB", "LB", "RB", "CM", "CAM", "LW", "ST"]


def clamp(v, lo, hi):
    return max(lo, min(hi, int(round(v))))


def make_player(rng, team_id, number, role, strength, starter, used_names):
    fam = FAMILY[role]
    prof = PROFILES[fam]
    quality = rng.gauss(0, 4) + (3 if starter else -6)
    stats = {}
    for k in ("pace", "acceleration", "stamina", "agility", "strength", "passing", "vision", "shooting",
              "dribbling", "control", "tackling", "positioning", "aggression", "goalkeeping", "reflexes"):
        if k in ("goalkeeping", "reflexes") and fam != "GK":
            stats[k] = clamp(rng.uniform(12, 28), 10, 30)
            continue
        v = strength + prof[k] + quality + rng.gauss(0, 4)
        if fam == "GK" and k in ("goalkeeping", "reflexes", "positioning"):
            v = clamp(v, 55, 92)
        elif fam == "GK":
            v = clamp(v, 20, 70)
        else:
            v = clamp(v, 38, 92)
        stats[k] = v
    while True:
        name = "%s. %s" % (rng.choice(INITIALS), rng.choice(SURNAMES))
        if name not in used_names:
            used_names.add(name)
            break
    left = role in ("LB", "LWB", "LM", "LW")
    foot = "L" if (left and rng.random() < 0.8) or rng.random() < 0.15 else "R"
    return {
        "id": "%s_%d" % (team_id, number), "name": name, "number": number, "role": role,
        "foot": foot, "height_cm": int(rng.gauss(HEIGHT[fam], 4)), "stats": stats,
    }


def make_team(t, seed):
    rng = random.Random(seed)
    slots = FORMATIONS[t["formation"]]
    used = set()
    players = []
    for i, (role, _x, _y) in enumerate(slots):
        players.append(make_player(rng, t["id"], i + 1, role, t["strength"], True, used))
    for j, role in enumerate(BENCH_ROLES):
        players.append(make_player(rng, t["id"], 12 + j, role, t["strength"], False, used))
    xi = players[:11]
    outfield = xi[1:]
    pen = max(outfield, key=lambda p: p["stats"]["shooting"] * 0.7 + p["stats"]["control"] * 0.3)
    fk = max(outfield, key=lambda p: p["stats"]["shooting"] * 0.4 + p["stats"]["passing"] * 0.4 + p["stats"]["vision"] * 0.2)
    cor = max([p for p in outfield if FAMILY[p["role"]] in ("WIDE", "FB", "CM", "CAM")],
              key=lambda p: p["stats"]["passing"] * 0.6 + p["stats"]["vision"] * 0.4)
    cap = max([p for p in outfield if FAMILY[p["role"]] in ("CB", "CDM", "CM")],
              key=lambda p: p["stats"]["positioning"] + p["stats"]["aggression"] * 0.3)
    return {
        "id": t["id"], "name": t["name"], "short_name": t["short"],
        "colors": {"primary": t["primary"], "secondary": t["secondary"], "goalkeeper": t["gk"]},
        "tactics": {
            "formation": t["formation"], "pressing": t["pressing"], "line_height": t["line_height"],
            "width": t["width"], "tempo": t["tempo"], "mentality": t["mentality"],
            "captain_id": cap["id"], "penalty_taker_id": pen["id"], "free_kick_taker_id": fk["id"],
            "corner_taker_id": cor["id"], "corner_routine": t["corner"], "free_kick_routine": t["fk"],
        },
        "players": players,
        "starting_xi": [p["id"] for p in xi],
    }


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


def main():
    for fid, slots in FORMATIONS.items():
        write(os.path.join(OUT, "formations", fid + ".json"), {
            "id": fid, "name": fid,
            "slots": [{"role": r, "x": x, "y": y} for r, x, y in slots],
        })
    for i, t in enumerate(TEAMS):
        write(os.path.join(OUT, "teams", t["id"] + ".json"), make_team(t, 1000 + i * 17))
    write(os.path.join(OUT, "index.json"),
          {"teams": [t["id"] for t in TEAMS], "formations": list(FORMATIONS.keys())})


if __name__ == "__main__":
    main()
