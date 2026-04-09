import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@corp.com";
const ADMIN_PASSWORD = "He!!0World";

const SELLER_EMAIL = "seller001@sportvault.com";
const SELLER_PASSWORD = "ExampleSeed1!!";

const BUYER_EMAIL = "buyer001@sportvault.com";
const BUYER_PASSWORD = "ExampleSeed1!!";

test("full system flow: seller creates product, admin approves, buyer purchases", async ({ page }) => {
  const productName = `Test Ball ${Date.now()}`;
  const startingQty = 10;
  const price = 25;

  // Seller login
  await page.goto("/login");
  await page.locator("input[type='email']").fill(SELLER_EMAIL);
  await page.locator("input[type='password']").fill(SELLER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/seller");

  // Seller inventory page
  await page.getByRole("link", { name: /^inventory$/i }).click();
  await page.waitForURL("**/seller/inventory");
  await page.waitForLoadState("networkidle");

  // Add item
  await page.getByPlaceholder("Item name").fill(productName);
  await page.getByPlaceholder("Quantity").fill(String(startingQty));
  await page.getByPlaceholder("Price").fill(String(price));
  await page.getByRole("button", { name: /add item/i }).click();

  // Verify seller sees product preview/row
  await expect(page.getByText(productName)).toBeVisible();

  // Seller logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");

  // Admin login
  await page.locator("input[type='email']").fill(ADMIN_EMAIL);
  await page.locator("input[type='password']").fill(ADMIN_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/admin");

  // Admin product inventory
  await page.getByRole("link", { name: /^product inventory$/i }).click();
  await page.waitForURL("**/admin/products");
  await page.waitForLoadState("networkidle");

  // Filter by product name
  await page.getByPlaceholder("Type to filter…").fill(productName);
  await expect(page.getByText(productName)).toBeVisible();

  // Select first visible row and approve via Set Active
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: /set active/i }).click();

  // Admin logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");

  // Buyer login
  await page.locator("input[type='email']").fill(BUYER_EMAIL);
  await page.locator("input[type='password']").fill(BUYER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/buyer");

  // Buyer home
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Search products").fill(productName);
  await expect(page.getByText(productName)).toBeVisible();
  await page.getByRole("button", { name: /add to cart/i }).click();

  // Accept add-to-cart alert
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  // Buyer cart
  await page.getByRole("link", { name: /^shopping cart$/i }).click();
  await page.waitForURL("**/buyer/cart");
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByRole("link", { name: /proceed to checkout/i }).click();
  await page.waitForURL("**/buyer/checkout");

  // Fill checkout form
  await page.getByPlaceholder("Full Name").fill("James Carter");
  await page.getByPlaceholder("Address").fill("123 Test Street");
  await page.getByPlaceholder("City").fill("Atlanta");
  await page.getByPlaceholder("State").fill("GA");
  await page.getByPlaceholder("Zip Code").fill("30303");
  await page.getByPlaceholder("Card Number").fill("4111111111111111");
  await page.getByPlaceholder("MM/YY").fill("12/30");
  await page.getByPlaceholder("CVV").fill("123");

  // Accept successful checkout alert
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.getByRole("button", { name: /place order/i }).click();
  await page.waitForURL("**/buyer/orders");

  // Order history contains product
  await expect(page.getByText(productName)).toBeVisible();

  // Buyer logout
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");

  // Seller logs back in to verify inventory decreased
  await page.locator("input[type='email']").fill(SELLER_EMAIL);
  await page.locator("input[type='password']").fill(SELLER_PASSWORD);
  await page.locator("button[type='submit']").click();
  await page.waitForURL("**/seller");

  await page.getByRole("link", { name: /^inventory$/i }).click();
  await page.waitForURL("**/seller/inventory");
  await page.waitForLoadState("networkidle");

  const productNameInput = page.locator(`input[value="${productName}"]`).first();
  await expect(productNameInput).toBeVisible();

  const row = productNameInput.locator("xpath=ancestor::tr");
  const quantityInput = row.locator('input[type="number"]').first();

  await expect(quantityInput).toHaveValue("9");
});