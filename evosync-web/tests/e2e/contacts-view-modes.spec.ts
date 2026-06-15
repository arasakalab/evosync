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
 *  Verifica que a seleção atual é o que vai para o modo "Selecionados"
 *  do toggle de visualização.
 */
test.describe("Modo 'Selecionados' filtra a tabela", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);
  });

  test("modo Selecionados mostra apenas marcados", async ({ page }) => {
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

    // Trocar para modo "Selecionados"
    await page.locator("button:has-text('Selecionados')").first().click();

    // Deve ver 2 linhas
    const visibleRows = page.locator("tbody tr");
    await expect(visibleRows).toHaveCount(2, { timeout: 5_000 });

    // E o contador deve mostrar "2/5 contatos" (modo filtro ativo)
    // Usa textContent do badge (substring match) porque o regex com /
    // no Playwright inclui as barras como literais.
    await expect
      .poll(
        async () => {
          const badge = page
            .locator("span", { hasText: /contatos/ })
            .first();
          const txt = (await badge.textContent()) ?? "";
          return /2\/5/.test(txt) ? "ok" : txt;
        },
        { timeout: 5_000 }
      )
      .toBe("ok");
  });
});
