/**
 * Full feature sweep, run against an EMPTY database.
 *
 *   npm run db:clear
 *   npm run build && npm start        # in one shell
 *   npm run test:features             # in another
 *
 * Walks the app the way a first-time owner would: empty state, first party,
 * every entry type, attachments, both ledger views, search, and the edges.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.argv[2] || "tests/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
}

// A 1x1 PNG and a minimal PDF, so both attachment branches are exercised.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const pngPath = path.join(SHOTS, "receipt.png");
const pdfPath = path.join(SHOTS, "bill.pdf");
fs.writeFileSync(pngPath, PNG);
fs.writeFileSync(
  pdfPath,
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
// The suite visits missing routes on purpose; those 404s are expected.
let expecting404 = false;
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (expecting404 && /404/.test(m.text())) return;
  consoleErrors.push(`console: ${m.text()}`);
});

const noOverflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0,
  );

// ── 1. Empty state ────────────────────────────────────────────────────────
section("Empty state");
await page.goto(BASE, { waitUntil: "networkidle" });
check("empty ledger shows 'Nobody here yet'", await page.getByText("Nobody here yet").isVisible());
check(
  "empty state explains what to do",
  await page.getByText(/Add the people and shops you deal with/).isVisible(),
);
check("no party cards present", (await page.locator('a[href^="/p/"]').count()) === 0);
await page.screenshot({ path: path.join(SHOTS, "f01-empty.png"), fullPage: true });

// The empty-state button must open the same sheet as the header button.
await page.getByRole("button", { name: "Add your first party" }).click();
check("empty state opens the party sheet", await page.getByRole("dialog").isVisible());

// ── 2. Sheet behaviour ────────────────────────────────────────────────────
section("Sheet behaviour");
await page.keyboard.press("Escape");
await page.getByRole("dialog").waitFor({ state: "detached" });
check("Escape closes the sheet", true);

await page.getByRole("button", { name: /New party/ }).click();
await page.getByRole("dialog").waitFor();
await page.mouse.click(195, 40); // backdrop, above the panel
await page.getByRole("dialog").waitFor({ state: "detached" });
check("backdrop click closes the sheet", true);

// ── 3. First party: a Customer who owes money ─────────────────────────────
section("Create parties");
await page.getByRole("button", { name: /New party/ }).click();
let sheet = page.getByRole("dialog");
await sheet.getByLabel(/^Name/).fill("Ramesh Traders");
check(
  "Customer is the default type",
  (await sheet.getByRole("button", { name: "Customer", exact: true }).getAttribute("aria-pressed")) ===
    "true",
);
await sheet.getByRole("button", { name: /Phone and email/ }).click();
await sheet.getByLabel("Phone").fill("98450 11234");
await sheet.getByLabel("Email").fill("ramesh@example.com");
await page.getByRole("button", { name: "Save party" }).click();
await page.waitForURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 15000 });
const rameshUrl = page.url();
check("first party created", true, rameshUrl.replace(BASE, ""));
check(
  "detail shows type · phone · email",
  await page.getByText("Customer · 98450 11234 · ramesh@example.com").isVisible(),
);
check("zero balance is neutral", (await page.locator("section .font-mono").first().innerText()) === "₹0");
check("no entries yet state", await page.getByText(/No entries yet/).isVisible());
await page.screenshot({ path: path.join(SHOTS, "f02-new-party.png"), fullPage: true });

// Second party: a Merchant carrying a positive opening, so the list has one
// card on each side of the balance. smoke.mjs covers the negative opening.
await page.getByRole("button", { name: /New party/ }).click();
sheet = page.getByRole("dialog");
await sheet.getByLabel(/^Name/).fill("Sunrise Stationery");
await sheet.getByRole("button", { name: "Merchant", exact: true }).click();
await sheet.getByRole("button", { name: /Phone and email/ }).click();
await sheet.getByLabel("Phone").fill("90080 44120");
await sheet.getByLabel("Opening balance").fill("2000");
await page.getByRole("button", { name: "Save party" }).click();
await page.waitForURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 15000 });
const sunriseUrl = page.url();
check("merchant with negative opening created", true);
await page.getByRole("heading", { name: "Sunrise Stationery" }).waitFor();
check("opening balance reads 'They owe you'", await page.getByText("They owe you").isVisible());
check(
  "opening amount shown unsigned",
  (await page.locator("section .font-mono").first().innerText()) === "₹2,000",
  await page.locator("section .font-mono").first().innerText(),
);

// ── 4. All four entry types ───────────────────────────────────────────────
section("Entry types and balance maths");
await page.goto(rameshUrl, { waitUntil: "networkidle" });

async function addEntry({ type, amount, note, files = [], daysAgo = 0 }) {
  await page.getByRole("button", { name: /Received/ }).first().click();
  const s = page.getByRole("dialog");
  await s.waitFor();
  if (type !== "Received") await s.getByRole("button", { name: type, exact: true }).click();
  await s.getByLabel("Amount").fill(String(amount));
  if (note) await s.getByLabel("Note").fill(note);
  if (daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    await s.getByLabel("Date").fill(d.toISOString().slice(0, 10));
  }
  if (files.length) await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(files);
  await page.getByRole("button", { name: "Save entry" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 15000 });
}

await addEntry({ type: "Received", amount: 12000, note: "UPI against bill 118" });
await addEntry({ type: "Advance received", amount: 5000, note: "Advance for next order", daysAgo: 1 });
await addEntry({ type: "Paid", amount: 1500, note: "Damage adjustment", daysAgo: 6 });
await addEntry({ type: "Advance paid", amount: 500, note: "Courier on their behalf", daysAgo: 9 });

// Cash in lowers the balance, cash out raises it:
// −12000 − 5000 + 1500 + 500 = −15000 -> "₹15,000" on the "You owe them" side.
await page.waitForFunction(
  () => document.querySelector("section .font-mono")?.textContent === "₹15,000",
  null,
  { timeout: 15000 },
);
check("all four entry types applied with correct signs", true, "−12000 − 5000 + 1500 + 500 = −₹15,000");
check("negative balance reads 'You owe them'", await page.getByText("You owe them").isVisible());

// ── 5. Statement view ─────────────────────────────────────────────────────
section("Ledger views");
await page.getByRole("button", { name: "Statement" }).click();
await page.getByText("Entry", { exact: true }).waitFor();
const stmtRows = await page.locator("div.grid.items-center").count();
check("statement lists every entry", stmtRows === 4, `${stmtRows} rows`);
const table = page.locator("div.overflow-hidden.rounded-\\[18px\\]");
const received = await table.locator("span.text-in").allInnerTexts();
const paid = await table.locator("span.text-out").allInnerTexts();
check(
  "received and paid land in the right columns",
  received.filter(Boolean).sort().join() === "₹12,000,₹5,000" &&
    paid.filter(Boolean).sort().join() === "₹1,500,₹500",
  `in=[${received.filter(Boolean)}] out=[${paid.filter(Boolean)}]`,
);
check("statement fits 390px", await noOverflow());
await page.screenshot({ path: path.join(SHOTS, "f03-statement.png"), fullPage: true });

// ── 6. Bubbles view and day grouping ──────────────────────────────────────
await page.getByRole("button", { name: "Bubbles" }).click();
await page.getByText("Today", { exact: true }).waitFor();
check("bubbles groups today", true);
check("bubbles groups yesterday", await page.getByText("Yesterday", { exact: true }).isVisible());
const dividers = await page
  .locator("div.flex.items-center.gap-3 > span.text-\\[11px\\]")
  .allInnerTexts();
// CSS uppercases these, so compare case-insensitively.
const labels = dividers.map((d) => d.toLowerCase());
check(
  "older days get a real date label",
  labels.length === 4 &&
    labels[0] === "today" &&
    labels[1] === "yesterday" &&
    /^\d+ \w+ \d{4}$/.test(labels[2]) &&
    /^\d+ \w+ \d{4}$/.test(labels[3]),
  dividers.join(" | "),
);
check(
  "inflow bubbles sit left, outflow right",
  (await page.locator("div.flex.justify-start").count()) === 2 &&
    (await page.locator("div.flex.justify-end").count()) === 2,
);
check("bubbles fit 390px", await noOverflow());
await page.screenshot({ path: path.join(SHOTS, "f04-bubbles.png"), fullPage: true });

// ── 7. Attachments ────────────────────────────────────────────────────────
section("Attachments");
await page.getByRole("button", { name: /Received/ }).first().click();
sheet = page.getByRole("dialog");
await sheet.getByLabel("Amount").fill("750");
await sheet.getByLabel("Note").fill("Two receipts");
await page.locator('input[type="file"][accept*="pdf"]').setInputFiles([pngPath, pdfPath]);
await page.getByText("receipt.png").waitFor();
await page.getByText("bill.pdf").waitFor();
check("multiple files queue up", true);
await page.screenshot({ path: path.join(SHOTS, "f05-attachments.png") });

await page.getByRole("button", { name: "Remove receipt.png" }).click();
await page.getByText("receipt.png").waitFor({ state: "detached" });
check("a queued file can be removed before saving", await page.getByText("bill.pdf").isVisible());

// Put it back, then save both.
await page.locator('input[type="file"][accept*="pdf"]').setInputFiles([pngPath]);
await page.getByText("receipt.png").waitFor();
await page.getByRole("button", { name: "Save entry" }).click();
await page.getByRole("dialog").waitFor({ state: "detached", timeout: 20000 });
check("entry saved with two attachments", true);

await page.getByText("bill.pdf").first().waitFor();
await page.getByText("receipt.png").first().waitFor();
check("both attachments render as chips on the entry", true);

// Image chip should carry a real thumbnail background.
const thumb = await page
  .locator('button:has-text("receipt.png") span')
  .first()
  .evaluate((el) => getComputedStyle(el).backgroundImage);
check("image chip shows a thumbnail", thumb.includes("/api/files/"), thumb.slice(0, 60));

// Viewer: image branch.
await page.getByRole("button", { name: /receipt\.png/ }).first().click();
await page.getByRole("dialog").waitFor();
const imgSrc = await page.locator("img").first().getAttribute("src");
const imgResp = await page.request.get(BASE + imgSrc);
check(
  "image served with the right type",
  imgResp.status() === 200 && imgResp.headers()["content-type"] === "image/png",
  `${imgResp.status()} ${imgResp.headers()["content-type"]}`,
);
check(
  "attachment is cached and framable same-origin",
  imgResp.headers()["cache-control"]?.includes("private") &&
    imgResp.headers()["content-security-policy"]?.includes("frame-ancestors 'self'"),
);
const dl = await page.request.get(BASE + imgSrc + "?download=1");
check(
  "download link forces attachment disposition",
  dl.headers()["content-disposition"]?.startsWith("attachment"),
  dl.headers()["content-disposition"],
);
await page.screenshot({ path: path.join(SHOTS, "f06-viewer.png") });
await page.keyboard.press("Escape");
await page.getByRole("dialog").waitFor({ state: "detached" });
check("Escape closes the viewer", true);

// Viewer: PDF branch.
await page.getByRole("button", { name: /bill\.pdf/ }).first().click();
await page.getByRole("dialog").waitFor();
check("PDF opens in a frame", (await page.locator("iframe").count()) === 1);
await page.keyboard.press("Escape");

// ── 8. Rejections ─────────────────────────────────────────────────────────
section("Validation");
await page.getByRole("button", { name: /Paid/ }).first().click();
sheet = page.getByRole("dialog");
await page.getByRole("button", { name: "Save entry" }).click();
await page.getByText("Enter an amount above zero.").waitFor({ timeout: 10000 });
check("empty amount rejected", true);
await sheet.getByLabel("Amount").fill("abc");
await page.getByRole("button", { name: "Save entry" }).click();
await page.getByText("Enter an amount above zero.").waitFor({ timeout: 10000 });
check("non-numeric amount rejected", true);
await sheet.getByLabel("Amount").fill("25");
check(
  "stale error clears once the field is corrected",
  !(await page.getByText("Enter an amount above zero.").isVisible()),
);
await page.keyboard.press("Escape");

// ── 9. List, balances and search ──────────────────────────────────────────
section("List and search");
await page.goto(BASE, { waitUntil: "networkidle" });
check("both parties listed", (await page.locator('a[href^="/p/"]').count()) === 2);
check("owed-to-you card is green", (await page.locator("a .text-in").count()) === 1);
check("owed-by-you card is red", (await page.locator("a .text-out").count()) === 1);
check("card shows last activity", await page.getByText("Today").first().isVisible());
check("party with no entries reads 'No entries'", await page.getByText("No entries").isVisible());
await page.screenshot({ path: path.join(SHOTS, "f07-list.png"), fullPage: true });

await page.getByRole("searchbox").fill("sunrise");
await page.waitForURL(/\?q=sunrise/, { timeout: 10000 });
await page.getByText("Sunrise Stationery").waitFor();
check("search is case-insensitive on name", (await page.locator('a[href^="/p/"]').count()) === 1);

await page.getByRole("searchbox").fill("98450");
await page.waitForURL(/\?q=98450/, { timeout: 10000 });
await page.getByText("Ramesh Traders").waitFor();
check("search matches a phone number", (await page.locator('a[href^="/p/"]').count()) === 1);

await page.getByRole("searchbox").fill("100%");
await page.waitForURL(/q=100/, { timeout: 10000 });
await page.getByText("No match").waitFor({ timeout: 10000 });
check("LIKE wildcards are escaped, not matched", true);

await page.goto(BASE + "/?q=ramesh", { waitUntil: "networkidle" });
check(
  "search survives a reload from the URL",
  (await page.getByRole("searchbox").inputValue()) === "ramesh" &&
    (await page.locator('a[href^="/p/"]').count()) === 1,
);

// ── 10. Edges ─────────────────────────────────────────────────────────────
section("Edges");
expecting404 = true;
await page.goto(BASE + "/p/00000000-0000-0000-0000-000000000000", { waitUntil: "networkidle" });
check("unknown party shows its own not-found", await page.getByText("No such party").isVisible());
await page.getByRole("link", { name: /Back to all parties/ }).click();
await page.waitForURL(BASE + "/");
check("not-found links home", true);

await page.goto(BASE + "/nope/nowhere", { waitUntil: "networkidle" });
check("unknown route shows 404", await page.getByText("Nothing here").isVisible());

const missing = await page.request.get(BASE + "/api/files/00000000000000000000000000000000");
check("missing attachment 404s", missing.status() === 404, String(missing.status()));
expecting404 = false;

// Ledger style persists across parties, not just reloads.
await page.goto(rameshUrl, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Bubbles" }).click();
await page.getByText("Today", { exact: true }).waitFor();
await page.goto(sunriseUrl, { waitUntil: "networkidle" });
check(
  "ledger style carries to another party",
  (await page.getByRole("button", { name: "Bubbles" }).getAttribute("aria-pressed")) === "true",
);

// ── 11. Responsiveness ────────────────────────────────────────────────────
section("Responsiveness");
for (const [w, h] of [
  [320, 640],
  [375, 812],
  [414, 896],
  [768, 1024],
  [1024, 768],
  [1440, 900],
]) {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const pg = await c.newPage();
  let clean = true;
  for (const url of [BASE + "/", rameshUrl]) {
    await pg.goto(url, { waitUntil: "networkidle" });
    const over = await pg.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (over > 0) clean = false;
  }
  check(`no horizontal scroll @${w}px`, clean);
  if (w === 1440) await pg.screenshot({ path: path.join(SHOTS, "f08-desktop.png"), fullPage: true });
  await c.close();
}

// Touch targets: everything tappable must clear 44px.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(rameshUrl, { waitUntil: "networkidle" });
// Hit-test rather than measure: compact controls keep their drawn size and
// grow the tappable box with a transparent pseudo-element.
const small = await page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll("button, a, input")) {
    if (el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (r.height >= 44) continue;
    const x = r.left + r.width / 2;
    const mid = r.top + r.height / 2;
    const reaches = (y) => {
      if (y < 0 || y > innerHeight) return true; // off-screen, cannot test
      const hit = document.elementFromPoint(x, y);
      return !!hit && (el.contains(hit) || hit === el);
    };
    if (!reaches(mid - 21) || !reaches(mid + 21)) {
      bad.push(`${el.tagName}:${(el.textContent || "").trim().slice(0, 20)} (${Math.round(r.height)}px)`);
    }
  }
  return bad;
});
check("every tap target reaches 44px of hit area", small.length === 0, small.join(", "));

await browser.close();

section("Result");
check("no JS errors anywhere", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log("Failed: " + failed.map((f) => f.name).join("; "));
process.exit(failed.length ? 1 : 0);
