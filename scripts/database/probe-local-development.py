"""Authenticated application probes for the dedicated local stack only.

Run after start-local-development.ps1 and functions serve. Retains one synthetic
smoke user; credentials/results live only in the ignored mobile-development.local.
No provider calls or remote Supabase targets are used by these probes.
"""
import datetime
from decimal import Decimal
import json
import pathlib
import re
import secrets
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORKDIR = ROOT / "mobile-development.local"
BASE = "http://127.0.0.1:58321"
CONTAINER = "supabase_db_TharwatiMobileDevelopment"
status = json.loads((WORKDIR / "status.json").read_text(encoding="utf-8-sig"))
assert status["API_URL"].rstrip("/") == BASE, "Refusing other API target"
PUBLIC = status["PUBLISHABLE_KEY"]
SECRET = status["SECRET_KEY"]
assert PUBLIC.startswith("sb_publishable_") and SECRET.startswith("sb_secret_")
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
results = []


def request(path, body=None, token=None, admin=False, method=None, expected=(200,)):
    assert path.startswith("/") and not path.startswith("//")
    headers = {"apikey": SECRET if admin else PUBLIC, "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode() if body is not None else None,
        headers=headers, method=method,
    )
    try:
        with opener.open(req, timeout=60) as response:
            code, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        code, raw = error.code, error.read()
    if code not in expected:
        # Never emit response bodies from Auth, which may include session credentials.
        raise AssertionError(f"{path.split('?')[0]} returned HTTP {code}; expected {expected}")
    payload = json.loads(raw) if raw else None
    results.append({"endpoint": path.split("?")[0], "status": code})
    return payload


def rpc(name, args, token):
    return request("/rest/v1/rpc/" + name, args, token, expected=(200, 204))


def select(table, columns, token, filters=""):
    return request("/rest/v1/" + table + "?select=" + urllib.parse.quote(columns) + filters, token=token)


def sql(query):
    process = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
         "-X", "--set=ON_ERROR_STOP=1", "-At"],
        input=query, text=True, encoding="utf-8", capture_output=True, check=True,
    )
    return process.stdout.strip()


# Verify every table/RPC referenced by current runtime Edge sources is present.
sources = list((ROOT / "supabase/functions").rglob("*.ts"))
runtime = "\n".join(p.read_text(encoding="utf-8") for p in sources if not p.name.endswith(".test.ts"))
tables = sorted(set(re.findall(r'\.from\("([a-z_]+)"\)', runtime)))
rpcs = sorted(set(re.findall(r'\.rpc\("([a-z_]+)"', runtime)))
for table in tables:
    assert sql(f"select to_regclass('public.{table}') is not null;") == "t", table
missing_rpcs = []
for name in rpcs:
    if sql(f"select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='{name}');") != "t":
        missing_rpcs.append(name)
# investment-fx is retained legacy source, unused by current Mobile. Do not
# invent compatibility RPCs or alter the approved baseline to accommodate it.
assert set(missing_rpcs) <= {"add_investment", "edit_investment"}, missing_rpcs
print(f"PASS Mobile Edge dependencies: {len(tables)} tables; legacy investment-fx missing RPCs: {missing_rpcs}")

credential_path = WORKDIR / "smoke-user.json"
if credential_path.exists():
    credentials = json.loads(credential_path.read_text(encoding="utf-8"))
else:
    credentials = {"email": "mobile-smoke@example.invalid", "password": "Local!9" + secrets.token_urlsafe(24)}
    request("/auth/v1/admin/users", {**credentials, "email_confirm": True,
            "user_metadata": {"full_name": "Local Mobile Smoke"}}, admin=True, expected=(200, 201))
    credential_path.write_text(json.dumps(credentials, indent=2), encoding="utf-8")
session = request("/auth/v1/token?grant_type=password", credentials)
token = session["access_token"]
user_id = session["user"]["id"]
assert session["user"]["email_confirmed_at"]
request("/auth/v1/user", token=token)
rpc("complete_onboarding", {"p_country_code": "SA", "p_base_currency_code": "SAR", "p_selected_goals": ["buy_car"]}, token)
print("PASS confirmed local user, password authentication, onboarding/profile trigger")

fixture_path = WORKDIR / "smoke-fixtures.json"
if fixture_path.exists():
    fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
else:
    account = rpc("create_financial_account_v2", {"p_account_type_code": "cash", "p_name": "Local smoke cash",
        "p_currency_code": "SAR", "p_opening_balance": "1000", "p_idempotency_key": str(uuid.uuid4())}, token)
    goal_id = rpc("create_goal", {"p_name": "Local smoke goal", "p_goal_type": "buy_car", "p_custom_type_name": None,
        "p_target_amount": "5000", "p_currency_code": "SAR", "p_target_date": None,
        "p_saved_so_far": "100", "p_saved_on": datetime.date.today().isoformat()}, token)
    fixtures = {"account_id": account["id"], "goal_id": goal_id}
    fixture_path.write_text(json.dumps(fixtures, indent=2), encoding="utf-8")

# Extract Mobile's literal selectors so column checks track the application contract.
def mobile_selector(relative, constant):
    source = (ROOT / "apps/mobile/lib" / relative).read_text(encoding="utf-8")
    match = re.search(r'\b' + re.escape(constant) + r'\s*=([\s\S]*?);', source)
    assert match, constant
    return "".join(re.findall(r"'([^']*)'", match[1]))

accounts = select("financial_accounts", mobile_selector("accounts/accounts_repository.dart", "_accountSelect"), token,
                  "&user_id=eq." + user_id)
assert any(a["id"] == fixtures["account_id"] for a in accounts)
select("financial_accounts", mobile_selector("dashboard/data/dashboard_repository.dart", "_accountSelect"), token, "&is_active=eq.true")
select("profiles", "base_currency_code,onboarding_completed", token, "&id=eq." + user_id)
goals = select("goals", mobile_selector("goals/goals_repository.dart", "_goalSelect"), token)
entries = select("goal_progress_entries", mobile_selector("goals/goals_repository.dart", "_entrySelect"), token)
assert any(g["id"] == fixtures["goal_id"] for g in goals)
assert any(e["goal_id"] == fixtures["goal_id"] for e in entries)
balances = rpc("get_account_balances", {"p_account_ids": None}, token)
assert any(b["account_id"] == fixtures["account_id"] and Decimal(str(b["current_balance"])) == Decimal("1000") for b in balances)
rpc("get_account_custom_order", {}, token)
for name in ("get_effective_account_valuations", "get_account_current_ownership", "get_effective_metal_purchases"):
    rpc(name, {"p_account_ids": []}, token)
for table in ("holdings", "assets", "exchange_rates", "market_prices", "dashboard_valuation_snapshots",
              "record_categories", "wealth_allocation_targets", "wealth_allocation_target_preferences"):
    select(table, "*", token)
print("PASS authenticated Mobile Accounts/Goals selectors, balance and valuation RPCs")

for function in ("dashboard-valuation", "fx-rates", "market-prices", "asset-search", "investment-fx", "delete-account", "export-my-data"):
    request("/functions/v1/" + function, method="OPTIONS", expected=(204,))
    # Gateway bypass does not bypass the handler's Auth validation.
    request("/functions/v1/" + function, {} if function != "export-my-data" else None,
            token="invalid-local-token", expected=(401,))

snapshot = request("/functions/v1/dashboard-valuation", {}, token)
assert Decimal(snapshot["currentValues"][fixtures["account_id"]]) == Decimal("1000")
assert snapshot["freshness"] == "fresh" and not snapshot["unavailableSources"]
cached = request("/functions/v1/dashboard-valuation", {}, token)
assert cached["asOf"] == snapshot["asOf"]
stored = select("dashboard_valuation_snapshots", "snapshot", token)
assert stored
identity = request("/functions/v1/fx-rates", {"fromCurrencyCode": "SAR", "toCurrencyCode": "SAR"}, token)
assert identity["available"] and identity["rate"] == 1
search = request("/functions/v1/asset-search", {"query": "AAPL"}, token)
assert search == {"available": False, "results": []}, "Provider secrets must be absent for this smoke contract"
request("/functions/v1/investment-fx", {"operation": "invalid", "args": {}}, token, expected=(400,))
request("/functions/v1/delete-account", {"password": "wrong-local-password"}, token, expected=(401,))
request("/functions/v1/export-my-data", token=token, expected=(200, 429))
print("PASS all seven Edge endpoints, local Auth enforcement, Dashboard snapshot write/cache, identity FX, honest unavailable search")

# A user-owned synthetic security has no quote or external identifier: ensure null,
# never zero/fabricated pricing. This creates catalogue metadata, not market data.
asset_id = sql(f"select id from public.assets where user_id='{user_id}' and name='Local unpriced smoke security';")
if not asset_id:
    created = request("/rest/v1/assets", {"user_id": user_id, "asset_type_code": "stock", "name": "Local unpriced smoke security",
        "currency_code": "SAR", "canonical_quantity_unit": "shares", "is_custom": True}, token, expected=(201,))
    asset_id = sql(f"select id from public.assets where user_id='{user_id}' and name='Local unpriced smoke security';")
prices = request("/functions/v1/market-prices", {"assetIds": [asset_id]}, token)
assert prices["prices"][0]["available"] is False and prices["prices"][0]["price"] is None
print("PASS unpriced security returns available=false and price=null")

# Recovery email is captured locally; delete only an isolated disposable local user.
request("/auth/v1/recover?redirect_to=" + urllib.parse.quote("tharwati://auth-callback", safe=""),
        {"email": credentials["email"]})
temporary = {"email": "delete-smoke-" + uuid.uuid4().hex[:12] + "@example.invalid", "password": "Local!9" + secrets.token_urlsafe(24)}
request("/auth/v1/admin/users", {**temporary, "email_confirm": True}, admin=True, expected=(200, 201))
temp_session = request("/auth/v1/token?grant_type=password", temporary)
temp_token = temp_session["access_token"]
rpc("create_financial_account_v2", {"p_account_type_code": "cash", "p_name": "Disposable deletion cash",
    "p_currency_code": "SAR", "p_opening_balance": "10", "p_idempotency_key": str(uuid.uuid4())}, temp_token)
rpc("create_goal", {"p_name": "Disposable deletion goal", "p_goal_type": "buy_car", "p_custom_type_name": None,
    "p_target_amount": "100", "p_currency_code": "SAR", "p_target_date": None,
    "p_saved_so_far": "5", "p_saved_on": datetime.date.today().isoformat()}, temp_token)
request("/functions/v1/delete-account", {"password": temporary["password"]}, temp_session["access_token"], expected=(204,))
request("/auth/v1/admin/users/" + temp_session["user"]["id"], admin=True, expected=(404,))
for table in ("profiles", "financial_accounts", "goals", "goal_progress_entries"):
    field = "id" if table == "profiles" else "user_id"
    assert sql(f"select count(*) from public.{table} where {field}='{temp_session['user']['id']}';") == "0"
print("PASS local recovery email request and disposable-user password-reauthenticated deletion")

report = {"ready": True, "api_url": BASE, "project_id": "TharwatiMobileDevelopment", "provider_secrets": "absent",
          "legacy_unused_investment_fx_missing_rpcs": missing_rpcs,
          "tested_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "probes": results}
(WORKDIR / "readiness.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print("READY: local backend application contract; Android UI smoke remains manual")
