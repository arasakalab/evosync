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
 * Spec 4 (TEST-6.3 do ADR-001 — variação simplificada):
 *  Verifica que "Ver selecionados" filtra a tabela pelos marcados.
 */
test.describe("Ver selecionados filtra a tabela", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);
  });

  test("Ver selecionados mostra apenas marcados", async ({ page }) => {
    // Importa 5 via CSV inline
    const rows = Array.from({ length: 5 }, (_, i) => ({
      numero: `5511MODE0${i}`,
      nome: `Mod User ${i}`,
    }));
    await importCsvInline(page, rows);
    await waitForContactsCount(page, 5);

    // Selecionar 2 dos 5
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(2).click();
    await page.waitForTimeout(500);
    await waitForSelectionCount(page, 2);

    // Abrir visão "Ver selecionados" no painel de envio
    await page.getByRole("button", { name: /Ver selecionados/i }).click();

    // Deve ver 2 linhas
    const visibleRows = page.locator("tbody tr");
    await expect(visibleRows).toHaveCount(2, { timeout: 5_000 });
  });
});
