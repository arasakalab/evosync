CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_idx` ON `audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`number` text NOT NULL,
	`fields` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contacts_tenant_idx` ON `contacts` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_tenant_number_idx` ON `contacts` (`tenant_id`,`number`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'operator' NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_idx` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `invites_tenant_idx` ON `invites` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`issued_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `licenses_tenant_idx` ON `licenses` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `licenses_status_idx` ON `licenses` (`status`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`media_path` text DEFAULT '' NOT NULL,
	`media_type` text DEFAULT 'image' NOT NULL,
	`delay_min` integer DEFAULT 8 NOT NULL,
	`delay_max` integer DEFAULT 25 NOT NULL,
	`daily_limit` integer DEFAULT 200 NOT NULL,
	`validate_first` integer DEFAULT true NOT NULL,
	`skip_sent_history` integer DEFAULT false NOT NULL,
	`contact_mode` text DEFAULT 'snapshot' NOT NULL,
	`contacts` text DEFAULT '[]' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_tenant_idx` ON `schedules` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `schedules_status_idx` ON `schedules` (`status`);--> statement-breakpoint
CREATE INDEX `schedules_scheduled_idx` ON `schedules` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `sent_log` (
	`tenant_id` text NOT NULL,
	`number` text NOT NULL,
	`sent_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`tenant_id`, `number`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tenant_settings` (
	`tenant_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	PRIMARY KEY(`tenant_id`, `key`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`evo_url` text,
	`evo_api_key_encrypted` text,
	`evo_instance` text,
	`opencode_model` text DEFAULT '' NOT NULL,
	`delay_min` integer DEFAULT 8 NOT NULL,
	`delay_max` integer DEFAULT 25 NOT NULL,
	`daily_limit` integer DEFAULT 200 NOT NULL,
	`resend_sent` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_idx` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `tenants_status_idx` ON `tenants` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'operator' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_tenant_idx` ON `users` (`tenant_id`);