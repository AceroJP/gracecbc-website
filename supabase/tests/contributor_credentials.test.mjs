import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const loadModule = createRequire(import.meta.url);

function loadAction(options = {}) {
  const updates = [];
  const grants = [];
  const cookieValues = [];
  const contributor = {
    id: "contributor-id",
    auth_user_id: "auth-id",
    status: options.status ?? "approved",
    email_verified_at: options.profileVerified ? "2026-01-01T00:00:00Z" : null,
  };
  const client = {
    from() {
      return {
        select() {
          return { eq: () => ({ maybeSingle: async () => ({ data: contributor, error: null }) }) };
        },
        update(values) {
          updates.push(values);
          return { eq: () => ({ is: async () => ({ error: null }) }) };
        },
      };
    },
    rpc(name, args) {
      if (name === "issue_devotional_submission_grant") grants.push(args);
      return Promise.resolve({ data: true, error: null });
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "member@example.test", email_confirmed_at: options.authConfirmed ? "2026-01-01T00:00:00Z" : null } },
          error: null,
        }),
      },
    },
  };
  const dependencies = {
    "next/headers": {
      headers: async () => new Headers(),
      cookies: async () => ({ set: (...args) => cookieValues.push(args) }),
    },
    "@/lib/supabase/admin": { createPrivilegedClient: () => client },
    "@/lib/env": { getSupabasePublicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key" }) },
    "@/lib/env.server": { getSupabaseSecretKey: () => "test-secret" },
    "@supabase/supabase-js": {
      createClient: () => ({
        auth: {
          signInWithPassword: async () => ({ error: options.signInError ? { code: options.signInError } : null }),
          signOut: async () => ({}),
        },
      }),
    },
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/(public)/devotionals/credential-actions.ts"), "utf8");
  const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? loadModule(name),
    console: { error() {}, warn() {} },
    process,
    Date,
  });
  return { action: exports.verifyContributorCredentials, updates, grants, cookieValues };
}

async function submit(action) {
  const form = new FormData();
  form.set("username", "member");
  form.set("password", "example-password");
  return action({ status: "idle" }, form);
}

test("unconfirmed email reports the confirmation problem without issuing a grant", async () => {
  const scenario = loadAction({ signInError: "email_not_confirmed" });
  const result = await submit(scenario.action);
  assert.match(result.message, /email is not confirmed/i);
  assert.equal(scenario.updates.length, 0);
  assert.equal(scenario.grants.length, 0);
});

test("wrong password remains an authentication error", async () => {
  const scenario = loadAction({ signInError: "invalid_credentials" });
  const result = await submit(scenario.action);
  assert.match(result.message, /username and password/i);
  assert.equal(scenario.grants.length, 0);
});

test("confirmed approved contributor repairs stale verification before receiving a grant", async () => {
  const scenario = loadAction({ authConfirmed: true });
  const result = await submit(scenario.action);
  assert.equal(result.status, "success");
  assert.equal(scenario.updates[0].email_verified_at, "2026-01-01T00:00:00Z");
  assert.equal(scenario.grants.length, 1);
  assert.equal(scenario.cookieValues.length, 1);
});

test("confirmation does not grant access to an unapproved contributor", async () => {
  const scenario = loadAction({ authConfirmed: true, status: "pending_admin_approval" });
  const result = await submit(scenario.action);
  assert.match(result.message, /not approved/i);
  assert.equal(scenario.grants.length, 0);
});
