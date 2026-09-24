"""Run against an explicitly named disposable database in the local Supabase container."""
import concurrent.futures
import json
import re
import subprocess
import sys
import threading
from pathlib import Path

database = sys.argv[1]
if not re.fullmatch(r"tharwati_slice3_[0-9]+", database):
    raise SystemExit("Refusing a database outside the disposable Slice 3 namespace")


def query(sql):
    result = subprocess.run(
        ["docker", "exec", "-i", "supabase_db_Tharwati", "psql", "-U",
         "supabase_admin", "-d", database, "-XAtq", "-v", "ON_ERROR_STOP=1"],
        input=sql, text=True, capture_output=True, check=True,
    )
    return result.stdout.strip()


source = Path(__file__).with_name("account_create_idempotency.sql").read_text()
fixtures = source[source.index("-- Synthetic fixtures"):source.index("create temporary table")]
query(fixtures)
calls = re.findall(r"\('([^']+)',\$call\$(.*?)\$call\$\)", source)
assert len(calls) == 5

for operation, statement in calls:
    barrier = threading.Barrier(2)

    def attempt():
        barrier.wait()
        output = query(
            "begin; select set_config('request.jwt.claim.sub',"
            "'71000000-0000-4000-8000-000000000001',true); set local role authenticated; "
            + statement + "; select pg_sleep(0.5); commit;"
        )
        return json.loads(next(line for line in output.splitlines() if line.startswith("{")))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(r["replayed"] for r in results) == [False, True], operation
    assert {k: v for k, v in results[0].items() if k != "replayed"} == {
        k: v for k, v in results[1].items() if k != "replayed"
    }, operation
    print(f"PASS concurrent {operation}: one commit, one identical replay")

assert query("select count(*) from private.account_record_mutation_receipts") == "5"
assert query("select count(*) from public.metal_purchases") == "1"
assert query("select quantity::text || ':' || total_cost_basis::text from public.holdings").split(":") == ["2.0000000000", "20.0000000000"]
assert query("select count(*) from public.account_valuations") == "2"
assert query("select count(*) from public.financial_accounts") == "10"
print("PASS concurrent business row counts and quantity/basis")
