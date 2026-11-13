#!/usr/bin/env python3
"""
Run the RateIt database test suite against a real PostgreSQL server.

It stands up a throwaway cluster, applies every migration and the seed file,
then runs supabase/tests/10_acceptance.sql — which exercises the acceptance
criteria from the brief with Row Level Security actually switched on, acting
as each account in turn.

Usage:
    pip install pgserver
    python3 supabase/tests/run_local.py

Any failure raises immediately and the script exits non-zero.
"""
import glob
import os
import shutil
import subprocess
import sys

try:
    import pgserver
except ImportError:  # pragma: no cover
    sys.exit("This script needs pgserver. Install it with:  pip install pgserver")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PGDATA = os.environ.get("RATEIT_TEST_PGDATA", "/tmp/simple-pgtest/data")

shutil.rmtree(os.path.dirname(PGDATA), ignore_errors=True)
os.makedirs(os.path.dirname(PGDATA), exist_ok=True)

db = pgserver.get_server(PGDATA, cleanup_mode="stop")
db.ensure_postgres_running()
uri = db.get_uri()
psql = os.path.join(os.path.dirname(pgserver.__file__), "pginstall", "bin", "psql")


def run(path: str) -> None:
    result = subprocess.run(
        [psql, uri, "-v", "ON_ERROR_STOP=1", "-q", "-f", path],
        capture_output=True,
        text=True,
    )
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stdout.write(result.stderr)
    if result.returncode != 0:
        print(f"\n>>> FAILED on {os.path.basename(path)}")
        sys.exit(1)


try:
    print("== local auth harness ==")
    run(os.path.join(HERE, "00_harness_auth.sql"))

    print("== migrations ==")
    for migration in sorted(glob.glob(os.path.join(ROOT, "supabase", "migrations", "*.sql"))):
        print("   ", os.path.basename(migration))
        run(migration)

    print("== seed ==")
    run(os.path.join(ROOT, "supabase", "seed.sql"))

    print("== acceptance tests ==")
    run(os.path.join(HERE, "10_acceptance.sql"))

    print("\nALL TESTS PASSED")
finally:
    db.cleanup()
