import { Page, expect } from "@playwright/test";

/**
 * Helpers compartilhados pelos specs E2E.
 */

export const E2E_USERS = {
  tenant1: { email: "operator@e2e.test", password: "e2e1234" },
  tenant2: { email: "operator2@e2e.test", password: "e2e1234" },
} as const;

export async function login(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto("/admin/login");
  await page.locator('input[name="email"], input[type="email"]').first().fill(user.email);
  await page.locator('input[name="password"], input[type="password"]')
    .first()
    .fill(user.password);
  await page.locator('button[type="submit"]').first().click();
  // Espera redirecionar para /conexao (ou /)
  await page.waitForURL((url) => !url.pathname.includes("/admin/login"), {
    timeout: 20_000,
  });
}

export async function logout(page: Page): Promise<void> {
  // Procura botão "Sair" no header (LogoutButton)
  const logoutBtn = page.locator("button:has-text('Sair')").first();
  if (await logoutBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForURL(/\/admin\/login/, { timeout: 5_000 }).catch(() => {});
  }
}

export async function gotoContatos(page: Page): Promise<void> {
  await page.goto("/contatos");
  await expect(page.locator("h1", { hasText: "Contatos" })).toBeVisible();
}

export async function importCsvInline(
  page: Page,
  rows: Array<Record<string, string>>
): Promise<void> {
  // Cria um CSV a partir das rows e injeta via input file
  const headers = Object.keys(rows[0] || { numero: "" });
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => (r[h] || "").replace(/,/g, ";")).join(",")),
  ].join("\n");
  const buffer = Buffer.from(csv, "utf-8");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "test.csv",
    mimeType: "text/csv",
    buffer,
  });
  // Espera toast de sucesso
  await page
    .locator('[data-sonner-toast] :text-matches(/adicionados|atualizados|inalterados/)')
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
}

export async function waitForContactsCount(
  page: Page,
  expected: number
): Promise<void> {
  await expect
    .poll(
      async () => {
        const txt = await page
          .locator("text=/\\d+\\s+contatos?/")
          .first()
          .textContent();
        const m = txt?.match(/(\d+)/);
        return m ? Number(m[1]) : -1;
      },
      { timeout: 15_000 }
    )
    .toBe(expected);
}

export async function clearAllContacts(page: Page): Promise<void> {
  await page.locator("button:has-text('Limpar tudo')").first().click();
  await page
    .locator('[role="alertdialog"], [role="dialog"]')
    .filter({ hasText: "Limpar contatos" })
    .locator("button:has-text('Limpar tudo')")
    .last()
    .click();
  await page.waitForTimeout(500);
}

/**
 * Seleciona N primeiras linhas visíveis clicando no checkbox.
 */
export async function selectFirstN(page: Page, n: number): Promise<void> {
  const checkboxes = page.locator('tbody input[type="checkbox"]');
  const count = Math.min(n, await checkboxes.count());
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).click();
  }
}
