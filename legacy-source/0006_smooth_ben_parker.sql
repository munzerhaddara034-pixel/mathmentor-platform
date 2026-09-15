CREATE TABLE `contest_contents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`lessonId` int,
	`topic` varchar(120) NOT NULL,
	`durationSeconds` int NOT NULL DEFAULT 120,
	`isPublished` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contest_contents_id` PRIMARY KEY(`id`)
);
