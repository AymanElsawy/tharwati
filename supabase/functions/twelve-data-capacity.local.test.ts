import { readFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// Explicit opt-in. Only a disposable DB in the dedicated local container is used.
describe.skipIf(process.env.TD_CAPACITY_SQL_PROBES !== "1")("atomic SQL capacity reservation", () => {
  const container = "supabase_db_TharwatiMobileDevelopment"
  const docker = process.env.TD_CAPACITY_DOCKER ?? "docker"
  const database = `td_capacity_test_${randomUUID().replaceAll("-", "")}`
  let created = false
  const args = (db: string) => ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", db, "-At", "--set=ON_ERROR_STOP=1"]
  function sql(query: string, db = database) {
    const result = spawnSync(docker, args(db), { input: query, encoding: "utf8" })
    if (result.status !== 0) throw new Error(`Disposable capacity SQL failed: ${result.stderr || result.error}`)
    return result.stdout.trim()
  }
  function concurrent(query: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(docker, args(database))
      let output = "", errors = ""
      child.stdout.on("data", chunk => { output += chunk })
      child.stderr.on("data", chunk => { errors += chunk })
      child.on("error", reject)
      child.on("close", code => {
        if (code !== 0) { reject(new Error(errors)); return }
        const value = output.trim().split(/\r?\n/).find(line => /^\d+$/.test(line))
        if (!value) { reject(new Error("Missing concurrent grant")); return }
        resolve(Number(value))
      })
      child.stdin.end(query)
    })
  }
  beforeAll(() => {
    const inspection = spawnSync(docker, ["inspect", container], { encoding: "utf8" })
    if (inspection.status !== 0) throw new Error("Dedicated local DB is unavailable")
    const details = JSON.parse(inspection.stdout)[0]
    expect(details.Name).toBe(`/${container}`)
    expect(details.State.Running).toBe(true)
    expect(details.NetworkSettings.Ports["5432/tcp"].some((binding: { HostPort: string }) => binding.HostPort === "58322")).toBe(true)
    const uidDefinition = sql("select pg_get_functiondef('auth.uid()'::regprocedure);", "postgres")
    sql(`create database ${database};`, "postgres")
    created = true
    sql(`create schema auth; grant usage on schema auth to authenticated; create table auth.users(id uuid primary key); ${uidDefinition}`)
    for (const file of ["20261002135123_provider_request_budgets.sql", "20261002141941_configurable_global_provider_budgets.sql", "20261009102808_capacity_aware_twelve_data_reservation.sql"]) {
      sql(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"))
    }
  }, 30000)
  afterAll(() => {
    if (created) sql(`drop database ${database};`, "postgres")
  })
  it("enforces authorization, partial/window/day grants, shared search accounting and independent Gold", () => {
    sql(readFileSync(new URL("../tests/twelve_data_symbol_reservation.sql", import.meta.url), "utf8"))
  })
  it.each([true, false])("serializes concurrent same-user=%s grants without exceeding global capacity", async sameUser => {
    const users = [randomUUID(), randomUUID()]
    sql(`delete from provider_private.budgets; delete from provider_private.global_budgets;
      insert into auth.users(id) values ('${users[0]}'),('${users[1]}');
      select public.configure_provider_capacity('twelve_data',5,5,5,5,true);`)
    const reserve = (user: string) => `begin; select set_config('request.jwt.claim.sub','${user}',true); set local role authenticated;
      select public.reserve_twelve_data_symbols(4)->>'grantedSymbolCount'; select pg_sleep(0.1); commit;`
    const grants = await Promise.all([concurrent(reserve(users[0])), concurrent(reserve(sameUser ? users[0] : users[1]))])
    expect(grants.sort()).toEqual([1, 4])
    expect(sql("select day_used from provider_private.global_budgets where provider='twelve_data';")).toBe("5")
    expect(sql("select sum(day_used) from provider_private.budgets where bucket='twelve_data';")).toBe("5")
  })
  it("serializes search against partial securities grants using the same global ledger", async () => {
    const users = [randomUUID(), randomUUID()]
    sql(`delete from provider_private.budgets; delete from provider_private.global_budgets;
      insert into auth.users(id) values ('${users[0]}'),('${users[1]}');
      select public.configure_provider_capacity('twelve_data',4,4,4,4,true);
      select public.configure_provider_capacity('asset_search',2,2,null,null,true);`)
    const grants = await Promise.all([
      concurrent(`begin; select set_config('request.jwt.claim.sub','${users[0]}',true); set local role authenticated;
        select public.reserve_twelve_data_symbols(4)->>'grantedSymbolCount'; select pg_sleep(0.1); commit;`),
      concurrent(`begin; select set_config('request.jwt.claim.sub','${users[1]}',true); set local role authenticated;
        select case when public.reserve_provider_budget('twelve_data','search',1)->>'allowed'='true' then 1 else 0 end;
        select pg_sleep(0.1); commit;`),
    ])
    expect(grants.reduce((total, count) => total + count, 0)).toBe(4)
    expect(sql("select day_used from provider_private.global_budgets where provider='twelve_data';")).toBe("4")
    expect(sql("select sum(day_used) from provider_private.budgets where bucket='twelve_data';")).toBe("4")
  })
})
