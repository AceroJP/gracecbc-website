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

function loadModule(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? requireModule(name),
    structuredClone, URL, Date, console, ...globals,
  });
  return exports;
}

const landingPage = loadModule("src/lib/landing-page.ts");
const passthrough = ({ children }) => children ?? null;

function fixture() {
  const content = landingPage.getDefaultLandingPageContent();
  for (const [index, section] of landingPage.landingPageSectionKeys.entries()) {
    content.visibility[section] = true;
    content.sectionBackgrounds[section] = { ...content.sectionBackgrounds[section], minHeight: 700 + index * 10 };
  }
  content.hero.headline = "Welcome";
  content.welcome.text = "Welcome message";
  content.schedule.rows = [{ id: "00000000-0000-4000-8000-000000000001", day: "Sunday", time: "10 AM", serviceName: "Worship", note: "" }];
  content.livestream.items = [{ id: "00000000-0000-4000-8000-000000000001", url: "https://youtube.com/watch?v=abcdefghijk", label: "" }];
  content.contact.address = "Church address";
  content.footer.backgroundColor = "#123456";
  return content;
}

test("footer background settings support old saved pages and validate new colors", () => {
  const content = fixture();
  delete content.footer.backgroundColor;
  let parsed = landingPage.parseLandingPageContent(content);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.footer.backgroundColor, "");
  content.footer.backgroundColor = "#123456";
  parsed = landingPage.parseLandingPageContent(JSON.parse(JSON.stringify(content)));
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.footer.backgroundColor, "#123456");
  content.footer.backgroundColor = "red; background: url(x)";
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
});

test("footer uses the selected background and retains the theme fallback", () => {
  const { PublicFooter } = loadModule("src/components/public/public-footer.tsx", { "@/lib/landing-page": landingPage });
  const footer = fixture().footer;
  let html = renderToStaticMarkup(React.createElement(PublicFooter, { footer }));
  assert.match(html, /background-color:#123456/);
  footer.backgroundColor = "";
  html = renderToStaticMarkup(React.createElement(PublicFooter, { footer }));
  assert.doesNotMatch(html, /background-color:/);
  assert.match(html, /bg-brand/);
});

function loadLandingPageView() {
  const { LivestreamSlider } = loadModule("src/components/public/livestream-slider.tsx", { "@/lib/landing-page": landingPage });
  return loadModule("src/components/public/landing-page-view.tsx", {
    "next/link": { __esModule: true, default: passthrough },
    "next/image": { __esModule: true, default: () => null },
    "@/lib/events": { formatEventDateRange: () => "Date", formatEventTime: () => "Time" },
    "@/lib/announcements": { formatAnnouncementDate: () => "Date", getAnnouncementCategoryLabel: () => "" },
    "@/lib/registration": { parseRegistrationFields: () => [] },
    "@/lib/landing-page": landingPage,
    "@/components/public/contact-details": { ContactDetails: () => null },
    "@/components/public/livestream-slider": { LivestreamSlider },
    "@/components/public/registration-form": { RegistrationForm: () => null },
    "@/components/public/announcement-viewer": { AnnouncementViewer: passthrough },
  }).LandingPageView;
}

function publicData() {
  return {
    events: [{ id: "event", title: "Event", description: "Details", event_date: "2026-01-01", end_date: null, starts_at: "10:00", ends_at: null, location: "Church", registration_enabled: false }],
    publicAnnouncements: [{ id: "announcement", title: "Notice", body: "Details", slide_urls: [], slide_names: [], categories: [], created_at: "2026-01-01", displayDate: "Date", presentation_url: null, background_url: null }],
    devotionals: [{ id: "devotional", slug: "test", title: "Devotional", bible_passage: "John 3:16" }],
    devotionalCount: 1,
    turnstileSiteKey: null,
    today: "2026-01-01",
  };
}

test("shared public view applies section minimums and zero restores automatic height", () => {
  const content = fixture();
  const View = loadLandingPageView();
  const render = () => renderToStaticMarkup(React.createElement(View, { landingPage: content, data: publicData(), imageUrls: {} }));
  let html = render();
  const ids = ["landing-page", "welcome", "schedules", "livestream", "announcements", "events", "devotionals", "contact"];
  for (const [index, id] of ids.entries()) {
    const tag = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `Missing ${id} section`);
    assert.match(tag, new RegExp(`min-height:${700 + index * 10}px`));
  }
  for (const section of landingPage.landingPageSectionKeys) content.sectionBackgrounds[section].minHeight = 0;
  html = render();
  for (const id of ids) {
    const tag = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`))?.[0];
    assert.doesNotMatch(tag, /min-height:/);
  }
});

test("section sizing accepts older saved content and validates new settings", () => {
  const content = fixture();
  for (const section of landingPage.landingPageSectionKeys) delete content.sectionBackgrounds[section].paddingY;
  delete content.livestream.videoWidth;
  let parsed = landingPage.parseLandingPageContent(content);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.sectionBackgrounds.hero.paddingY, null);
  assert.equal(parsed.data.livestream.videoWidth, 768);

  content.sectionBackgrounds.livestream.minHeight = 2500;
  content.sectionBackgrounds.livestream.paddingY = 0;
  content.livestream.videoWidth = 320;
  parsed = landingPage.parseLandingPageContent(JSON.parse(JSON.stringify(content)));
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.sectionBackgrounds.livestream.paddingY, 0);
  assert.equal(parsed.data.livestream.videoWidth, 320);
  const reset = landingPage.resetLandingPageSection(parsed.data, "livestream");
  assert.equal(reset.sectionBackgrounds.livestream.paddingY, null);
  assert.equal(reset.livestream.videoWidth, 768);

  content.sectionBackgrounds.livestream.minHeight = 10001;
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
  content.sectionBackgrounds.livestream.minHeight = 0;
  content.sectionBackgrounds.livestream.paddingY = -1;
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
  content.sectionBackgrounds.livestream.paddingY = 0;
  content.livestream.videoWidth = 239;
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
});

test("legacy livestream settings migrate without losing the link or label", () => {
  const content = fixture();
  content.livestream = { url: "https://youtube.com/watch?v=abcdefghijk", label: "Sunday service", videoWidth: 320 };
  const parsed = landingPage.parseLandingPageContent(content);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.livestream.items.length, 1);
  assert.equal(parsed.data.livestream.items[0].url, content.livestream.url);
  assert.equal(parsed.data.livestream.items[0].label, "Sunday service");
  assert.equal(parsed.data.livestream.itemsToShow, 9);
  assert.equal(parsed.data.livestream.videoWidth, 320);
  const restored = landingPage.parseLandingPageContent(JSON.parse(JSON.stringify(parsed.data)));
  assert.equal(restored.success, true);
  assert.equal(restored.data.livestream.items[0].label, "Sunday service");
});

test("video URLs use trusted embeds and fall back safely for other links", () => {
  assert.equal(landingPage.getLivestreamVideoUrls("https://youtu.be/abcdefghijk").embedUrl, "https://www.youtube-nocookie.com/embed/abcdefghijk");
  assert.equal(landingPage.getLivestreamVideoUrls("https://vimeo.com/12345").embedUrl, "https://player.vimeo.com/video/12345");
  assert.equal(landingPage.getLivestreamVideoUrls("https://vimeo.com/12345?h=private").embedUrl, null);
  const facebook = landingPage.getLivestreamVideoUrls("https://www.facebook.com/church/videos/12345/");
  const embed = new URL(facebook.embedUrl);
  assert.equal(embed.hostname, "www.facebook.com");
  assert.equal(embed.searchParams.get("href"), facebook.sourceUrl);
  assert.equal(landingPage.getLivestreamVideoUrls("https://fb.watch/example").embedUrl, null);
  assert.equal(landingPage.getLivestreamVideoUrls("https://facebook.com.attacker.example/watch?v=123").embedUrl, null);
  assert.equal(landingPage.getLivestreamVideoUrls("javascript:alert(1)"), null);
  const content = fixture();
  content.livestream.items[0].url = "javascript:alert(1)";
  assert.equal(landingPage.parseLandingPageContent(content).success, false);
});

test("livestream slider limits items and uses a responsive single-row layout", () => {
  const content = fixture();
  content.livestream.items = Array.from({ length: 12 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    url: index === 1 ? "https://example.com/live" : `https://youtube.com/watch?v=abcdefghijk`,
    label: `Video label ${index + 1}`,
  }));
  const { LivestreamSlider } = loadModule("src/components/public/livestream-slider.tsx", { "@/lib/landing-page": landingPage });
  for (const count of [3, 6, 9, 12]) {
    content.livestream.itemsToShow = count;
    const parsed = landingPage.parseLandingPageContent(content);
    assert.equal(parsed.success, true);
    const html = renderToStaticMarkup(React.createElement(LivestreamSlider, { settings: parsed.data.livestream }));
    assert.equal((html.match(/aria-roledescription="slide"/g) ?? []).length, 1);
    assert.equal((html.match(/<iframe/g) ?? []).length, 1);
    assert.match(html, /grid-cols-1 items-start gap-6 md:grid-cols-2/);
    assert.match(html, /aria-label="Next videos"/);
    assert.doesNotMatch(html, new RegExp(`Video label ${count + 1}(?:<|\\b)`));
    assert.doesNotMatch(html, /border-border/);
    assert.doesNotMatch(html, /overflow-x-auto/);
  }
  content.livestream.items = [content.livestream.items[1]];
  const html = renderToStaticMarkup(React.createElement(LivestreamSlider, { settings: content.livestream }));
  assert.match(html, /Open video on its original site/);
  assert.match(html, /grid-column:1 \/ -1/);
});

test("each section uses its own spacing and the livestream width stays responsive", () => {
  const content = fixture();
  const ids = ["landing-page", "welcome", "schedules", "livestream", "announcements", "events", "devotionals", "contact"];
  for (const [index, section] of landingPage.landingPageSectionKeys.entries()) {
    content.sectionBackgrounds[section].paddingY = index * 8;
  }
  content.livestream.videoWidth = 320;
  const View = loadLandingPageView();
  const html = renderToStaticMarkup(React.createElement(View, { landingPage: content, data: publicData(), imageUrls: {} }));
  for (const [index, id] of ids.entries()) {
    const section = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>[\\s\\S]*?</section>`))?.[0];
    assert.ok(section, `Missing ${id} section`);
    assert.match(section, new RegExp(`padding-block:${index * 8}${index ? "px" : "(?:px)?"}`));
  }
  assert.match(html, /class="mx-auto w-full" style="max-width:320px"[\s\S]*?<h2[^>]*>Livestream<\/h2>[\s\S]*?aspect-video w-full/);
});

test("livestream title inherits the section typography independently of video width", () => {
  const content = fixture();
  content.livestream.items[0].label = "Sunday service";
  content.livestream.videoWidth = 320;
  content.sectionBackgrounds.livestream.textAlign = "right";
  content.sectionBackgrounds.livestream.fontFamily = "theme-mono";
  content.sectionBackgrounds.livestream.fontSizeScale = 150;
  const View = loadLandingPageView();
  const html = renderToStaticMarkup(React.createElement(View, { landingPage: content, data: publicData(), imageUrls: {} }));
  const section = html.match(/<section[^>]*id="livestream"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /data-section-text-align="true"/);
  assert.match(section, /data-section-font-family="true"/);
  assert.match(section, /data-section-font-size="true"/);
  assert.match(section, /text-align:right/);
  assert.match(section, /font-family:var\(--font-mono\)/);
  assert.match(section, /--text-lg:1\.6875rem/);
  assert.match(section, /style="max-width:320px"[\s\S]*?<h2[^>]*>Sunday service<\/h2>[\s\S]*?<iframe/);
});

test("shared view honors draft visibility, counts, order and background images", () => {
  const content = fixture();
  const data = publicData();
  data.devotionals = Array.from({ length: 5 }, (_, index) => ({ id: `d${index}`, slug: `d${index}`, title: `Devotional ${index}`, bible_passage: "John" }));
  data.devotionalCount = 5;
  content.devotionals.count = 3;
  content.visibility.welcome = false;
  content.sectionOrder = [...content.sectionOrder].reverse();
  content.sectionBackgrounds.hero.image.path = "background.png";
  const View = loadLandingPageView();
  const html = renderToStaticMarkup(React.createElement(View, { landingPage: content, data, imageUrls: { "background:hero": "https://example.com/background.png" } }));
  assert.doesNotMatch(html, /id="welcome"/);
  assert.match(html, /Devotional 2/);
  assert.doesNotMatch(html, /Devotional 3/);
  assert.match(html, /order:7/);
  assert.ok(html.includes("example.com/background.png"));
  assert.match(html, /View all devotionals/);
});

test("preview uses real viewport widths and an authenticated shared renderer", () => {
  const { LandingPagePreviewFrame } = loadModule("src/components/admin/landing-page-preview-frame.tsx");
  const content = fixture();
  for (const [device, width] of [["mobile", 375], ["desktop", 1440]]) {
    const html = renderToStaticMarkup(React.createElement(LandingPagePreviewFrame, { content, imageUrls: {}, device }));
    assert.match(html, new RegExp(`width:${width}px`));
    assert.match(html, /src="\/landing-page-preview"/);
  }
  const preview = fs.readFileSync("src/components/admin/landing-page-preview.tsx", "utf8");
  assert.match(preview, /event.origin !== window.location.origin/);
  assert.match(preview, /event.source !== window.parent/);
  assert.match(preview, /<LandingPageView/);
  assert.match(preview, /<PublicHeader/);
  assert.match(preview, /<PublicFooter/);
  assert.ok(fs.readFileSync("src/app/landing-page-preview/page.tsx", "utf8").includes("await requireAdminUser()"));
  assert.match(fs.readFileSync("src/app/(public)/page.tsx", "utf8"), /<LandingPageView/);
  assert.ok(fs.readFileSync("src/lib/landing-page-data.ts", "utf8").includes('.eq("status", "published")'));
});

test("preview accepts updates only from its same-origin parent", () => {
  const effects = [];
  const updates = [];
  const listeners = {};
  const ready = [];
  const parent = { postMessage: (...args) => ready.push(args) };
  const window = {
    parent,
    location: { origin: "https://example.com" },
    addEventListener: (type, listener) => { listeners[type] = listener; },
    removeEventListener() {},
  };
  const document = { addEventListener() {}, removeEventListener() {} };
  const { LandingPagePreview } = loadModule("src/components/admin/landing-page-preview.tsx", {
    react: { useEffect: (effect) => effects.push(effect), useState: () => [null, (value) => updates.push(value)] },
    "@/components/public/landing-page-view": {},
    "@/components/public/public-footer": {},
    "@/components/public/public-header": {},
  }, { window, document });
  LandingPagePreview({ data: publicData() });
  effects.forEach((effect) => effect());
  assert.equal(ready[0][0].type, "landing-preview-ready");
  assert.equal(ready[0][1], "https://example.com");
  const message = { type: "landing-preview-update", content: fixture(), imageUrls: {} };
  listeners.message({ origin: "https://other.example", source: parent, data: message });
  listeners.message({ origin: window.location.origin, source: {}, data: message });
  assert.equal(updates.length, 0);
  listeners.message({ origin: window.location.origin, source: parent, data: message });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].content.hero.headline, "Welcome");
});
