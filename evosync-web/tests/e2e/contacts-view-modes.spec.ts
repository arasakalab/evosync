import { test, expect } from "@playwright/test";
import { E2E_USERS, login, gotoContatos, clearAllContacts } from "./helpers";

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
    // Importa 5 via API (mais rápido que CSV inline)
    const rows = Array.from({ length: 5 }, (_, i) => ({
      numero: `5511MODE0${i}`,
      nome: `Mod User ${i}`,
    }));
    const fileInput = page.locator('input[type="file"]').first();
    const csv = [
      "numero,nome",
      ...rows.map((r) => `${r.numero},${r.nome}`),
    ].join("\n");
    await fileInput.setInputFiles({
      name: "mode.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });
    await page
      .locator('[data-sonner-toast]')
      .first()
      .waitFor({ timeout: 15_000 })
      .catch(() => {});

    await expect(page.locator("text=/5\\s+contatos?/")).toBeVisible({
      timeout: 15_000,
    });

    // Selecionar 2 dos 5
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(2).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=/2\\s+selecionados?/")).toBeVisible();

    // Trocar para modo "Selecionados"
    await page.locator("button:has-text('Selecionados')").first().click();

    // Deve ver 2 linhas
    const visibleRows = page.locator("tbody tr");
    await expect(visibleRows).toHaveCount(2, { timeout: 5_000 });

    // E o contador deve mostrar "2/5"
    await expect(page.locator("text=/2\\/5\\s+contatos?/")).toBeVisible();
  });
});
