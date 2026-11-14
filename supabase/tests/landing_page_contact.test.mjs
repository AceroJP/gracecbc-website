import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import typescript from "typescript";

const requireModule = createRequire(import.meta.url);

function loadModule(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? requireModule(name),
    structuredClone, URL, File, FormData, Uint8Array,
  });
  return exports;
}

const landingPage = loadModule("src/lib/landing-page.ts");

test("existing saved contact details gain default appearance settings", () => {
  const content = landingPage.getDefaultLandingPageContent();
  delete content.contact.appearance;
  content.contact.address = "Existing address";
  const parsed = landingPage.parseLandingPageContent(content);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.contact.address, "Existing address");
  for (const key of landingPage.landingPageContactKeys) {
    assert.equal(parsed.data.contact.appearance[key].textColor, "");
    assert.equal(parsed.data.contact.appearance[key].image.path, null);
  }
});

test("contact appearance round trips, validates input and resets", () => {
  const content = landingPage.getDefaultLandingPageContent();
  content.contact.appearance.phone = { textColor: "#123456", image: { path: "contact/phone/icon.png", alt: "Phone icon" } };
  let parsed = landingPage.parseLandingPageContent(JSON.parse(JSON.stringify(content)));
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.contact.appearance.phone.textColor, "#123456");
  assert.equal(parsed.data.contact.appearance.phone.image.path, "contact/phone/icon.png");
  assert.equal(landingPage.resetLandingPageSection(parsed.data, "contact").contact.appearance.phone.image.path, null);
  content.contact.appearance.phone.textColor = "not-a-color";
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
  content.contact.appearance.phone.textColor = "#123456";
  content.contact.appearance.phone.image.alt = "";
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
});

test("contact display renders labeled links, configured colors and decorative custom icons", () => {
  const { ContactDetails } = loadModule("src/components/public/contact-details.tsx", {
    "next/image": { __esModule: true, default: ({ alt, src }) => React.createElement("img", { alt, src }) },
  });
  const contact = landingPage.getDefaultLandingPageContent().contact;
  Object.assign(contact, { address: "Church address", phone: "+63 912 345", email: "hello@example.com", mapUrl: "https://example.com/map", facebookUrl: "https://example.com/facebook" });
  contact.appearance.phone = { textColor: "#abcdef", image: { path: "phone.png", alt: "Phone" } };
  const html = renderToStaticMarkup(React.createElement(ContactDetails, { contact, imageUrls: { "contact:phone": "/phone.png" }, sectionTextColor: "#ffffff" }));
  assert.match(html, /color:#abcdef/);
  assert.match(html, /color:#ffffff/);
  assert.match(html, /src="\/phone.png"/);
  assert.match(html, /alt=""/);
  assert.match(html, /href="tel:\+63912345"/);
  assert.match(html, /href="mailto:hello@example.com"/);
  assert.match(html, /href="https:\/\/example.com\/map"[^>]*target="_blank"/);
  assert.match(html, /Visit Facebook/);
  assert.match(html, /Church address/);
});

test("only admins can upload validated contact icons to the existing bucket", async () => {
  let admin = false;
  const uploaded = [];
  const { uploadLandingPageImageAction } = loadModule("src/app/admin/landing-page/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/server": { requireAdminUser: async () => { if (!admin) throw new Error("Not authorized"); } },
    "@/lib/landing-page": landingPage,
    "@/lib/supabase/server": { createClient: async () => ({ storage: { from: () => ({
      upload: async (filePath) => { uploaded.push(filePath); return { error: null }; },
      getPublicUrl: (filePath) => ({ data: { publicUrl: `https://example.com/${filePath}` } }),
    }) } }) },
  });
  const form = new FormData();
  form.set("image", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "icon.png", { type: "image/png" }));
  form.set("alt", "Phone icon");
  form.set("section", "contact:phone");
  await assert.rejects(uploadLandingPageImageAction(form), /Not authorized/);
  assert.equal(uploaded.length, 0);
  admin = true;
  assert.equal((await uploadLandingPageImageAction(form)).status, "success");
  assert.match(uploaded[0], /^contact\/phone\/.*\.png$/);
  form.set("section", "contact:invalid");
  assert.equal((await uploadLandingPageImageAction(form)).status, "error");
  assert.equal(uploaded.length, 1);
});
