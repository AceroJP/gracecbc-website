import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import typescript from "typescript";

const requireModule = createRequire(import.meta.url);
function loadModule(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? requireModule(name),
    URL,
    console,
  });
  return exports;
}

const announcements = loadModule("src/lib/announcements.ts");
const maxBytes = 100 * 1024 * 1024;

test("each supported announcement file is limited to 100 MiB", () => {
  for (const [name, type] of [
    ["slides.pdf", "application/pdf"],
    ["slides.ppt", "application/vnd.ms-powerpoint"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["slide.jpg", "image/jpeg"],
    ["slide.png", "image/png"],
    ["slide.webp", "image/webp"],
  ]) {
    assert.ok(announcements.getAnnouncementFileExtension(name, type, maxBytes));
    assert.equal(announcements.getAnnouncementFileExtension(name, type, maxBytes + 1), null);
    assert.equal(announcements.getAnnouncementFileExtension(name, type, 0), null);
  }
  assert.equal(announcements.getAnnouncementFileExtension("slides.exe", "application/pdf", 1), null);
});

test("large files use a signed resumable upload and report progress", async () => {
  let options;
  let progress;
  class MockUpload {
    constructor(file, uploadOptions) { options = uploadOptions; }
    start() { options.onProgress(3, 4); options.onSuccess(); }
  }
  const { uploadLargeAnnouncementFile } = loadModule("src/lib/announcement-upload.ts", {
    "tus-js-client": { Upload: MockUpload },
    "@/lib/announcements": announcements,
    "@/lib/env": { getSupabasePublicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key" }) },
  });
  await uploadLargeAnnouncementFile({ type: "application/pdf" }, "id/file.pdf", "signed-token", (value) => { progress = value; });
  assert.equal(options.endpoint, "https://example.storage.supabase.co/storage/v1/upload/resumable");
  assert.equal(options.headers["x-signature"], "signed-token");
  assert.equal(options.headers.apikey, "public-key");
  assert.equal(options.metadata.bucketName, "church-announcements");
  assert.equal(options.metadata.objectName, "id/file.pdf");
  assert.equal(options.chunkSize, 6 * 1024 * 1024);
  assert.equal(progress, 75);
});

test("upload preparation stays admin-only and rejects oversized files", async () => {
  let authorized = false;
  let signedRequests = 0;
  const { beginAnnouncementUploadsAction } = loadModule("src/app/admin/announcements/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/server": { requireAdminUser: async () => { if (!authorized) throw new Error("Not authorized"); } },
    "@/lib/env.server": {},
    "@/lib/announcements": announcements,
    "@/lib/supabase/server": {
      createClient: async () => ({ storage: { from: () => ({ createSignedUploadUrl: async (uploadPath) => {
        signedRequests += 1;
        return { data: { path: uploadPath, token: "token" }, error: null };
      } }) } }),
    },
  });
  const request = {
    announcementId: "00000000-0000-4000-8000-000000000001",
    purpose: "presentation",
    files: [{ name: "file.pdf", size: maxBytes, contentType: "application/pdf" }],
  };
  await assert.rejects(beginAnnouncementUploadsAction(request), /Not authorized/);
  assert.equal(signedRequests, 0);
  authorized = true;
  assert.equal((await beginAnnouncementUploadsAction(request)).status, "success");
  request.files[0].size += 1;
  assert.equal((await beginAnnouncementUploadsAction(request)).status, "error");
  assert.equal(signedRequests, 1);
});

test("resumable upload failure does not expose a signed token", async () => {
  class MockUpload {
    constructor(file, options) { this.options = options; }
    start() { this.options.onError(new Error("signed-token")); }
  }
  const { uploadLargeAnnouncementFile } = loadModule("src/lib/announcement-upload.ts", {
    "tus-js-client": { Upload: MockUpload },
    "@/lib/announcements": announcements,
    "@/lib/env": { getSupabasePublicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key" }) },
  });
  await assert.rejects(uploadLargeAnnouncementFile({ type: "application/pdf" }, "id/file.pdf", "signed-token", () => {}), (error) => {
    assert.match(error.message, /storage size limit/);
    assert.doesNotMatch(error.message, /signed-token/);
    return true;
  });
});

test("bucket migration only changes the announcement size limit", () => {
  const sql = fs.readFileSync("supabase/migrations/20261114170000_increase_announcement_file_limit.sql", "utf8");
  assert.match(sql, /set file_size_limit = 104857600/i);
  assert.match(sql, /where id = 'church-announcements'/i);
  assert.doesNotMatch(sql, /policy|allowed_mime_types|public\s*=/i);
});
