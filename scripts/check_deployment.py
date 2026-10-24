"""Check hosted configuration without printing secrets or making network calls."""

import argparse
import os
import sys
from pathlib import Path

from dotenv import dotenv_values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, help="Read an explicit production env file instead of process variables")
    args = parser.parse_args()
    if args.env_file is not None:
        if not args.env_file.is_file():
            parser.error("The specified environment file does not exist")
        values = dotenv_values(args.env_file)
    else:
        values = dict(os.environ)

    # Never load local development credentials while checking hosted settings.
    os.environ["VERCEL"] = "1"
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from database import DatabaseConfigurationError, database_url

    problems = []
    try:
        url = database_url(values.get("DATABASE_URL"), production=True)
        if (url.host or "").lower() == "host" or url.username == "USER":
            problems.append("DATABASE_URL: replace the example with a hosted database connection URL")
    except DatabaseConfigurationError as error:
        problems.append(str(error))
    for key in ("TWELVE_DATA_API_KEY", "GOLD_API_KEY"):
        if not (values.get(key) or "").strip():
            problems.append(f"{key}: missing")
    if len((values.get("CRON_SECRET") or "").strip()) < 16:
        problems.append("CRON_SECRET: set a random secret of at least 16 characters")
    if problems:
        for problem in problems:
            print(f"FAIL: {problem}")
        return 1
    print("PASS: hosted database URL, API keys and Cron secret are configured (connectivity is not checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
