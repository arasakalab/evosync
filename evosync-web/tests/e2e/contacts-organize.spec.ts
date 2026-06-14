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

    // Espera 3 contatos aparecerem
    await expect(page.locator("text=/3\\s+contatos?/")).toBeVisible({
      timeout: 15_000,
    });

    // 2. Selecionar todos e abrir diálogo "Criar lista"
    await selectFirstN(page, 2); // Alice + Bob
    await expect(
      page.locator("text=/2\\s+selecionados?/")
    ).toBeVisible({ timeout: 5_000 });

    await page
      .locator("button:has-text('Criar lista')")
      .first()
      .click();

    // 3. Preencher nome e confirmar
    await page
      .locator('input#list-name')
      .fill("VIP");
    await page
      .locator("dialog button:has-text('Criar lista')")
      .last()
      .click();

    // Lista deve aparecer nos chips
    await expect(
      page.locator("button:has-text('VIP')").first()
    ).toBeVisible({ timeout: 5_000 });

    // 4. Adicionar tag aos selecionados (Alice + Bob)
    await page.locator("button:has-text('Tag')").first().click();
    await page.locator('input#tag-name').fill("promo");
    await page
      .locator("dialog button:has-text('Aplicar')")
      .last()
      .click();

    // 5. Limpar seleção e selecionar só Carol
    await page.locator("button:has-text('Limpar seleção')").click();
    await page.waitForTimeout(300);

    // Localiza a linha do Carol (única sem tag) e seleciona
    const carolRow = page.locator("tr", { hasText: "5511999990003" }).first();
    await carolRow.click();
    await expect(
      page.locator("text=/1\\s+selecionado\\b/")
    ).toBeVisible({ timeout: 5_000 });

    // 6. Marcar Carol como opt-out
    await page.locator("button:has-text('Marcar opt-out')").click();
    await page.waitForTimeout(500);

    // 7. Conferir: badge "Opt-out" aparece na linha da Carol
    const carolOptOutBadge = carolRow.locator("text=Opt-out");
    await expect(carolOptOutBadge).toBeVisible({ timeout: 5_000 });

    // 8. Conferir: o contador "1 opt-out" aparece no header
    await expect(page.locator("text=/1\\s+opt-out/")).toBeVisible();
  });
});
