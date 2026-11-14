"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseSecretKey } from "@/lib/env.server";
import { createPrivilegedClient } from "@/lib/supabase/admin";

const commentSchema = z.object({
  devotionalId: z.uuid(),
  authorName: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(2000),
});

export async function submitDevotionalComment(input: z.input<typeof commentSchema>) {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error" as const, message: "Enter your name and a comment of up to 2,000 characters." };
  }

  try {
    const requestHeaders = await headers();
    const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? requestHeaders.get("x-real-ip") ?? "unknown";
    const requestHash = createHmac("sha256", getSupabaseSecretKey())
      .update(clientIp).digest("hex");
    const client = createPrivilegedClient();
    const { data: allowed, error: rateError } = await client.rpc("consume_devotional_rate_limit", {
      p_scope: "comment",
      p_request_hash: requestHash,
      p_max_attempts: 8,
      p_window_seconds: 900,
    });
    if (rateError) throw new Error("Unable to apply comment rate limiting.", { cause: rateError });
    if (!allowed) return { status: "error" as const, message: "Too many comments. Please try again later." };

    const { data, error } = await client.rpc("create_devotional_comment", {
      p_devotional_id: parsed.data.devotionalId,
      p_author_name: parsed.data.authorName,
      p_content: parsed.data.content,
    });
    if (error || !data) throw new Error("Unable to create devotional comment.", { cause: error });
    return { status: "success" as const, message: "Your comment was posted." };
  } catch (error) {
    console.error("Devotional comment failed.", error);
    return { status: "error" as const, message: "We could not post your comment. Please try again." };
  }
}
