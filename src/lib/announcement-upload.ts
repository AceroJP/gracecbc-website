import { Upload } from "tus-js-client";
import { announcementBucket } from "@/lib/announcements";
import { getSupabasePublicEnv } from "@/lib/env";

export async function uploadLargeAnnouncementFile(
  file: File,
  path: string,
  token: string,
  onProgress: (percent: number) => void,
) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getSupabasePublicEnv();
  const storageUrl = new URL(NEXT_PUBLIC_SUPABASE_URL);
  if (/^[^.]+\.supabase\.co$/.test(storageUrl.hostname)) {
    storageUrl.hostname = storageUrl.hostname.replace(
      ".supabase.co",
      ".storage.supabase.co",
    );
  }
  const endpoint = `${storageUrl.toString().replace(/\/$/, "")}/storage/v1/upload/resumable`;

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "x-signature": token,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: announcementBucket,
        objectName: path,
        contentType: file.type,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onError: () => reject(new Error("The file could not be uploaded. Check your connection and the Supabase storage size limit, then try again.")),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
  return { error: null };
}
