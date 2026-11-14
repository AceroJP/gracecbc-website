import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const requireModule = createRequire(import.meta.url);
function load(file, dependencies = {}) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => dependencies[name] ?? requireModule(name), Date, console });
  return exports;
}
const schedules = load("src/lib/worship-schedules.ts");

function setup(admin = true) {
  const calls = [];
  const chain = {
    update: (value) => { calls.push(["update", value]); return chain; },
    delete: () => { calls.push(["delete"]); return chain; },
    eq: (field, value) => { calls.push(["eq", field, value]); return chain; },
    is: (field, value) => { calls.push(["is", field, value]); return chain; },
    not: (field, operator, value) => { calls.push(["not", field, operator, value]); return chain; },
    select: () => chain,
    maybeSingle: async () => ({ data: { id: "found" }, error: null }),
    insert: async (value) => { calls.push(["insert", value]); return { error: null }; },
  };
  const client = { from: (table) => { calls.push(["from", table]); return chain; }, rpc: async (name, args) => { calls.push(["rpc", name, args]); return { data: true, error: null }; } };
  const actions = load("src/app/admin/schedules/actions.ts", {
    "@/lib/worship-schedules": schedules,
    "@/lib/auth/server": { requireAdminUser: async () => { if (!admin) throw new Error("unauthorized"); } },
    "@/lib/supabase/server": { createClient: async () => client },
    "next/cache": { revalidatePath: (path) => calls.push(["revalidate", path]) },
  });
  return { actions, calls };
}

function form(id) {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("day", " Sunday ");
  data.set("time", " 9 AM ");
  data.set("service_name", " Worship ");
  data.set("note", " ");
  return data;
}
const id = "00000000-0000-4000-8000-000000000001";

test("schedule create validates, trims and publishes only for admins", async () => {
  const unauthorized = setup(false);
  await assert.rejects(unauthorized.actions.saveWorshipSchedule(form()), /unauthorized/);
  assert.equal(unauthorized.calls.length, 0);
  const scenario = setup();
  const invalid = form();
  invalid.set("day", "  ");
  assert.equal((await scenario.actions.saveWorshipSchedule(invalid)).status, "error");
  assert.equal(scenario.calls.length, 0);
  assert.equal((await scenario.actions.saveWorshipSchedule(form())).status, "success");
  const inserted = scenario.calls.find((call) => call[0] === "insert")[1];
  assert.equal(inserted.day, "Sunday");
  assert.equal(inserted.time, "9 AM");
  assert.equal(inserted.service_name, "Worship");
  assert.ok(scenario.calls.some((call) => call[0] === "revalidate" && call[1] === "/"));
});

test("updates and archive/restore/delete use the correct row and state", async () => {
  const scenario = setup();
  assert.equal((await scenario.actions.saveWorshipSchedule(form(id))).status, "success");
  assert.ok(scenario.calls.some((call) => call[0] === "is" && call[1] === "archived_at"));
  scenario.calls.length = 0;
  assert.equal((await scenario.actions.changeWorshipSchedule(id, "archive")).status, "success");
  assert.ok(scenario.calls.some((call) => call[0] === "is" && call[1] === "archived_at"));
  for (const operation of ["restore", "delete"]) {
    scenario.calls.length = 0;
    assert.equal((await scenario.actions.changeWorshipSchedule(id, operation)).status, "success");
    assert.ok(scenario.calls.some((call) => call[0] === "not" && call[1] === "archived_at"));
  }
});

test("reordering is admin-guarded and rejects invalid operations", async () => {
  const unauthorized = setup(false);
  await assert.rejects(unauthorized.actions.changeWorshipSchedule(id, "up"), /unauthorized/);
  assert.equal(unauthorized.calls.length, 0);
  const scenario = setup();
  assert.equal((await scenario.actions.changeWorshipSchedule(id, "bad")).status, "error");
  assert.equal(scenario.calls.length, 0);
  assert.equal((await scenario.actions.changeWorshipSchedule(id, "down")).status, "success");
  assert.equal(scenario.calls.find((call) => call[0] === "rpc")[1], "move_worship_schedule");
});
