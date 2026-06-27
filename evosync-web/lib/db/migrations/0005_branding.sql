ALTER TABLE `tenants` ADD `logo_path` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `bg_image_path` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `favicon_path` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `primary_color` text DEFAULT '#0F9D58' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `accent_color` text DEFAULT '#25D366' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `bg_color` text DEFAULT '#F8FAFC' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `fg_color` text DEFAULT '#0F172A' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `font_family` text DEFAULT 'Inter' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `landing_title` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `landing_subtitle` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `landing_updated_at` text;