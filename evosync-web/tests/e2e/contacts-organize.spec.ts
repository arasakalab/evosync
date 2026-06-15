import { test, expect } from "@playwright/test";
import {
  E2E_USERS,
  login,
  gotoContatos,
  importCsvInline,
  clearAllContacts,
  selectFirstN,
  waitForContactsCount,
  waitForSelectionCount,
  waitForOptOutCount,
} from "./helpers";

/**
 * Spec 1 (TEST-6.1 do ADR-001):
 *  Importar CSV, criar lista, adicionar tag, marcar opt-out,
 *  conferir que o opt-out é respeitado.
 */
test.describe("Organizar contatos (importar + lista + tag + opt-out)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);
  });

  test("fluxo completo: importar → lista → tag → opt-out → conferir", async ({
    page,
  }) => {
    // 1. Importar CSV
    await importCsvInline(page, [
      { numero: "5511999990001", nome: "Alice", empresa: "Acme" },
      { numero: "5511999990002", nome: "Bob", empresa: "Globex" },
      { numero: "5511999990003", nome: "Carol", empresa: "Initech" },
    ]);

    // Espera 3 contatos aparecerem (polling)
    await waitForContactsCount(page, 3);

    // 2. Selecionar todos e abrir diálogo "Criar lista"
    await selectFirstN(page, 2); // Alice + Bob
    await waitForSelectionCount(page, 2);

    // Clica no botão "Criar lista" da barra de ação em massa
    // (a barra tem 1 botão "Criar lista" — abre o dialog)
    await page
      .locator("button:has-text('Criar lista')")
      .first()
      .click();

    // 3. Preencher nome e confirmar (escopo pelo dialog shadcn)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input#list-name').fill("VIP");
    await dialog
      .locator('button:has-text("Criar lista")')
      .last()
      .click();

    // Lista deve aparecer nos chips
    await expect(
      page.locator("button:has-text('VIP')").first()
    ).toBeVisible({ timeout: 5_000 });

    // 4. Adicionar tag aos selecionados (Alice + Bob)
    await page.locator("button:has-text('Tag')").first().click();
    const tagDialog = page.locator('[role="dialog"]');
    await expect(tagDialog).toBeVisible();
    await tagDialog.locator('input#tag-name').fill("promo");
    await tagDialog.locator('button:has-text("Aplicar")').click();

    // 5. Limpar seleção e selecionar só Carol
    await page.locator("button:has-text('Limpar seleção')").click();
    await page.waitForTimeout(300);

    // Localiza a linha do Carol (única sem tag) e seleciona
    const carolRow = page.locator("tr", { hasText: "5511999990003" }).first();
    await carolRow.click();
    await waitForSelectionCount(page, 1);

    // 6. Marcar Carol como opt-out
    await page.locator("button:has-text('Marcar opt-out')").click();
    await page.waitForTimeout(500);

    // 7. Conferir: badge "Opt-out" aparece na linha da Carol
    const carolOptOutBadge = carolRow.locator("text=Opt-out");
    await expect(carolOptOutBadge).toBeVisible({ timeout: 5_000 });

    // 8. Conferir: o contador "1 opt-out" aparece no header
    await waitForOptOutCount(page, 1);
  });
});
