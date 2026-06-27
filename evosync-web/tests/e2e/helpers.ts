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
  // Botão de logout é um <Button size="icon" aria-label="Sair"> com ícone LogOut.
  // Está presente em:
  //   - AdminShell (sidebar, user card)
  //   - Layout do operador (header topbar)
  const logoutBtn = page.locator('button[aria-label="Sair"]').first();
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
        const pageBadge = page.locator('span', { hasText: /no catálogo/i }).first();
        if (await pageBadge.isVisible().catch(() => false)) {
          const txt = (await pageBadge.textContent()) ?? "";
          const m = txt.match(/(\d+)/);
          return m ? Number(m[1]) : -1;
        }
        const headerBadge = page.locator('span:text-is("Catálogo:") + span').first();
        if (await headerBadge.isVisible().catch(() => false)) {
          const txt = (await headerBadge.textContent()) ?? "";
          const m = txt.match(/(\d+)/);
          return m ? Number(m[1]) : -1;
        }
        return -1;
      },
      { timeout: 15_000 }
    )
    .toBe(expected);
}

/**
 * Espera o badge "X para envio" do header mostrar o valor esperado.
 */
export async function waitForSelectionCount(
  page: Page,
  expected: number
): Promise<void> {
  await expect
    .poll(
      async () => {
        const pageBadge = page
          .locator('span', { hasText: /^\d+ para envio$/i })
          .first();
        if (await pageBadge.isVisible().catch(() => false)) {
          const txt = (await pageBadge.textContent()) ?? "";
          const m = txt.match(/(\d+)/);
          return m ? Number(m[1]) : -1;
        }
        const headerBadge = page.locator('span:text-is("Para envio:") + span').first();
        if (await headerBadge.isVisible().catch(() => false)) {
          const txt = (await headerBadge.textContent()) ?? "";
          const m = txt.match(/(\d+)/);
          return m ? Number(m[1]) : -1;
        }
        return -1;
      },
      { timeout: 10_000 }
    )
    .toBe(expected);
}

/**
 * Espera o badge "X opt-out" do header mostrar o valor esperado.
 */
export async function waitForOptOutCount(
  page: Page,
  expected: number
): Promise<void> {
  await expect
    .poll(
      async () => {
        const pageBadge = page
          .locator('span', { hasText: /^\d+ opt-out$/i })
          .first();
        if (await pageBadge.isVisible().catch(() => false)) {
          const txt = (await pageBadge.textContent()) ?? "";
          const m = txt.match(/(\d+)/);
          return m ? Number(m[1]) : -1;
        }
        return -1;
      },
      { timeout: 10_000 }
    )
    .toBe(expected);
}

export async function clearAllContacts(page: Page): Promise<void> {
  // Estratégia: chama as APIs diretamente via page.request (mais confiável
  // que UI clicks em testes E2E que dependem de animações e estado do
  // shadcn/ui). page.request compartilha os cookies da page (autenticação).
  //
  // Vantagens sobre a abordagem de UI clicks:
  // - Sem dependência em animações do AlertDialog
  // - Sem race conditions com debounce da seleção
  // - Funciona mesmo se houver outros dialogs abertos de runs anteriores
  try {
    await page.request.post("/api/contacts/clear");
  } catch {
    /* ignora — pode falhar se não autenticado, mas o test já fez login */
  }
  // Limpar seleção persistida (a seleção do tenant pode ter IDs órfãos
  // de runs anteriores)
  try {
    await page.request.put("/api/contacts/selection", {
      data: { ids: [] },
    });
  } catch {
    /* idem */
  }
  await page.reload();
  await waitForContactsCount(page, 0);
  const todosBtn = page.locator('button:has-text("Todos")').first();
  if (await todosBtn.isVisible().catch(() => false)) {
    await todosBtn.click();
  }
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
