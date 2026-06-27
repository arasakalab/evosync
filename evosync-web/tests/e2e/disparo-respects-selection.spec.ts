import { test, expect } from "@playwright/test";
import {
  E2E_USERS,
  login,
  gotoContatos,
  clearAllContacts,
  importCsvInline,
  waitForContactsCount,
  waitForSelectionCount,
} from "./helpers";

/**
 * Marcar contatos na aba Todos e disparar deve enviar apenas os IDs marcados.
 */
test.describe("Disparo respeita seleção", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);
  });

  test("marca 2 de 5 na aba Todos → Disparo envia exatamente 2 IDs", async ({
    page,
  }) => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      numero: `5511DISP0${i}`,
      nome: `Disp User ${i}`,
    }));
    await importCsvInline(page, rows);
    await waitForContactsCount(page, 5);
    await expect(page.locator("tbody tr")).toHaveCount(5);

    const checkboxes = page.locator('tbody input[type="checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(2).click();
    await page.waitForTimeout(1500);
    await waitForSelectionCount(page, 2);

    let capturedContactIds: string[] | undefined;
    await page.route("**/api/send/start", async (route) => {
      const body = route.request().postDataJSON() as {
        contactIds?: string[];
      };
      capturedContactIds = body.contactIds;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/disparo");
    await expect(page.locator("h1", { hasText: "Disparo" })).toBeVisible();
    await expect(page.getByText(/2 contato.*marcado/i)).toBeVisible();

    await page.getByRole("button", { name: "Iniciar" }).click();

    await expect
      .poll(() => capturedContactIds?.length ?? 0, { timeout: 10_000 })
      .toBe(2);
    expect(capturedContactIds).toHaveLength(2);
  });
});
