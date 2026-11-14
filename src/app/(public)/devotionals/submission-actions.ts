"use server";

import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/admin";
import { getSupabaseSecretKey } from "@/lib/env.server";

const submissionSchema = z.object({
  title: z.string().trim().min(1).max(180),
  biblePassage: z.string().trim().min(1).max(160),
  bibleTranslation: z.string().trim().min(1).max(40),
  keyVerse: z.string().trim().min(1).max(2000),
  message: z.string().trim().min(1).max(50000),
  personalApplication: z.string().trim().min(1).max(20000),
  closingPrayer: z.string().trim().min(1).max(10000),
});

export type DevotionalSubmissionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function grantHash(grant: string) {
  return createHmac("sha256", getSupabaseSecretKey()).update(grant).digest("hex");
}

export async function submitDevotional(
  _previousState: DevotionalSubmissionState,
  formData: FormData,
): Promise<DevotionalSubmissionState> {
  const parsed = submissionSchema.safeParse({
    title: formData.get("title"),
    biblePassage: formData.get("biblePassage"),
    bibleTranslation: formData.get("bibleTranslation"),
    keyVerse: formData.get("keyVerse"),
    message: formData.get("message"),
    personalApplication: formData.get("personalApplication"),
    closingPrayer: formData.get("closingPrayer"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Complete every devotional field and check the length limits.",
    };
  }

  const cookieStore = await cookies();
  const grant = cookieStore.get("gcbc_devotional_grant")?.value;
  if (!grant || !/^[a-f0-9]{64}$/.test(grant)) {
    return {
      status: "error",
      message: "Your writing access has expired. Verify your credentials again.",
    };
  }

  try {
    const slug = `${slugify(parsed.data.title)}-${Date.now().toString(36)}`;
    const { data, error } = await createPrivilegedClient().rpc(
      "create_devotional_submission",
      {
        p_grant_hash: grantHash(grant),
        p_title: parsed.data.title,
        p_slug: slug,
        p_bible_passage: parsed.data.biblePassage,
        p_bible_translation: parsed.data.bibleTranslation,
        p_key_verse: parsed.data.keyVerse,
        p_message: parsed.data.message,
        p_personal_application: parsed.data.personalApplication,
        p_closing_prayer: parsed.data.closingPrayer,
      },
    );

    const result = data?.[0];
    if (!error && result?.status === "invalid_grant") {
      return {
        status: "error",
        message: "Your writing access has expired. Verify your credentials again.",
      };
    }
    if (!error && result?.status === "unauthorized") {
      return {
        status: "error",
        message: "Your account is not authorized to submit devotionals. Please contact the church administrator.",
      };
    }
    if (error || result?.status !== "submitted") {
      console.error("Unable to submit devotional.", error ?? result);
      return {
        status: "error",
        message: "We couldn’t submit your devotional. Please try again.",
      };
    }

    cookieStore.set("gcbc_devotional_grant", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/devotionals",
    });

    return {
      status: "success",
      message:
        "Your devotional has been submitted successfully and is awaiting administrator review.",
    };
  } catch (error) {
    console.error("Devotional submission failed.", error);
    return {
      status: "error",
      message: "We couldn’t submit your devotional. Please try again.",
    };
  }
}
