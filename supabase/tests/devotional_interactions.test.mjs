import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const requireModule = createRequire(import.meta.url);
const devotionalId = "00000000-0000-4000-8000-000000000001";

function loadAction(file, options = {}) {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "consume_devotional_rate_limit") {
        return { data: options.allowed ?? true, error: options.rateError ?? null };
      }
      if (options.actionError) return { data: null, error: { code: "test_error" } };
      return { data: name === "create_devotional_comment" ? "comment-id" : [{ liked: true, reaction_count: 1 }], error: null };
    },
  };
  const dependencies = {
    "next/headers": { headers: async () => new Headers({ "x-real-ip": "192.0.2.1" }) },
    "@/lib/supabase/admin": { createPrivilegedClient: () => client },
    "@/lib/env.server": { getSupabaseSecretKey: () => "test-secret" },
  };
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/(public)/devotionals", file), "utf8");
  const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? requireModule(name),
    console: { error() {} },
    Headers,
  });
  return { exports, calls };
}

test("a public reaction requires a name", async () => {
  const { exports, calls } = loadAction("reaction-actions.ts");
  const result = await exports.toggleDevotionalReaction({ devotionalId, visitorId: "a".repeat(64), action: "like", visitorName: "  " });
  assert.equal(result.status, "error");
  assert.equal(calls.length, 0);
});

test("a named public reaction is sent through the rate-limited server function", async () => {
  const { exports, calls } = loadAction("reaction-actions.ts");
  const result = await exports.toggleDevotionalReaction({ devotionalId, visitorId: "a".repeat(64), action: "like", visitorName: "  Visitor  " });
  assert.equal(result.status, "success");
  assert.equal(calls[0].name, "consume_devotional_rate_limit");
  assert.equal(calls[1].name, "toggle_named_devotional_reaction");
  assert.equal(calls[1].args.p_visitor_name, "Visitor");
  assert.notEqual(calls[1].args.p_visitor_identifier_hash, "a".repeat(64));
});

test("comments require a name and text before reaching the database", async () => {
  const { exports, calls } = loadAction("comment-actions.ts");
  const result = await exports.submitDevotionalComment({ devotionalId, authorName: " ", content: "Hello" });
  assert.equal(result.status, "error");
  assert.equal(calls.length, 0);
});

test("reaction rate limits cannot be reset by changing browser identifiers", async () => {
  const { exports, calls } = loadAction("reaction-actions.ts");
  await exports.toggleDevotionalReaction({ devotionalId, visitorId: "a".repeat(64), action: "like", visitorName: "Visitor" });
  await exports.toggleDevotionalReaction({ devotionalId, visitorId: "b".repeat(64), action: "like", visitorName: "Visitor" });
  assert.equal(calls[0].args.p_request_hash, calls[2].args.p_request_hash);
});

test("comments are trimmed and created by the server", async () => {
  const { exports, calls } = loadAction("comment-actions.ts");
  const result = await exports.submitDevotionalComment({ devotionalId, authorName: "  Visitor ", content: "  Thank you  " });
  assert.equal(result.status, "success");
  assert.equal(calls[0].name, "consume_devotional_rate_limit");
  assert.equal(calls[1].name, "create_devotional_comment");
  assert.equal(calls[1].args.p_author_name, "Visitor");
  assert.equal(calls[1].args.p_content, "Thank you");
});

test("rate-limited comments do not reach the comment function", async () => {
  const { exports, calls } = loadAction("comment-actions.ts", { allowed: false });
  const result = await exports.submitDevotionalComment({ devotionalId, authorName: "Visitor", content: "Hello" });
  assert.match(result.message, /too many/i);
  assert.equal(calls.length, 1);
});

test("database failures do not report comments as posted", async () => {
  const { exports } = loadAction("comment-actions.ts", { actionError: true });
  const result = await exports.submitDevotionalComment({ devotionalId, authorName: "Visitor", content: "Hello" });
  assert.equal(result.status, "error");
});
