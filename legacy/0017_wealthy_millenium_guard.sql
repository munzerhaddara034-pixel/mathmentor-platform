CREATE TABLE `lesson_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonSlug` varchar(120) NOT NULL,
	`skill` varchar(120) NOT NULL,
	`language` enum('en','ar') NOT NULL DEFAULT 'en',
	`typedAnswer` text NOT NULL,
	`solutionSteps` text NOT NULL,
	`expectedAnswer` varchar(255) NOT NULL,
	`explanation` text NOT NULL,
	`isCorrect` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lesson_attempts_id` PRIMARY KEY(`id`)
);
