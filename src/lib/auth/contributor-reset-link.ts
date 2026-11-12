import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseSecretKey } from "@/lib/env.server";

export function createContributorResetSignature(
  userId: string,
  expiresAt: string,
) {
  return createHmac("sha256", getSupabaseSecretKey())
    .update(`${userId}\u0000${expiresAt}`)
    .digest("hex");
}

export function isContributorResetLinkValid(
  userId: string | null | undefined,
  expiresAt: string | null | undefined,
  signature: string | null | undefined,
) {
  if (
    !userId ||
    !expiresAt ||
    !signature ||
    !/^\d+$/.test(expiresAt) ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expiresAtSeconds = Number(expiresAt);
  if (
    !Number.isSafeInteger(expiresAtSeconds) ||
    expiresAtSeconds <= Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const expectedSignature = createContributorResetSignature(
    userId,
    expiresAt,
  );
  const providedSignature = Buffer.from(signature, "hex");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");

  return (
    providedSignature.length === expectedSignatureBuffer.length &&
    timingSafeEqual(providedSignature, expectedSignatureBuffer)
  );
}
