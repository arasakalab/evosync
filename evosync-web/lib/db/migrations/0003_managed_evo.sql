ALTER TABLE `tenants` ADD `evo_mode` text DEFAULT 'byo' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `evo_managed_status` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `evo_managed_error` text;