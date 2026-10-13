CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`name` text NOT NULL,
	`line_user_id` text,
	`line_notify_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_unique` ON `customers` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_line_user_id_unique` ON `customers` (`line_user_id`);--> statement-breakpoint
CREATE TABLE `line_link_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `line_link_codes_purpose_idx` ON `line_link_codes` (`purpose`,`used_at`);--> statement-breakpoint
CREATE TABLE `line_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_line_user_id` text,
	`owner_notify_enabled` integer DEFAULT true NOT NULL,
	`staff_group_id` text,
	`staff_group_status` text DEFAULT 'not_linked' NOT NULL,
	`staff_group_linked_at` integer,
	`staff_group_disconnected_at` integer,
	`summary_enabled` integer DEFAULT true NOT NULL,
	`summary_time` text DEFAULT '08:00' NOT NULL,
	`last_summary_date` text,
	`last_summary_sent_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "line_settings_singleton" CHECK("id" = 1)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `customer_id` integer REFERENCES customers(id);--> statement-breakpoint
ALTER TABLE `bookings` ADD `updated_at` integer;--> statement-breakpoint
CREATE INDEX `bookings_customer_idx` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE INDEX `bookings_updated_idx` ON `bookings` (`updated_at`);
UPDATE `bookings` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;