import csv
import re
from pathlib import Path

CSV_FILE = "businesses.csv"
OUTPUT_DIR = Path("sites")

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name}</title>
<style>
  body {{
    font-family: Georgia, 'Times New Roman', serif;
    background: #f7f5f2;
    color: #2b2b2b;
    margin: 0;
    padding: 0;
  }}
  header {{
    background: #1f2d24;
    color: #f7f5f2;
    padding: 3rem 1.5rem;
    text-align: center;
  }}
  header h1 {{
    margin: 0;
    font-size: 2.5rem;
    letter-spacing: 1px;
  }}
  header p {{
    margin-top: 0.5rem;
    font-size: 1.1rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #c9b896;
  }}
  main {{
    max-width: 600px;
    margin: 2.5rem auto;
    padding: 0 1.5rem;
  }}
  .card {{
    background: #ffffff;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  }}
  .card h2 {{
    margin-top: 0;
    font-size: 1.3rem;
    border-bottom: 1px solid #e0ddd6;
    padding-bottom: 0.5rem;
  }}
  .info-row {{
    margin: 1rem 0;
  }}
  .info-label {{
    font-weight: bold;
    color: #1f2d24;
    display: block;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }}
  footer {{
    text-align: center;
    padding: 1.5rem;
    font-size: 0.85rem;
    color: #888;
  }}
</style>
</head>
<body>
<header>
  <h1>{name}</h1>
  <p>{type}</p>
</header>
<main>
  <div class="card">
    <h2>Contact &amp; Location</h2>
    <div class="info-row">
      <span class="info-label">Address</span>
      {address}, {city}
    </div>
    <div class="info-row">
      <span class="info-label">Phone</span>
      {phone}
    </div>
  </div>
</main>
<footer>
  &copy; {name}
</footer>
</body>
</html>
"""


def slugify(name):
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return slug.strip("_")


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            html = PAGE_TEMPLATE.format(
                name=row["name"],
                type=row["type"].title(),
                address=row["address"],
                city=row["city"],
                phone=row["phone"],
            )
            filename = f"{slugify(row['name'])}.html"
            path = OUTPUT_DIR / filename
            path.write_text(html, encoding="utf-8")
            print(f"Generated {path}")


if __name__ == "__main__":
    main()
