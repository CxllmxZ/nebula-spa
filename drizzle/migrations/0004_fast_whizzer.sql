ALTER TABLE `bookings` ADD `customer_booking_no` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `anonymized_at` integer;

--> statement-breakpoint
UPDATE `bookings` 
SET `customer_booking_no` = (
    SELECT 
        COUNT(*) 
    FROM `bookings` b2 
    WHERE b2.`customer_phone` = `bookings`.`customer_phone` 
    AND (b2.`created_at` < `bookings`.`created_at` 
    OR (b2.`created_at` = `bookings`.`created_at` 
    AND b2.`id` <= `bookings`.`id`))
);