#!/usr/bin/env python3
"""
HTTP integration test for RateIt.

Stands up a real PostgreSQL server and a real PostgREST instance on top of the
migrations, then drives the exact endpoints the React app calls — with JWT
claims — and checks the results. This is what caught a stale column reference in
get_user_stats() that the SQL-only suite could not see.

Requirements:
    pip install pgserver

    A PostgREST binary, from
    https://github.com/PostgREST/postgrest/releases
    (postgrest-v16.5-linux-static-x86-64.tar.xz and similar). Point at it with
    the POSTGREST_BIN environment variable, or leave it at ./postgrest.

Usage:
    POSTGREST_BIN=/path/to/postgrest python3 supabase/tests/integration_http.py
"""

import base64
import glob
import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

import pgserver

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PGDATA = os.environ.get("RATEIT_TEST_PGDATA", "/tmp/simple-pgtest-http/data")
SECRET = "super-secret-test-key-that-is-long-enough-for-hs256"
POSTGREST_BIN = os.environ.get("POSTGREST_BIN", "./postgrest")
PORT = 3021
BASE = f"http://127.0.0.1:{PORT}"

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
MOD = "33333333-3333-4333-8333-333333333333"

failures = []


def check(cond, msg):
    if cond:
        print(f"  ok  {msg}")
    else:
        print(f"  FAIL  {msg}")
        failures.append(msg)


def b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def make_jwt(payload):
    header = {"alg": "HS256", "typ": "JWT"}
    seg = (
        b64(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + b64(json.dumps(payload, separators=(",", ":")).encode())
    )
    return seg + "." + b64(hmac.new(SECRET.encode(), seg.encode(), hashlib.sha256).digest())


def jwt_for(sub=None, role="authenticated"):
    payload = {"role": role, "exp": int(time.time()) + 3600}
    if sub:
        payload["sub"] = sub
    return make_jwt(payload)


def req(method, path, token, body=None, prefer=None):
    path = path.replace("/rest/v1", "", 1)  # Supabase's gateway prefix
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("apikey", token)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Content-Type", "application/json")
    r.add_header("Accept", "application/json")
    if prefer:
        r.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, raw


shutil.rmtree(os.path.dirname(PGDATA), ignore_errors=True)
os.makedirs(os.path.dirname(PGDATA), exist_ok=True)
db = pgserver.get_server(PGDATA, cleanup_mode="stop")
db.ensure_postgres_running()
uri = db.get_uri()
psql_bin = os.path.join(os.path.dirname(pgserver.__file__), "pginstall", "bin", "psql")


def psql(path):
    r = subprocess.run(
        [psql_bin, uri, "-v", "ON_ERROR_STOP=1", "-q", "-f", path],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(r.stdout, r.stderr)
        sys.exit(f"psql failed on {path}")


psql(f"{ROOT}/supabase/tests/00_harness_auth.sql")
for f in sorted(glob.glob(f"{ROOT}/supabase/migrations/*.sql")):
    psql(f)
psql(f"{ROOT}/supabase/seed.sql")

setup = f"""
insert into auth.users (id, email, raw_user_meta_data) values
  ('{ALICE}','alice@example.com','{{"username":"alice","display_name":"Alice"}}'),
  ('{BOB}','bob@example.com','{{"username":"bob","display_name":"Bob"}}'),
  ('{MOD}','mod@example.com','{{"username":"moderator","display_name":"Mod"}}')
on conflict (id) do nothing;
update public.profiles set role='moderator' where id='{MOD}';
"""
setup_path = os.path.join(os.path.dirname(PGDATA), "setup.sql")
open(setup_path, "w").write(setup)
psql(setup_path)
print("database ready")

env = dict(os.environ)
env.update({
    "PGRST_DB_URI": uri, "PGRST_DB_SCHEMAS": "public", "PGRST_DB_ANON_ROLE": "anon",
    "PGRST_JWT_SECRET": SECRET, "PGRST_SERVER_PORT": str(PORT),
    "PGRST_SERVER_HOST": "127.0.0.1", "PGRST_LOG_LEVEL": "error",
})
proc = subprocess.Popen(
    [POSTGREST_BIN], env=env,
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
)

anon, alice, bob, mod = jwt_for(role="anon"), jwt_for(ALICE), jwt_for(BOB), jwt_for(MOD)

ready = False
for _ in range(60):
    try:
        with urllib.request.urlopen(BASE + "/", timeout=2) as resp:
            if resp.status == 200:
                ready = True
                break
    except Exception:
        time.sleep(0.5)
if not ready:
    proc.terminate()
    sys.exit("PostgREST did not start:\n" + (proc.stdout.read() if proc.stdout else ""))
print("postgrest ready\n")

try:
    # ------------------------------------------------------------------ feed
    print("feed + search")
    st, rows = req("POST", "/rest/v1/rpc/list_posts", anon, {
        "p_sort": "latest", "p_category": None, "p_author": None,
        "p_search": None, "p_limit": 20, "p_offset": 0})
    check(st == 200 and isinstance(rows, list) and len(rows) >= 7, "list_posts with p_search returns the feed")
    check(all("rating_avg" in r and "author_username" in r for r in rows), "feed rows carry aggregates and author")

    st, hits = req("POST", "/rest/v1/rpc/list_posts", anon, {
        "p_sort": "latest", "p_category": None, "p_author": None,
        "p_search": "Dark mode", "p_limit": 20, "p_offset": 0})
    check(st == 200 and len(hits) == 1, "search by title works over HTTP")

    st, none = req("POST", "/rest/v1/rpc/list_posts", anon, {
        "p_sort": "latest", "p_category": None, "p_author": None,
        "p_search": "zzzznothing", "p_limit": 20, "p_offset": 0})
    check(st == 200 and none == [], "a search with no matches returns an empty list")

    # -------------------------------------------------------- rating via RPC
    print("\nrating shortcut (rate_post)")
    st, made = req("POST", "/rest/v1/posts", alice, {
        "author_id": ALICE, "title": "Post for the rating RPC", "body": "Body.", "category": "Opinion",
    }, prefer="return=representation")
    check(st == 201, "Alice can publish")
    post_id = made[0]["id"]

    st, r = req("POST", "/rest/v1/rpc/rate_post", bob, {"p_post_id": post_id, "p_score": 10})
    check(st == 200 and r and r[0]["my_score"] == 10, "Bob's +10 is saved and echoed back")
    check(r and r[0]["rating_count"] == 1, "the returned aggregate shows 1 rating")
    check(r and float(r[0]["rating_avg"]) == 10.0, "the returned average is 10.0")

    st, r = req("POST", "/rest/v1/rpc/rate_post", bob, {"p_post_id": post_id, "p_score": 10})
    check(st == 200 and r[0]["rating_count"] == 1, "tapping +10 twice does not duplicate the rating")

    st, mine = req("GET", f"/rest/v1/ratings?post_id=eq.{post_id}&user_id=eq.{BOB}&select=score", bob)
    check(mine == [{"score": 10}], "exactly one rating row, with score 10")

    st, r = req("POST", "/rest/v1/rpc/rate_post", bob, {"p_post_id": post_id, "p_score": -5})
    check(st == 200 and r[0]["my_score"] == -5, "a previous -5 is updated to a new value")
    st, r = req("POST", "/rest/v1/rpc/rate_post", bob, {"p_post_id": post_id, "p_score": 10})
    check(st == 200 and r[0]["my_score"] == 10, "a previous rating changes to +10")
    check(r and r[0]["rating_count"] == 1, "still a single rating row after the change")

    st, agg = req("GET", f"/rest/v1/posts?id=eq.{post_id}&select=rating_count,rating_avg", anon)
    check(agg[0]["rating_count"] == 1 and float(agg[0]["rating_avg"]) == 10.0,
          "the stored aggregate matches the single rating")

    # third account changes the average
    st, r = req("POST", "/rest/v1/rpc/rate_post", mod, {"p_post_id": post_id, "p_score": 0})
    check(st == 200 and r[0]["rating_count"] == 2, "a second account raises the count to 2")
    check(float(r[0]["rating_avg"]) == 5.0, "average becomes 5.0 ((10+0)/2)")

    # remove
    st, r = req("POST", "/rest/v1/rpc/remove_my_rating", mod, {"p_post_id": post_id})
    check(st == 200 and r[0]["my_score"] is None, "remove_my_rating clears the caller's rating")
    check(r[0]["rating_count"] == 1, "count drops back to 1")

    # ------------------------------------------------------------------ guards
    print("\nrating guards")
    st, bad = req("POST", "/rest/v1/rpc/rate_post", alice, {"p_post_id": post_id, "p_score": 10})
    check(st in (400, 401, 403, 409), "a user cannot rate their own post")

    st, bad = req("POST", "/rest/v1/rpc/rate_post", bob, {"p_post_id": post_id, "p_score": 11})
    check(st in (400, 409), "a score of 11 is rejected")

    st, bad = req("POST", "/rest/v1/rpc/rate_post", bob, {"p_post_id": post_id, "p_score": -6})
    check(st in (400, 409), "a score of -6 is rejected")

    st, bad = req("POST", "/rest/v1/rpc/rate_post", anon, {"p_post_id": post_id, "p_score": 10})
    check(st in (401, 403), "a logged-out visitor cannot rate")

    st, bad = req("POST", "/rest/v1/rpc/rate_post", bob, {
        "p_post_id": post_id, "p_score": 10, "user_id": ALICE})
    check(st == 200 or st in (400, 404), "a stray user_id in the body is ignored by the function")

    # The direct insert path is guarded by RLS. Attribute it to MOD — not the
    # post's author, so the self-rating trigger is not what stops it.
    st, bad = req("POST", "/rest/v1/ratings", bob, {
        "post_id": post_id, "user_id": MOD, "score": 10}, prefer="return=representation")
    check(st in (401, 403, 409), "a user cannot insert a rating attributed to someone else")
    st, none = req("GET", f"/rest/v1/ratings?post_id=eq.{post_id}&user_id=eq.{MOD}&select=id", mod)
    check(none == [], "no rating was created for the other user")

    st, patched = req("PATCH", f"/rest/v1/ratings?post_id=eq.{post_id}&user_id=eq.{MOD}",
                      bob, {"score": -5}, prefer="return=representation")
    check(patched == [], "a user cannot modify another user's rating")

    # -------------------------------------------------------------- breakdown
    print("\nbreakdown + profile stats")
    st, br = req("POST", "/rest/v1/rpc/get_rating_breakdown", anon, {"p_post_id": post_id})
    check(st == 200 and br and "score" in br[0], "get_rating_breakdown returns a score column")

    st, us = req("POST", "/rest/v1/rpc/get_user_stats", anon, {"p_user": ALICE})
    check(st == 200 and isinstance(us, list) and us and "posts_count" in us[0],
          "get_user_stats works")
    check(st == 200 and us[0]["posts_count"] >= 1, "get_user_stats counts Alice's posts")
    st, ub = req("POST", "/rest/v1/rpc/get_user_stats", anon, {"p_user": BOB})
    check(st == 200 and ub[0]["ratings_given"] >= 1, "get_user_stats counts ratings given")

    # ------------------------------------------------------------ ownership
    print("\npost ownership")
    st, other = req("POST", "/rest/v1/posts", bob, {
        "author_id": BOB, "title": "Bob's post", "body": "Body.", "category": "Other",
    }, prefer="return=representation")
    bob_post = other[0]["id"]

    st, patched = req("PATCH", f"/rest/v1/posts?id=eq.{bob_post}", alice,
                      {"title": "hijacked"}, prefer="return=representation")
    check(patched == [], "another user's edit affects no rows")
    st, still = req("GET", f"/rest/v1/posts?id=eq.{bob_post}&select=title", anon)
    check(still[0]["title"] == "Bob's post", "the post is unchanged")

    st, upd = req("PATCH", f"/rest/v1/posts?id=eq.{bob_post}", bob,
                  {"title": "Bob's edited post", "body": "Edited body.", "category": "Idea"},
                  prefer="return=representation")
    check(st == 200 and upd[0]["title"] == "Bob's edited post", "the owner can edit their own post")
    check(upd[0]["category"] == "Idea", "the category change persists")

    st, forged = req("PATCH", f"/rest/v1/posts?id=eq.{bob_post}", bob,
                     {"rating_sum": 9999, "rating_count": 9999}, prefer="return=representation")
    check(forged and forged[0]["rating_sum"] != 9999, "an owner cannot forge their own aggregate")

    st, dele = req("DELETE", f"/rest/v1/posts?id=eq.{bob_post}", alice, prefer="return=representation")
    check(dele == [], "another user cannot delete the post")

    st, dele = req("DELETE", f"/rest/v1/posts?id=eq.{bob_post}", bob, prefer="return=representation")
    check(st in (200, 204), "the owner can delete their own post")
    st, gone = req("GET", f"/rest/v1/posts?id=eq.{bob_post}&select=id", anon)
    check(gone == [], "the deleted post is gone")

    # ------------------------------------------------------------ reporting
    print("\nreports and moderation")
    st, _ = req("POST", "/rest/v1/reports", bob, {
        "reporter_id": BOB, "target_type": "post", "target_id": post_id, "reason": "spam"})
    check(st in (200, 201), "a signed-in user can report a post")
    st, dup = req("POST", "/rest/v1/reports", bob, {
        "reporter_id": BOB, "target_type": "post", "target_id": post_id, "reason": "spam"})
    check(st in (401, 403, 409), "a duplicate report by the same user is rejected")
    st, mine = req("GET", "/rest/v1/reports?select=id", alice)
    check(mine == [], "another user cannot see the report")
    st, queue = req("GET", "/rest/v1/reports?select=id", mod)
    check(len(queue) == 1, "a moderator sees the report queue")

    st, _ = req("PATCH", "/rest/v1/reports?target_id=eq." + post_id, mod,
                {"status": "resolved"}, prefer="return=representation")
    check(st in (200, 204), "a moderator can resolve a report")

    st, hide = req("PATCH", f"/rest/v1/posts?id=eq.{post_id}", mod,
                   {"status": "hidden"}, prefer="return=representation")
    check(hide and hide[0]["status"] == "hidden", "a moderator can hide content")
    st, rows = req("POST", "/rest/v1/rpc/list_posts", anon, {
        "p_sort": "latest", "p_category": None, "p_author": None,
        "p_search": None, "p_limit": 100, "p_offset": 0})
    check(all(r["id"] != post_id for r in rows), "hidden content leaves the public feed")

    st, esc = req("PATCH", f"/rest/v1/profiles?id=eq.{ALICE}", alice, {"role": "moderator"},
                  prefer="return=representation")
    check(st in (400, 401, 403, 409), "a user cannot promote themselves")

finally:
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
    db.cleanup()

print()
if failures:
    print(f"{len(failures)} CHECK(S) FAILED")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("ALL INTEGRATION CHECKS PASSED")
