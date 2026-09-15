CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`assistantType` enum('tutor','management','payment') NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`submittedAnswer` text NOT NULL,
	`isCorrect` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonId` int NOT NULL,
	`prompt` text NOT NULL,
	`answer` varchar(255) NOT NULL,
	`explanation` text NOT NULL,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pathId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `topics_id` PRIMARY KEY(`id`)
);
