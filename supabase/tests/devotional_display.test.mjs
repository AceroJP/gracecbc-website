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
    Intl,
    Date,
  });
  return exports;
}

test("devotional comments show Philippine time and the newest comment first", async () => {
  const devotionals = loadModule("src/lib/devotionals.ts");
  const orders = [];
  const comments = [
    { id: "2", author_name: "Newest", content: "New comment", created_at: "2026-11-14T00:05:00Z" },
    { id: "1", author_name: "Oldest", content: "Old comment", created_at: "2026-11-13T23:00:00Z" },
  ];
  const devotional = {
    id: "devotional-id", contributor_id: "author-id", category_id: null,
    title: "Test devotional", bible_passage: "John 3:16", bible_translation: "KJV",
    key_verse: "Verse", message: "Message", personal_application: "Application",
    closing_prayer: "Prayer", published_at: "2026-11-14T00:00:00Z", reaction_count: 0,
  };
  const supabase = {
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        order(column, options) { orders.push([column, options.ascending]); return this; },
        limit() { return Promise.resolve({ data: comments, error: null }); },
        maybeSingle() { return Promise.resolve({ data: devotional, error: null }); },
      };
      assert.ok(["devotionals", "devotional_comments"].includes(table));
      return query;
    },
  };
  const privileged = {
    from() {
      return { select() { return this; }, eq() { return this; }, single: async () => ({ data: { full_name: "Author" } }) };
    },
  };
  const { default: page } = loadModule("src/app/(public)/devotionals/[slug]/page.tsx", {
    "next/link": { __esModule: true, default: ({ children }) => children },
    "next/navigation": { notFound() { throw new Error("Not found"); } },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/supabase/admin": { createPrivilegedClient: () => privileged },
    "@/components/public/devotional-reaction-button": { DevotionalReactionButton: () => null },
    "@/components/public/devotional-comment-form": { DevotionalCommentForm: () => null },
    "@/lib/devotionals": devotionals,
  });

  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ slug: "test" }) }));
  assert.deepEqual(orders, [["created_at", false], ["id", false]]);
  assert.ok(html.indexOf("New comment") < html.indexOf("Old comment"));
  assert.match(html, /datetime="2026-11-14T00:05:00Z"/i);
  assert.match(html, /November 14, 2026.*8:05 AM \(Philippine time\)/);
});

test("public footer retains its configured text without duplicated contact details", () => {
  const { PublicFooter } = loadModule("src/components/public/public-footer.tsx", {
    "@/lib/landing-page": {
      getLandingPageFontFamily: () => undefined,
      getLandingPageTypographyStyleVariables: () => ({}),
    },
  });
  const html = renderToStaticMarkup(React.createElement(PublicFooter, {
    footer: { title: "Church", text: "All rights reserved", textAlign: "inherit", fontFamily: "inherit", fontSizeScale: 100, paddingY: 24 },
    contact: { address: "Duplicate address", phone: "123456", email: "duplicate@example.com", facebookUrl: "https://example.com", mapUrl: "https://example.com/map" },
  }));
  assert.match(html, /Church/);
  assert.match(html, /All rights reserved/);
  assert.doesNotMatch(html, /Duplicate address|123456|duplicate@example.com|Facebook|Map/);
});
