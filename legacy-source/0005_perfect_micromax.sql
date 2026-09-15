CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int,
	`title` varchar(180) NOT NULL,
	`status` enum('assigned','completed','reviewed') NOT NULL DEFAULT 'assigned',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `learning_paths` ADD `isPublished` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `isPublished` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `reviewStatus` enum('automatic','needs_professor','reviewed') DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `professorFeedback` text;