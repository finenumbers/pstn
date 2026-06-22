import { test, expect } from "@playwright/test";

test.describe("PSTN ranges page", () => {
  test("loads ranges page without client errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/ranges", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Телефонный план/i })).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
  });

  test("garTerritory filter chip can be removed", async ({ page }) => {
    await page.goto(
      "/ranges?filters.garTerritory=Город%20Москва",
      { waitUntil: "networkidle" }
    );
    await expect(
      page.getByText("Территория ГАР:", { exact: false })
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Убрать фильтр Территория ГАР" })
      .click();

    await expect(
      page.getByText("Активные фильтры:", { exact: true })
    ).toHaveCount(0);
    await expect(page).not.toHaveURL(/filters\.garTerritory/);
  });
});
