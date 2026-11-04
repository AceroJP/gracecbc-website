import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const uploadTicketPayloadSchema = z.object({
  eventId: z.uuid(),
  fieldId: z.uuid(),
  path: z.string().min(1),
  name: z.string().min(1).max(180),
  size: z.number().int().positive(),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  expiresAt: z.number().int(),
});

export type RegistrationUploadTicketPayload = z.infer<
  typeof uploadTicketPayloadSchema
>;

export function createRegistrationUploadTicket(
  payload: RegistrationUploadTicketPayload,
  secret: string,
) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyRegistrationUploadTicket(
  ticket: string,
  secret: string,
  eventId: string,
  fieldId: string,
) {
  const [encoded, suppliedSignature, extra] = ticket.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(encoded)
    .digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const parsed = uploadTicketPayloadSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.eventId !== eventId ||
    parsed.data.fieldId !== fieldId ||
    parsed.data.expiresAt <= Date.now() ||
    !parsed.data.path.startsWith(`${eventId}/pending/`)
  ) {
    return null;
  }

  return parsed.data;
}
