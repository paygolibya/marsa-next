import { test, expect } from "@playwright/test";

// Real browser, real UI, real backend (the staging database) — the one
// thing nothing else in this test suite covers: does the actual checkout
// flow work when a real person clicks through it. Everything else this
// session verified server-side behavior directly; this clicks the buttons.
//
// Runs against the dedicated "e2e-test-store" / "E2E Test Product" seeded
// specifically for this suite (not real merchant data) — stable, known
// content these tests can assert on without depending on what a real
// merchant happens to have listed.

test("a buyer can browse the storefront, add a product to the cart, and complete a COD order", async ({ page }) => {
  await page.goto("/store/e2e-test-store");

  // The product is visible on the storefront's own page — the actual
  // storefront rendering pipeline (template selection, product card,
  // pricing) working end to end, not just the API returning data.
  await expect(page.getByText("E2E Test Product")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("100,00 د.ل")).toBeVisible();

  // Add to cart — real client-side state (useCart), not a server round trip.
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();

  // The cart drawer opens (real UI wiring: the add-to-cart handler
  // actually calls setCartOpen, not just updating state invisibly) and
  // shows the item, not "سلتك فارغة حاليًا" (empty cart).
  await expect(page.getByText("سلتك فارغة حاليًا")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "سلة التسوق" })).toBeVisible();

  // Proceed to checkout. Generous timeout: in Next dev mode the first hit to
  // a not-yet-compiled route (like /checkout here) compiles on demand and
  // can take well past Playwright's default 5s assertion timeout — the
  // navigation itself is real and fast once compiled, this just isn't a
  // fixed-latency wait.
  await page.getByRole("link", { name: "إتمام الطلب" }).click();
  await expect(page).toHaveURL(/\/checkout/, { timeout: 20000 });

  // Fill the real checkout form and place a real COD order — the
  // server-side order-creation route (already covered by integration
  // tests) wired correctly to the actual form fields, which nothing
  // server-side can verify.
  const buyerName = `E2E Playwright Buyer ${Date.now()}`;
  await page.getByLabel("الاسم الكامل").fill(buyerName);
  await page.getByLabel("رقم الهاتف").fill("0912345678");
  // The test store's courier is vanex, so city/area is a dependent pair of
  // <select>s (real shipping-price lookup), not a free-text field — backed
  // by a dedicated "E2E Test City" / "E2E Test Area" fixture row seeded into
  // the staging DB (vanexId 999999, well outside real Vanex's id space) so
  // this doesn't depend on real Vanex API data staying in sync.
  await page.getByLabel("المدينة").selectOption({ label: "E2E Test City" });
  // The area option's visible label includes its price ("E2E Test Area — 15,00 د.ل"),
  // so match by the option's value (the seeded area's own id) instead of its label text.
  const areaValue = await page
    .getByLabel("المنطقة")
    .locator("option", { hasText: "E2E Test Area" })
    .getAttribute("value");
  await page.getByLabel("المنطقة").selectOption(areaValue!);
  await page.getByLabel("العنوان بالتفصيل").fill("Test address, building 1");

  await page.getByRole("button", { name: /تأكيد الطلب|إتمام الطلب/ }).click();

  // Lands on the real confirmation page with a real order id — the whole
  // chain (form -> API -> DB write -> redirect with real query params)
  // actually worked.
  await expect(page).toHaveURL(/\/confirmation/, { timeout: 15000 });
  await expect(page.getByText("تم تأكيد طلبك")).toBeVisible();
  await expect(page.getByText("رقم الطلب")).toBeVisible();
});

test("the storefront's own per-store branding renders (not the generic platform page)", async ({ page }) => {
  await page.goto("/store/e2e-test-store");
  await expect(page).toHaveTitle("E2E Test Store");
});
