ALTER TABLE `tenants` ADD `paused_by_watchdog` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `paused_reason` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `paused_at` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `paused_count` integer DEFAULT 0 NOT NULL;