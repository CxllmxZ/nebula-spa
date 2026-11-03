ALTER TABLE `bookings` ADD `cancelled_by` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancel_reason` text;