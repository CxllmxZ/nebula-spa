CREATE TABLE `blocked_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blocked_slots_time_idx` ON `blocked_slots` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`service_id` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`price` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_code_unique` ON `bookings` (`code`);--> statement-breakpoint
CREATE INDEX `bookings_time_idx` ON `bookings` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `bookings_code_idx` ON `bookings` (`code`);--> statement-breakpoint
CREATE TABLE `business_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_of_week` integer NOT NULL,
	`open_time` text,
	`close_time` text,
	`is_closed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_hours_day_unique` ON `business_hours` (`day_of_week`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`duration_min` integer NOT NULL,
	`price` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
