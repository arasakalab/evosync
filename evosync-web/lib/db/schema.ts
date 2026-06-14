/**
 * Schema Drizzle para o EvoSync.
 *
 * Convenções:
 *  - Timestamps: ISO 8601 string (legível, timezone-aware)
 *  - IDs: text gerado via crypto.randomUUID() (sem dependência externa)
 *  - Multi-tenancy: `tenant_id` em todas as tabelas de negócio
 *  - JSON fields: serializados como TEXT (SQLite JSON1 extension)
 *  - Senhas: bcrypt hash (nunca plain text)
 *  - API keys: AES-256-GCM encrypted (formato iv:ciphertext:tag, base64)
 */

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ============================================================================
// Tenants — empresas/organizações que usam o EvoSync
// ============================================================================

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["active", "suspended", "cancelled"] })
      .notNull()
      .default("active"),
    // Evolution API config (cada tenant traz a sua — BYO)
    evoUrl: text("evo_url"),
    evoApiKeyEncrypted: text("evo_api_key_encrypted"),
    evoInstance: text("evo_instance"),
    // OpenCode IA model (opcional, default = "")
    opencodeModel: text("opencode_model").notNull().default(""),
    // Defaults de envio (cada tenant pode customizar)
    delayMin: integer("delay_min").notNull().default(8),
    delayMax: integer("delay_max").notNull().default(25),
    dailyLimit: integer("daily_limit").notNull().default(200),
    resendSent: integer("resend_sent", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    slugIdx: uniqueIndex("tenants_slug_idx").on(t.slug),
    statusIdx: index("tenants_status_idx").on(t.status),
  })
);

// ============================================================================
// Users — usuários vinculados a 1 tenant
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    // tenantId é NULLABLE: 'super_admin' é global, sem tenant.
    // Para 'owner' e 'operator' a aplicação garante que sempre tem tenant.
    tenantId: text("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    // 'super_admin' (global, sem tenant) | 'owner' | 'operator'
    role: text("role", { enum: ["super_admin", "owner", "operator"] })
      .notNull()
      .default("operator"),
    status: text("status", { enum: ["active", "invited", "disabled"] })
      .notNull()
      .default("active"),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    tenantIdx: index("users_tenant_idx").on(t.tenantId),
  })
);

// ============================================================================
// Invites — convites pendentes (admin cria conta, cliente define senha via link)
// ============================================================================

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["owner", "operator"] })
      .notNull()
      .default("operator"),
    token: text("token").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    tokenIdx: uniqueIndex("invites_token_idx").on(t.token),
    tenantIdx: index("invites_tenant_idx").on(t.tenantId),
  })
);

// ============================================================================
// Licenses — 30 dias por padrão, gerenciada pelo admin
// ============================================================================

export const licenses = sqliteTable(
  "licenses",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    issuedAt: text("issued_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    expiresAt: text("expires_at").notNull(),
    status: text("status", { enum: ["active", "expired", "revoked"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => ({
    tenantIdx: index("licenses_tenant_idx").on(t.tenantId),
    statusIdx: index("licenses_status_idx").on(t.status),
  })
);

// ============================================================================
// Tenant Settings — key/value por tenant (substitui config.json)
// ============================================================================

export const tenantSettings = sqliteTable(
  "tenant_settings",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.key] }),
  })
);

// ============================================================================
// Contacts — escopados por tenant
// ============================================================================

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    name: text("name"),
    // JSON: { nome?: string, empresa?: string, ... }
    fields: text("fields").notNull().default("{}"),
    // JSON: ["vip", "lead-quente", ...]
    tags: text("tags").notNull().default("[]"),
    // JSON: ["promo-jan", "black-friday", ...]
    lists: text("lists").notNull().default("[]"),
    // boolean no app (Drizzle converte 0/1 ↔ false/true)
    optOut: integer("opt_out", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    tenantIdx: index("contacts_tenant_idx").on(t.tenantId),
    tenantNumberIdx: uniqueIndex("contacts_tenant_number_idx").on(
      t.tenantId,
      t.number
    ),
    optOutIdx: index("contacts_tenant_opt_out_idx").on(t.tenantId, t.optOut),
    nameIdx: index("contacts_tenant_name_idx").on(t.tenantId, t.name),
  })
);

// ============================================================================
// Contact Lists — segmentações nomeadas pelo tenant (promo-jan, black-friday, …)
// ============================================================================

export const contactLists = sqliteTable(
  "contact_lists",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    tenantIdx: index("contact_lists_tenant_idx").on(t.tenantId),
    tenantNameIdx: uniqueIndex("contact_lists_tenant_name_idx").on(
      t.tenantId,
      t.name
    ),
  })
);

// ============================================================================
// Contact List Members — N:N entre contacts e contact_lists
// ============================================================================

export const contactListMembers = sqliteTable(
  "contact_list_members",
  {
    listId: text("list_id")
      .notNull()
      .references(() => contactLists.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    addedAt: text("added_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.listId, t.contactId] }),
    contactIdx: index("contact_list_members_contact_idx").on(t.contactId),
  })
);

// ============================================================================
// Contact Selections — seleção multi-tenant (1 linha por tenant, JSON de ids)
// ============================================================================

export const contactSelections = sqliteTable(
  "contact_selections",
  {
    tenantId: text("tenant_id")
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    selectedIds: text("selected_ids").notNull().default("[]"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  }
);

// ============================================================================
// Schedules — agendamentos de disparo (substitui scheduled_messages.json)
// ============================================================================

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status", {
      enum: [
        "pending",
        "running",
        "sent",
        "failed",
        "missed",
        "cancelled",
      ],
    })
      .notNull()
      .default("pending"),
    message: text("message").notNull().default(""),
    mediaPath: text("media_path").notNull().default(""),
    mediaType: text("media_type").notNull().default("image"),
    delayMin: integer("delay_min").notNull().default(8),
    delayMax: integer("delay_max").notNull().default(25),
    dailyLimit: integer("daily_limit").notNull().default(200),
    validateFirst: integer("validate_first", { mode: "boolean" })
      .notNull()
      .default(true),
    skipSentHistory: integer("skip_sent_history", { mode: "boolean" })
      .notNull()
      .default(false),
    contactMode: text("contact_mode", { enum: ["snapshot", "current"] })
      .notNull()
      .default("snapshot"),
    // JSON: [{ number, fields }, ...] — snapshot de contatos (modo snapshot)
    contacts: text("contacts").notNull().default("[]"),
    // JSON: ["<contactId>", ...] — ids selecionados no momento do agendamento (modo current)
    selectedContactIds: text("selected_contact_ids")
      .notNull()
      .default("[]"),
    error: text("error").notNull().default(""),
    summary: text("summary").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    tenantIdx: index("schedules_tenant_idx").on(t.tenantId),
    statusIdx: index("schedules_status_idx").on(t.status),
    scheduledIdx: index("schedules_scheduled_idx").on(t.scheduledAt),
  })
);

// ============================================================================
// Sent Log — histórico de números já enviados (substitui sent_log.json)
// ============================================================================

export const sentLog = sqliteTable(
  "sent_log",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    sentAt: text("sent_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.number] }),
  })
);

// ============================================================================
// Audit Log — rastreabilidade de ações (v1 básico, sem UI)
// ============================================================================

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    // JSON: dados específicos da ação
    details: text("details").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    tenantIdx: index("audit_tenant_idx").on(t.tenantId),
    userIdx: index("audit_user_idx").on(t.userId),
    actionIdx: index("audit_action_idx").on(t.action),
    createdIdx: index("audit_created_idx").on(t.createdAt),
  })
);

// ============================================================================
// Type exports
// ============================================================================

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type TenantSetting = typeof tenantSettings.$inferSelect;
export type NewTenantSetting = typeof tenantSettings.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactList = typeof contactLists.$inferSelect;
export type NewContactList = typeof contactLists.$inferInsert;
export type ContactListMember = typeof contactListMembers.$inferSelect;
export type NewContactListMember = typeof contactListMembers.$inferInsert;
export type ContactSelection = typeof contactSelections.$inferSelect;
export type NewContactSelection = typeof contactSelections.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type SentLog = typeof sentLog.$inferSelect;
export type NewSentLog = typeof sentLog.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
