"use server";

import { createHash, createHmac } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { getSupabaseSecretKey } from "@/lib/env.server";

const reactionSchema = z.object({
  devotionalId: z.uuid(),
  visitorId: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(["like", "unlike"]),
});

export type ReactionState = {
  status: "success" | "error";
  liked?: boolean;
  reactionCount?: number;
  message?: string;
};

export async function toggleDevotionalReaction(
  input: z.input<typeof reactionSchema>,
): Promise<ReactionState> {
  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid reaction request." };
  }

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  const secret = getSupabaseSecretKey();
  const visitorHash = createHmac("sha256", secret)
    .update(parsed.data.visitorId)
    .digest("hex");
  const requestHash = createHash("sha256")
    .update(`${parsed.data.devotionalId}\u0000${visitorHash}\u0000${clientIp}`)
    .digest("hex");

  try {
    const client = createPrivilegedClient();
    const { data: allowed, error: rateLimitError } = await client.rpc(
      "consume_devotional_rate_limit",
      {
        p_scope: "reaction",
        p_request_hash: requestHash,
        p_max_attempts: 20,
        p_window_seconds: 900,
      },
    );

    if (rateLimitError) {
      throw new Error("Unable to apply reaction rate limiting.", {
        cause: rateLimitError,
      });
    }
    if (!allowed) {
      return {
        status: "error",
        message: "Too many reaction attempts. Please try again later.",
      };
    }

    const { data, error } = await client.rpc("toggle_devotional_reaction", {
      p_devotional_id: parsed.data.devotionalId,
      p_visitor_identifier_hash: visitorHash,
      p_action: parsed.data.action,
    });
    const result = data?.[0];
    if (error || !result) {
      throw new Error("Unable to update devotional reaction.", {
        cause: error,
      });
    }

    return {
      status: "success",
      liked: result.liked,
      reactionCount: result.reaction_count,
    };
  } catch (error) {
    console.error("Devotional reaction failed.", error);
    return {
      status: "error",
      message: "We couldn’t update your reaction. Please try again.",
    };
  }
}
