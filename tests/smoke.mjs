/**
 * End-to-end smoke test against a running Accountly server.
 *
 *   npm run build && npm start        # in one shell
 *   npm run test:e2e                  # in another
 *
 * Writes screenshots to tests/screenshots and exits non-zero on any failure.
 * It creates one party and one entry, so point it at a scratch database.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.argv[2] || "tests/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });
const errors = [];
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch();

// --- Mobile viewport pass -----------------------------------------------
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await phone.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(SHOTS, "01-list-mobile.png"), fullPage: true });

// No horizontal overflow at 390px.
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("no horizontal scroll @390px", overflow <= 0, `overflow=${overflow}px`);

// --- Create a party ------------------------------------------------------
const stamp = Date.now();
const partyName = `Playwright Party ${stamp}`;

await page.getByRole("button", { name: /New party/ }).click();
await page.getByRole("dialog").waitFor();
await page.screenshot({ path: path.join(SHOTS, "02-new-party-sheet.png") });

// Validation first: empty name must be refused.
await page.getByRole("button", { name: "Save party" }).click();
await page.getByText("A name is needed to save this party.").waitFor({ timeout: 5000 });
check("empty party name rejected", true);

const sheet = page.getByRole("dialog");
await sheet.getByLabel(/^Name/).fill(partyName);
await sheet.getByRole("button", { name: "Merchant", exact: true }).click();
await sheet.getByRole("button", { name: /Phone and email/ }).click();
await sheet.getByLabel("Phone").fill("90000 12345");
await sheet.getByLabel("Opening balance").fill("-1500.50");
await page.getByRole("button", { name: "Save party" }).click();

await page.waitForURL(/\/p\/[0-9a-f-]{36}$/, { timeout: 15000 });
const partyUrl = page.url();
check("party saved and navigated to detail", true, partyUrl.replace(BASE, ""));

await page.getByRole("heading", { name: partyName }).waitFor();
const openingBalance = await page.locator("section .font-mono").first().innerText();
check("negative opening balance shown as owed", openingBalance === "₹1,500", `got ${openingBalance}`);
const openingLabel = await page.getByText("You owe them").first().isVisible();
check("negative balance labelled 'You owe them'", openingLabel);

// --- Create a transaction with an attachment -----------------------------
const pdf = path.join(SHOTS, "receipt.pdf");
fs.writeFileSync(
  pdf,
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

await page.getByRole("button", { name: /Received/ }).click();
await page.getByRole("dialog").waitFor();

// Validation: zero amount must be refused.
const txnSheet = page.getByRole("dialog");
await txnSheet.getByLabel("Amount").fill("0");
await page.getByRole("button", { name: "Save entry" }).click();
await page.getByText("Enter an amount above zero.").waitFor({ timeout: 5000 });
check("zero amount rejected", true);

await txnSheet.getByLabel("Amount").fill("2400.75");
await txnSheet.getByLabel("Note").fill("UPI settlement");
await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(pdf);
await page.getByText("receipt.pdf").first().waitFor();
await page.screenshot({ path: path.join(SHOTS, "03-txn-sheet.png") });

await page.getByRole("button", { name: "Save entry" }).click();
await page.getByRole("dialog").waitFor({ state: "detached", timeout: 15000 });
check("entry saved and sheet closed", true);

// Balance: -1500.50 opening − 2400.75 received = −3901.25 -> "₹3,901".
// Cash received from a party settles what they owe, so it lowers the balance.
await page.waitForFunction(
  () => document.querySelector("section .font-mono")?.textContent === "₹3,901",
  null,
  { timeout: 15000 },
);
check("balance recomputed after entry", true, "₹3,901 (you owe them)");
check("balance stays on the 'You owe them' side", await page.getByText("You owe them").first().isVisible());

// --- Statement / Bubbles toggle -----------------------------------------
await page.getByRole("button", { name: "Statement" }).click();
await page.getByText("Entry", { exact: true }).waitFor();
await page.screenshot({ path: path.join(SHOTS, "04-statement-mobile.png"), fullPage: true });
const stmtOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("statement fits 390px", stmtOverflow <= 0, `overflow=${stmtOverflow}px`);

await page.getByRole("button", { name: "Bubbles" }).click();
await page.getByText("Today").waitFor();
await page.screenshot({ path: path.join(SHOTS, "05-bubbles-mobile.png"), fullPage: true });
check("bubbles view groups by day", true);

// Style choice persists across a reload (cookie).
await page.reload({ waitUntil: "networkidle" });
const bubblesStillOn = await page
  .getByRole("button", { name: "Bubbles" })
  .getAttribute("aria-pressed");
check("ledger style persists across reload", bubblesStillOn === "true", `aria-pressed=${bubblesStillOn}`);

// --- Attachment serving ---------------------------------------------------
await page.getByRole("button", { name: /receipt/ }).click();
await page.getByRole("dialog").waitFor();
const fileSrc = await page.locator("iframe").getAttribute("src");
const fileResp = await page.request.get(BASE + fileSrc);
check(
  "attachment served with correct type",
  fileResp.status() === 200 && fileResp.headers()["content-type"] === "application/pdf",
  `${fileResp.status()} ${fileResp.headers()["content-type"]}`,
);
await page.screenshot({ path: path.join(SHOTS, "06-file-viewer.png") });
await page.keyboard.press("Escape");

// --- Search ---------------------------------------------------------------
await page.getByRole("link", { name: /All parties/ }).click();
await page.waitForURL(BASE + "/");
await page.getByRole("searchbox").fill("Playwright");
await page.waitForURL(/\?q=Playwright/, { timeout: 10000 });
await page.getByText(partyName).waitFor();
const cards = await page.locator('a[href^="/p/"]').count();
check("search narrows the list", cards === 1, `${cards} card(s)`);

await page.getByRole("searchbox").fill("zzz-no-such-party");
await page.getByText("No match").waitFor({ timeout: 10000 });
check("empty search result state", true);

// --- Desktop pass ---------------------------------------------------------
const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const wide = await desktop.newPage();
wide.on("pageerror", (e) => errors.push(`pageerror(desktop): ${e.message}`));
await wide.goto(BASE, { waitUntil: "networkidle" });
await wide.screenshot({ path: path.join(SHOTS, "07-list-desktop.png"), fullPage: true });
await wide.goto(partyUrl, { waitUntil: "networkidle" });
await wide.screenshot({ path: path.join(SHOTS, "08-detail-desktop.png"), fullPage: true });
const wideOverflow = await wide.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("no horizontal scroll @1280px", wideOverflow <= 0, `overflow=${wideOverflow}px`);

// --- Narrow stress test ---------------------------------------------------
const tiny = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
const small = await tiny.newPage();
await small.goto(partyUrl, { waitUntil: "networkidle" });
const tinyOverflow = await small.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("no horizontal scroll @320px", tinyOverflow <= 0, `overflow=${tinyOverflow}px`);
await small.screenshot({ path: path.join(SHOTS, "09-detail-320.png"), fullPage: true });

await browser.close();

check("no JS errors in console", errors.length === 0, errors.slice(0, 5).join(" | "));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
