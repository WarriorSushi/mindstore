import { expect, test } from "@playwright/test";

test("docs home renders", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.locator("article h1").filter({ hasText: "MindStore Docs" })).toBeVisible();
  await expect(page.locator("article").getByRole("link", { name: "Getting Started" })).toBeVisible();
});
