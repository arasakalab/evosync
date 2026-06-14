CREATE TABLE `contact_list_members` (
	`list_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`added_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`list_id`, `contact_id`),
	FOREIGN KEY (`list_id`) REFERENCES `contact_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_list_members_contact_idx` ON `contact_list_members` (`contact_id`);--> statement-breakpoint
CREATE TABLE `contact_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_lists_tenant_idx` ON `contact_lists` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contact_lists_tenant_name_idx` ON `contact_lists` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `contact_selections` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`selected_ids` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `name` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `lists` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `opt_out` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `updated_at` text;--> statement-breakpoint
UPDATE `contacts` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE INDEX `contacts_tenant_opt_out_idx` ON `contacts` (`tenant_id`,`opt_out`);--> statement-breakpoint
CREATE INDEX `contacts_tenant_name_idx` ON `contacts` (`tenant_id`,`name`);