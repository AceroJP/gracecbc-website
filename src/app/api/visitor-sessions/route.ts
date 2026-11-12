import { createHash } from "node:crypto";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const visitorSessionSchema = z.object({
  sessionId: z.string().uuid(),
}).strict();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      return new Response("Forbidden", { status: 403 });
    }
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return new Response("Unsupported media type", { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const parsed = visitorSessionSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid visitor session", { status: 400 });
  }

  const sessionHash = createHash("sha256")
    .update(parsed.data.sessionId)
    .digest("hex");
  const supabase = createPrivilegedClient();
  const { error } = await supabase
    .from("landing_page_visitor_sessions")
    .insert({ session_hash: sessionHash });

  if (error && error.code !== "23505") {
    throw new Error("Unable to record visitor session.", { cause: error });
  }

  return new Response(null, { status: 204 });
}
