import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const requireModule = createRequire(import.meta.url);
function load(file, dependencies = {}) {
  const compiled = typescript.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => dependencies[name] ?? requireModule(name), Date, URL, structuredClone, console });
  return exports;
}
const schedules = load("src/lib/worship-schedules.ts");
const landing = load("src/lib/landing-page.ts");
const missing = { code: "PGRST205", message: "Could not find the table 'public.worship_schedules' in the schema cache" };

function dataClient(scheduleError, content) {
  const calls = [];
  const client = {
    from(table) {
      calls.push(table);
      const results = {
        events: { data: [], error: null },
        worship_schedules: { data: scheduleError ? null : [{ id: "managed" }], error: scheduleError },
        announcements: { data: [], error: null },
        devotionals: { data: [], count: 0, error: null },
        landing_page_published: { data: content === undefined ? null : { content }, error: null },
      };
      const chain = { select: () => chain, is: () => chain, order: () => chain, eq: () => chain, limit: () => chain, maybeSingle: async () => results[table], then: (resolve) => resolve(results[table]) };
      return chain;
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  };
  const dataModule = load("src/lib/landing-page-data.ts", {
    "server-only": {},
    "@/lib/announcements": {},
    "@/lib/env": { getOptionalTurnstileSiteKey: () => null },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/landing-page": landing,
    "@/lib/worship-schedules": schedules,
  });
  return { calls, dataModule };
}

test("missing schedules table falls back only to published legacy rows", async () => {
  const content = { schedule: { rows: [{ id: "00000000-0000-4000-8000-000000000001", day: "Sunday", time: "9 AM", serviceName: "Public", note: "" }] } };
  const scenario = dataClient(missing, content);
  const data = await scenario.dataModule.getLandingPageData();
  assert.equal(data.schedules[0].service_name, "Public");
  assert.ok(scenario.calls.includes("landing_page_published"));
  assert.ok(!scenario.calls.includes("landing_page_drafts"));
  assert.equal((await dataClient(missing).dataModule.getLandingPageData()).schedules.length, 0);
});

test("other database errors are not hidden and migrated tables avoid fallback", async () => {
  await assert.rejects(dataClient({ code: "42501", message: "permission denied" }).dataModule.getLandingPageData(), /Unable to load public worship schedules/);
  await assert.rejects(dataClient({ code: "PGRST205", message: "Could not find the table 'public.other'" }).dataModule.getLandingPageData(), /Unable to load public worship schedules/);
  const scenario = dataClient(null);
  assert.equal((await scenario.dataModule.getLandingPageData()).schedules[0].id, "managed");
  assert.ok(!scenario.calls.includes("landing_page_published"));
});

test("builder refuses destructive saves until schedules migration is available", async () => {
  const calls = [];
  let error = missing;
  const client = { from(table) { calls.push(table); return { select() { return { limit: async () => ({ error }) }; } }; } };
  const actions = load("src/app/admin/landing-page/actions.ts", {
    "@/lib/landing-page": landing,
    "@/lib/worship-schedules": schedules,
    "@/lib/auth/server": { requireAdminUser: async () => {} },
    "@/lib/supabase/server": { createClient: async () => client },
    "next/cache": { revalidatePath: () => {} },
  });
  assert.equal((await actions.saveLandingPageDraftAction(landing.getDefaultLandingPageContent())).status, "error");
  assert.equal((await actions.publishLandingPageAction(landing.getDefaultLandingPageContent())).status, "error");
  assert.equal((await actions.discardLandingPageDraftAction()).status, "error");
  assert.equal(calls.every((table) => table === "worship_schedules"), true);
  error = { code: "42501", message: "permission denied" };
  await assert.rejects(actions.discardLandingPageDraftAction(), /Unable to check worship schedules/);
});
