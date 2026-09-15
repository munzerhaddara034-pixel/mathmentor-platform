CREATE TABLE `learning_paths` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`track` enum('lebanese','sat') NOT NULL,
	`level` enum('middle','secondary','sat') NOT NULL,
	`isPremium` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_paths_id` PRIMARY KEY(`id`),
	CONSTRAINT `learning_paths_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pathId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`topic` varchar(120) NOT NULL,
	`body` text NOT NULL,
	`sourceReference` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int NOT NULL,
	`percent` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`paymentMethod` varchar(40) NOT NULL DEFAULT 'whish_money',
	`reference` varchar(120),
	`receiptUrl` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_requests_id` PRIMARY KEY(`id`)
);
