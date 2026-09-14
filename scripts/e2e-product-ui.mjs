/**
 * Playwright UI check: admin Add Product — categories, size charts, barcode, form stays visible.
 * Run: node scripts/e2e-product-ui.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });

const BASE = process.env.APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || "admin@epicvanskap.com";
const ADMIN_PASS =
  process.env.INITIAL_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "EpicVanskap@2026";

const bugs = [];
const ok = [];

function assert(cond, msg) {
  if (cond) ok.push(msg);
  else bugs.push(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(25000);

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

  try {
    // Staff login via API then inject token if the UI uses localStorage
    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    });
    const loginJson = await loginRes.json().catch(() => ({}));
    const token = loginJson?.data?.token;
    assert(loginRes.ok() && token, `admin API login (${loginRes.status()})`);

    await page.goto(`${BASE}/admin/account`, { waitUntil: "domcontentloaded" });
    if (token) {
      await page.evaluate((t) => {
        localStorage.setItem("jab_auth_token", t);
        sessionStorage.setItem("jab_auth_token", t);
      }, token);
    }

    // Prefer UI login if still on auth
    await page.goto(`${BASE}/admin/product-management`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);

    // If auth form present, fill it
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(ADMIN_EMAIL);
      await page.locator('input[type="password"]').first().fill(ADMIN_PASS);
      await page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login")').first().click();
      await page.waitForTimeout(2000);
      await page.goto(`${BASE}/admin/product-management`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
    }

    const addBtn = page.getByRole("button", { name: /Add Product/i }).first();
    assert(await addBtn.isVisible().catch(() => false), "Add Product button visible");
    await addBtn.click();
    await page.waitForTimeout(800);

    const dialog = page.locator('[role="dialog"][aria-label*="product" i], .product-editor-portal').first();
    assert(await dialog.isVisible().catch(() => false), "Add Product dialog open");

    const title = page.getByText(/Add New Product/i).first();
    assert(await title.isVisible().catch(() => false), "Add New Product heading visible");

    // Fill basics so form is interactive
    const nameInput = page.locator("#product-manager-form input").first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(`PW Test Kit ${Date.now()}`);
    }

    // Select categories (multi) — click known edition chips if present
    const catNames = ["Fan Edition", "Player Edition", "Premier League", "Retro", "Kids"];
    let clickedCats = 0;
    for (const name of catNames) {
      const chip = page.locator("#product-manager-form label").filter({ hasText: new RegExp(`^${name}$`, "i") }).first();
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        clickedCats += 1;
        await page.waitForTimeout(120);
      }
    }
    assert(clickedCats > 0, `category chips clicked (${clickedCats})`);
    assert(await title.isVisible().catch(() => false), "form still visible after category select");

    // Select measurement charts (multi)
    const chartNames = ["Fan Edition", "Player Edition", "Kids"];
    let clickedCharts = 0;
    for (const name of chartNames) {
      const chip = page
        .locator("label")
        .filter({ hasText: new RegExp(`^${name}$`, "i") })
        .first();
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        clickedCharts += 1;
        await page.waitForTimeout(120);
      }
    }
    assert(clickedCharts > 0, `size chart chips clicked (${clickedCharts})`);
    assert(await title.isVisible().catch(() => false), "form still visible after size chart select");

    // Barcode field — must be auto, no Manual/None toggles
    const barcodeLabel = page.locator("label", { hasText: /^Barcode$/i }).first();
    assert(await barcodeLabel.isVisible().catch(() => false), "Barcode field present");
    const manualToggle = page.locator('button:has-text("manual"), button:has-text("Manual"), button:has-text("none"), button:has-text("None")');
    const badToggles = await manualToggle.count();
    assert(badToggles === 0, "no Manual/None barcode toggles in product form");

    const barcodeInput = page.locator('label:has-text("Barcode")').locator("..").locator("input").first();
    const barcodeVal = await barcodeInput.inputValue().catch(() => "");
    assert(/^\d{8,}$/.test(barcodeVal) || barcodeVal.length >= 8, `auto barcode filled (${barcodeVal || "empty"})`);

    // Brand select
    const brandSelect = page.locator("#product-manager-form select").first();
    if (await brandSelect.isVisible().catch(() => false)) {
      await brandSelect.selectOption({ index: 1 }).catch(() => {});
    }

    // Price
    const priceInputs = page.locator("#product-manager-form input[placeholder*='1150'], #product-manager-form input[placeholder*='e.g.']");
    if ((await priceInputs.count()) > 0) {
      await priceInputs.first().fill("1200");
    }

    assert(pageErrors.length === 0, `no page JS errors (${pageErrors.join(" | ") || "none"})`);

    // Close without saving (confirm dialog)
    const cancelBtn = page.getByRole("button", { name: /^Cancel$/i }).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      const keepOrClose = page.getByRole("button", { name: /Close form|Keep editing/i });
      if (await keepOrClose.first().isVisible().catch(() => false)) {
        await page.getByRole("button", { name: /Close form/i }).click().catch(() => {});
      }
    }
  } catch (err) {
    bugs.push(`playwright crashed: ${err?.message || err}`);
  } finally {
    await browser.close();
  }

  console.log("\n=== Playwright product UI ===");
  console.log("OK:", ok);
  console.log("BUGS:", bugs);
  if (bugs.length) process.exit(1);
}

main();
