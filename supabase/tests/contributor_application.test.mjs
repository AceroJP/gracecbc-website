import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const loadModule = createRequire(import.meta.url);

function loadAction(options = {}) {
  const signUps = [];
  const inserts = [];
  const client = {
    from(table) {
      return {
        select() {
          return {
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              single: async () => ({ data: { id: "profile-id", status: "pending_email_verification" }, error: null }),
            }),
          };
        },
        insert(values) {
          inserts.push({ table, values });
          return Promise.resolve({ error: null });
        },
      };
    },
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
  };
  const dependencies = {
    "next/headers": { headers: async () => new Headers({ host: "localhost:3000" }) },
    "@/lib/supabase/admin": { createPrivilegedClient: () => client },
    "@/lib/env": { getSupabasePublicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key" }) },
    "@supabase/supabase-js": {
      createClient: () => ({
        auth: {
          signUp: async (request) => {
            signUps.push(request);
            return options.error
              ? { data: { user: null }, error: options.error }
              : { data: { user: { id: "auth-id", email_confirmed_at: null, identities: [{ id: "identity-id" }] } }, error: null };
          },
        },
      }),
    },
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/(public)/devotionals/apply/actions.ts"), "utf8");
  const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? loadModule(name),
    Headers,
    console: { error() {} },
  });
  return { action: exports.submitContributorApplication, signUps, inserts };
}

function application(overrides = {}) {
  const form = new FormData();
  const values = {
    fullName: "Example Contributor",
    username: "example-contributor",
    email: "member@example.test",
    password: "example-password",
    confirmPassword: "example-password",
    guidelines: "on",
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value !== null) form.set(name, value);
  }
  return form;
}

test("invalid username identifies the field without sending email", async () => {
  const scenario = loadAction();
  const result = await scenario.action({}, application({ username: "invalid username" }));
  assert.match(result.message, /username/i);
  assert.equal(scenario.signUps.length, 0);
});

test("unchecked guidelines produce a specific error", async () => {
  const scenario = loadAction();
  const result = await scenario.action({}, application({ guidelines: null }));
  assert.match(result.message, /agree to the contributor guidelines/i);
  assert.equal(scenario.signUps.length, 0);
});

test("successful submission requests confirmation and stores a pending application", async () => {
  const scenario = loadAction();
  const result = await scenario.action({}, application({ email: " Member@Example.test " }));
  assert.equal(result.status, "success");
  assert.match(result.message, /check your email/i);
  assert.equal(scenario.signUps[0].email, "member@example.test");
  assert.equal(scenario.signUps[0].options.emailRedirectTo, "http://localhost:3000/auth/callback?next=/devotionals/apply");
  assert.equal(scenario.inserts[0].values.status, "pending_email_verification");
  assert.equal(scenario.inserts[1].values.status, "pending_email_verification");
});

test("SMTP errors do not report an application as submitted", async () => {
  const scenario = loadAction({ error: { message: "SMTP delivery failed" } });
  const result = await scenario.action({}, application());
  assert.equal(result.status, "error");
  assert.match(result.message, /verification email could not be sent/i);
  assert.equal(scenario.inserts.length, 0);
});
