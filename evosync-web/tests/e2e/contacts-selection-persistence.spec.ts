import { test, expect } from "@playwright/test";
import {
  E2E_USERS,
  login,
  gotoContatos,
  importCsvInline,
  clearAllContacts,
  selectFirstN,
} from "./helpers";

/**
 * Spec 2 (TEST-6.2 do ADR-001):
 *  Importar, selecionar 5, recarregar, conferir que continuam selecionados.
 *
 * A persistência da seleção é via PUT /api/contacts/selection (debounced 300ms).
 */
test.describe("Persistência da seleção entre reloads", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);
  });

  test("seleção persiste após reload", async ({ page }) => {
    // 1. Importar 10 contatos
    const rows = Array.from({ length: 10 }, (_, i) => ({
      numero: `5511999990${String(i).padStart(3, "0")}`,
      nome: `User ${i}`,
    }));
    await importCsvInline(page, rows);
    await expect(page.locator("text=/10\\s+contatos?/")).toBeVisible({
      timeout: 15_000,
    });

    // 2. Selecionar 5 primeiros
    await selectFirstN(page, 5);
    await expect(page.locator("text=/5\\s+selecionados?/")).toBeVisible({
      timeout: 5_000,
    });

    // 3. Esperar debounce de 300ms + sync
    await page.waitForTimeout(1_500);

    // 4. Recarregar a página
    await page.reload();

    // 5. Conferir que os 5 continuam selecionados
    await expect(
      page.locator("text=/5\\s+selecionados?/")
    ).toBeVisible({ timeout: 10_000 });

    // 6. Conferir que os 5 primeiros checkboxes estão marcados
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    for (let i = 0; i < 5; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  });
});
