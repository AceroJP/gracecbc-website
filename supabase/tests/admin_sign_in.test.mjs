import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const loadModule = createRequire(import.meta.url);

function loadAction(role, signInError = null) {
  const signOutCalls = [];
  const user = { app_metadata: { role } };
  const client = {
    auth: {
      signInWithPassword: async () => ({ data: { user }, error: signInError }),
      getUser: async () => ({ data: { user }, error: null }),
      signOut: async (options) => {
        signOutCalls.push(options);
        return { error: null };
      },
    },
  };
  const dependencies = {
    "@/lib/supabase/server": { createClient: async () => client },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/auth/actions.ts"), "utf8");
  const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? loadModule(name),
    console,
  });
  return { action: exports.signInAction, signOutCalls };
}

function credentials() {
  const form = new FormData();
  form.set("email", "member@example.test");
  form.set("password", "example-password");
  return form;
}

test("non-admin credentials cannot create an admin login session", async () => {
  const scenario = loadAction("contributor");
  const result = await scenario.action({}, credentials());
  assert.match(result.error, /administrators only/i);
  assert.equal(scenario.signOutCalls.length, 1);
  assert.equal(scenario.signOutCalls[0].scope, "local");
});

test("administrator credentials retain access to the dashboard", async () => {
  const scenario = loadAction("admin");
  await assert.rejects(scenario.action({}, credentials()), /redirect:\/admin\/dashboard/);
  assert.equal(scenario.signOutCalls.length, 0);
});

test("invalid credentials do not authenticate", async () => {
  const scenario = loadAction("contributor", { code: "invalid_credentials" });
  const result = await scenario.action({}, credentials());
  assert.match(result.error, /check your email and password/i);
  assert.equal(scenario.signOutCalls.length, 0);
});
