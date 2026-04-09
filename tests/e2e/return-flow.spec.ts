import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@corp.com";
const ADMIN_PASSWORD = "He!!0World";

const SELLER_EMAIL = "seller001@sportvault.com";
const SELLER_PASSWORD = "ExampleSeed1!!";

const BUYER_EMAIL = "buyer001@sportvault.com";
const BUYER_PASSWORD = "ExampleSeed1!!";

test("buyer requests return and seller approves it", async ({ page }) => {
  const productName = `Return Test Ball ${Date.now()}`;
  const startingQty = 5;
  const price = 30;
  const returnReason = "Item arrived damaged";

  // Seller login
  await page.goto("/login");
  await page.locator("input[type='email']").fill(SELLER_EMAIL);
  await page.locator("input[type='password']").fill(SELLER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/seller");

  // Seller creates product
  await page.getByRole("link", { name: /^inventory$/i }).click();
  await page.waitForURL("**/seller/inventory");
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Item name").fill(productName);
  await page.getByPlaceholder("Quantity").fill(String(startingQty));
  await page.getByPlaceholder("Price").fill(String(price));
  await page.getByRole("button", { name: /add item/i }).click();

  await expect(page.getByText(productName)).toBeVisible();

  // Seller logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
  await page.waitForTimeout(1500);

  // Admin login
  await page.locator("input[type='email']").fill(ADMIN_EMAIL);
  await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/admin");
  await page.waitForTimeout(1000);

  // Admin approves product
  await page.getByRole("link", { name: /^product inventory$/i }).click();
  await page.waitForURL("**/admin/products");
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Type to filter…").fill(productName);
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: /set active/i }).click();

  // Admin logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
  await page.waitForTimeout(1500);

  // Buyer login
  await page.locator("input[type='email']").fill(BUYER_EMAIL);
  await page.locator("input[type='password']").fill(BUYER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/buyer");
  await page.waitForTimeout(1000);

  // Buyer purchases product
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Search products").fill(productName);
  await expect(page.getByText(productName)).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: /add to cart/i }).click();

  await page.getByRole("link", { name: /^shopping cart$/i }).click();
  await page.waitForURL("**/buyer/cart");
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByRole("link", { name: /proceed to checkout/i }).click();
  await page.waitForURL("**/buyer/checkout");

  await page.getByPlaceholder("Full Name").fill("James Carter");
  await page.getByPlaceholder("Address").fill("123 Test Street");
  await page.getByPlaceholder("City").fill("Atlanta");
  await page.getByPlaceholder("State").fill("GA");
  await page.getByPlaceholder("Zip Code").fill("30303");
  await page.getByPlaceholder("Card Number").fill("4111111111111111");
  await page.getByPlaceholder("MM/YY").fill("12/30");
  await page.getByPlaceholder("CVV").fill("123");

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: /place order/i }).click();
  await page.waitForURL("**/buyer/orders");

  // Open order detail
  const returnBtn = page.getByRole("button", { name: /return item/i }).first();
  await expect(returnBtn).toBeVisible();
  await returnBtn.click();

  await page.waitForURL(/\/buyer\/orders\/.+/);
  await page.waitForLoadState("networkidle");

  // Select item and submit return request
  await expect(page.getByText(/items purchased/i)).toBeVisible();
  await page.getByText(productName).click();
  await page.getByPlaceholder("Describe why you are returning this item…").fill(returnReason);
  await page.getByRole("button", { name: /submit return request/i }).click();

  await expect(page.getByText(/return request submitted/i)).toBeVisible();

  // Verify buyer sees pending return
  await page.getByRole("link", { name: /^returns$/i }).click();
  await page.waitForURL("**/buyer/returns");
  await expect(page.getByText(/my returns/i)).toBeVisible();
  await expect(page.getByText(productName).first()).toBeVisible();
  await expect(page.getByText(returnReason).first()).toBeVisible();
  await expect(page.getByText(/pending/i).first()).toBeVisible();

  // Buyer logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
  await page.waitForTimeout(1500);

  // Seller login
  await page.locator("input[type='email']").fill(SELLER_EMAIL);
  await page.locator("input[type='password']").fill(SELLER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/seller");
  await page.waitForTimeout(1000);

  // Seller opens returns page
  await page.getByRole("link", { name: /^returns$/i }).click();
  await page.waitForURL("**/seller/returns");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(/^returns$/i)).toBeVisible();

  // Expand order and approve pending return
  await page.getByText(/pending/i).first().click();
  await page.getByRole("button", { name: /select all pending/i }).click();
  await page.getByRole("button", { name: /approve/i }).click();

  // Do not depend only on the banner; give the page time to refresh
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // Seller logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
  await page.waitForTimeout(1500);

  // Buyer logs back in and verifies approved return
  await page.locator("input[type='email']").fill(BUYER_EMAIL);
  await page.locator("input[type='password']").fill(BUYER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/buyer");
  await page.waitForTimeout(1000);

  await page.getByRole("link", { name: /^returns$/i }).click();
  await page.waitForURL("**/buyer/returns");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(productName).first()).toBeVisible();
  await expect(page.getByText(returnReason).first()).toBeVisible();
  await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10000 });
});