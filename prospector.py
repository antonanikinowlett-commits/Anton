import csv

CSV_FILE = "businesses.csv"


def main():
    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            print(f"{row['name']} ({row['type'].title()})")
            print(f"  Address: {row['address']}, {row['city']}")
            print(f"  Phone:   {row['phone']}")
            print()


if __name__ == "__main__":
    main()
