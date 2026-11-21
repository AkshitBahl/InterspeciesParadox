"""python -m app.seed [--reset] [--no-demo]

Safe to run many times: rows that already exist are kept (use --reset to start over).
"""

import argparse

from app.db.session import SessionLocal
from app.seed.loader import DEMO_PASSWORD, run


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Interspecies Paradox database.")
    parser.add_argument("--reset", action="store_true", help="delete all data first")
    parser.add_argument("--no-demo", action="store_true", help="only species, map and users (no demo conflicts)")
    args = parser.parse_args()
    with SessionLocal() as db:
        counts = run(db, with_demo=not args.no_demo, do_reset=args.reset)
    print("Seeded:", ", ".join(f"{v} {k}" for k, v in counts.items()))
    print(f"Demo login: lina@example.org / {DEMO_PASSWORD} (also jonas, mei, rafael, noor, ops, admin)")


if __name__ == "__main__":
    main()
