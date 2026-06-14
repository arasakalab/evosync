import { test, expect } from "@playwright/test";
import {
  E2E_USERS,
  login,
  gotoContatos,
  importCsvInline,
  clearAllContacts,
  logout,
} from "./helpers";

/**
 * Spec 3 (TEST-6.4 do ADR-001):
 *  Tenant A importa 5 contatos. Tenant B importa 5 contatos.
 *  Tenant A não vê contatos do Tenant B (e vice-versa).
 */
test.describe("Isolamento multi-tenant", () => {
  test("Tenant A e Tenant B têm catálogos isolados", async ({ page }) => {
    // 1. Tenant A: importar 5 contatos
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);

    const rowsA = Array.from({ length: 5 }, (_, i) => ({
      numero: `5511AAAA0${i}`,
      nome: `TenantA ${i}`,
    }));
    await importCsvInline(page, rowsA);
    await expect(page.locator("text=/5\\s+contatos?/")).toBeVisible({
      timeout: 15_000,
    });

    // 2. Logout
    await logout(page);

    // 3. Tenant B: importar 5 contatos (mesmo range de numero, mas tenantId diferente)
    await login(page, E2E_USERS.tenant2);
    await gotoContatos(page);
    await clearAllContacts(page);

    const rowsB = Array.from({ length: 5 }, (_, i) => ({
      numero: `5511BBBB0${i}`,
      nome: `TenantB ${i}`,
    }));
    await importCsvInline(page, rowsB);
    await expect(page.locator("text=/5\\s+contatos?/")).toBeVisible({
      timeout: 15_000,
    });

    // Conferir: Tenant B vê apenas seus 5 contatos
    for (const r of rowsB) {
      await expect(page.locator(`text=${r.nome}`).first()).toBeVisible();
    }
    // Conferir: Tenant B NÃO vê contatos do Tenant A
    for (const r of rowsA) {
      await expect(page.locator(`text=${r.nome}`).first()).not.toBeVisible();
    }

    // 4. Logout + login Tenant A: idem
    await logout(page);
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);

    for (const r of rowsA) {
      await expect(page.locator(`text=${r.nome}`).first()).toBeVisible();
    }
    for (const r of rowsB) {
      await expect(page.locator(`text=${r.nome}`).first()).not.toBeVisible();
    }
  });

  test("Tenant A não consegue ler contato do Tenant B via API direta", async ({
    page,
    request,
  }) => {
    // Login como Tenant A, importa 1 contato
    await login(page, E2E_USERS.tenant1);
    await gotoContatos(page);
    await clearAllContacts(page);
    await importCsvInline(page, [
      { numero: "5511AONLY01", nome: "Only A" },
    ]);
    await expect(page.locator("text=/1\\s+contato/")).toBeVisible({
      timeout: 15_000,
    });

    // Pega o id via list
    const listA = await request.get("/api/contacts");
    expect(listA.ok()).toBeTruthy();
    const dataA = await listA.json();
    expect(dataA.contacts.length).toBe(1);
    const contactIdA = dataA.contacts[0].id;

    // Logout + login Tenant B
    await logout(page);
    await login(page, E2E_USERS.tenant2);

    // Tenant B tenta GET /api/contacts/:id com id do Tenant A → 404
    const res = await request.get(`/api/contacts/${contactIdA}`);
    expect(res.status()).toBe(404);

    // Tenant B tenta PATCH /api/contacts/:id do Tenant A → 404
    const patch = await request.patch(`/api/contacts/${contactIdA}`, {
      data: { name: "hacked" },
    });
    expect(patch.status()).toBe(404);

    // Tenant B tenta DELETE /api/contacts/:id do Tenant A → 404
    const del = await request.delete(`/api/contacts/${contactIdA}`);
    expect(del.status()).toBe(404);
  });
});
