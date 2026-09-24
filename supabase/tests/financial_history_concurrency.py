"""Lock-ordered integration tests; only accepts a disposable immutability DB."""
import concurrent.futures
import re
import subprocess
import sys
import time
from pathlib import Path

database = sys.argv[1]
if not re.fullmatch(r"tharwati_immutability_[0-9]+", database):
    raise SystemExit("Refusing a database outside the disposable immutability namespace")
command = ["docker", "exec", "-i", "supabase_db_Tharwati", "psql", "-U",
           "supabase_admin", "-d", database, "-XAtq", "-v", "ON_ERROR_STOP=1"]
owner = "91000000-0000-4000-8000-000000000001"
account = "92000000-0000-4000-8000-000000000001"
auth = f"select set_config('request.jwt.claim.sub','{owner}',false);"


def query(sql, check=True):
    result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=20)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result


def held_transaction(statement):
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, bufsize=1)
    process.stdin.write("set statement_timeout='15s'; begin; " + auth + statement
                        + "; select 'IMMUTABILITY_READY';\n")
    process.stdin.flush()
    while True:
        line = process.stdout.readline()
        if line.strip() == "IMMUTABILITY_READY":
            return process
        if not line:
            raise AssertionError(process.stderr.read())


def race(first, second, expected_error=None):
    held = held_transaction(first)
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(query, "set statement_timeout='15s'; "
                                 "set application_name='immutability_waiter'; "
                                 + auth + second, False)
            deadline = time.monotonic() + 10
            while True:
                waiting = query("select exists(select 1 from pg_stat_activity where "
                                "application_name='immutability_waiter' and "
                                "wait_event_type='Lock');").stdout.strip()
                if waiting == "t":
                    break
                if pending.done() or time.monotonic() > deadline:
                    raise AssertionError("Expected competing operation to wait on a database lock")
                time.sleep(0.05)
            held.stdin.write("commit;\n")
            held.stdin.close()
            held.wait(timeout=10)
            assert held.returncode == 0, held.stderr.read()
            result = pending.result(timeout=15)
            if expected_error:
                assert result.returncode != 0 and expected_error in result.stderr, result
            else:
                assert result.returncode == 0, result.stderr
    finally:
        if held.poll() is None:
            held.stdin.write("rollback;\n")
            held.stdin.close()
            held.wait(timeout=20)


source = Path(__file__).with_name("financial_history_immutability.sql").read_text()
fixtures = source.split("-- BEGIN FIXTURES")[1].split("-- END FIXTURES")[0]
query(fixtures)
try:
    # First history commits while an account UPDATE waits: reject all three fields.
    for index, assignment in enumerate(["opening_balance=2000", "currency_code='EUR'",
                                       "account_type_code='other'"], 1):
        target = f"92000000-0000-4000-8001-{index:012d}"
        query(f"insert into public.financial_accounts(id,user_id,account_type_code,name,"
              f"currency_code,opening_balance) values('{target}','{owner}','cash',"
              f"'Race {index}','USD',1000);")
        race(f"set local role authenticated; select public.add_account_record('income',"
             f"'{target}',null,10,null,now(),'Salary',null)",
             f"set role authenticated; update public.financial_accounts set {assignment} "
             f"where id='{target}';", "cannot be changed")
        print("PASS first-history commit vs account edit:", assignment)

    # Edit wins first: the waiting supported writer must validate/use the new currency.
    target = "92000000-0000-4000-8000-000000000005"
    race(f"set local role authenticated; update public.financial_accounts set "
         f"currency_code='EUR' where id='{target}'",
         f"set role authenticated; select public.add_account_record('income','{target}',"
         "null,10,null,now(),'Salary',null);")
    assert query(f"select bool_and(t.transaction_currency_code='EUR') "
                 f"from public.financial_transactions t join public.transaction_entries e "
                 f"on e.transaction_id=t.id where e.account_id='{target}';").stdout.strip() == "t"
    print("PASS pristine currency edit vs first posting: writer uses committed currency")

    def drafts(index):
        parent = f"94000000-0000-4000-8001-{index:012d}"
        destination = f"94000000-0000-4000-8002-{index:012d}"
        entry = f"95000000-0000-4000-8001-{index:012d}"
        query(f"insert into public.financial_transactions(id,user_id,transaction_type_code,"
              f"transaction_currency_code,status,occurred_at,description) values"
              f"('{parent}','{owner}','income','USD','draft',now(),'Draft'),"
              f"('{destination}','{owner}','income','USD','draft',now(),'Draft');"
              f"insert into public.transaction_entries(id,transaction_id,user_id,account_id,"
              f"entry_side,transaction_amount,account_amount) values"
              f"('{entry}','{parent}','{owner}','{account}','debit',10,10);"
              f"insert into public.transaction_entries(transaction_id,user_id,entry_side,"
              f"transaction_amount,account_amount,memo) values"
              f"('{parent}','{owner}','credit',10,10,'owner_contribution');")
        return parent, destination, entry

    parent, destination, entry = drafts(1)
    race(f"set local role authenticated; select public.post_transaction('{parent}')",
         f"update public.transaction_entries set transaction_id='{destination}' "
         f"where id='{entry}';", "entries of posted transaction are immutable")
    print("PASS posting wins: waiting reparent rejects")

    parent, destination, entry = drafts(2)
    race(f"update public.transaction_entries set transaction_id='{destination}' "
         f"where id='{entry}'",
         f"set role authenticated; select public.post_transaction('{parent}');",
         "transaction is not exactly balanced")
    assert query(f"select status from public.financial_transactions where id='{parent}';").stdout.strip() == "draft"
    print("PASS draft edit wins: posting validates committed entries and rejects imbalance")
finally:
    query("begin; delete from auth.users where id in "
          "('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');"
          "set constraints all immediate; commit;")
