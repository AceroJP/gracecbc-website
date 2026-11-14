import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.TEST_DEVOTIONAL_GRANT_RPC === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

test("the deployed grant RPC is available only to the server", { skip: !enabled }, async () => {
  assert.ok(url && secretKey && publicKey, "Supabase environment variables are required");

  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  const server = createClient(url, secretKey, options);
  const anonymous = createClient(url, publicKey, options);
  const args = {
    p_grant_hash: "0".repeat(64),
    p_contributor_id: "00000000-0000-0000-0000-000000000000",
    p_expires_at: new Date(Date.now() + 300_000).toISOString(),
  };

  const serverResult = await server.rpc("issue_devotional_submission_grant", args);
  assert.equal(serverResult.error?.code ?? null, null, "The server grant RPC must be available");
  assert.equal(serverResult.data, false, "A nonexistent contributor must not receive a grant");

  const anonymousResult = await anonymous.rpc("issue_devotional_submission_grant", args);
  assert.ok(anonymousResult.error, "Anonymous clients must not be able to issue grants");
});
