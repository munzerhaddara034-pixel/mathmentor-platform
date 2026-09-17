CREATE TABLE `exam_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`examId` varchar(120) NOT NULL,
	`specialization` varchar(80) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`answered` int NOT NULL DEFAULT 0,
	`percentage` int NOT NULL DEFAULT 0,
	`durationSeconds` int NOT NULL,
	`timeSpentSeconds` int NOT NULL DEFAULT 0,
	`sectionSnapshot` text NOT NULL,
	`skillSnapshot` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exam_attempts_id` PRIMARY KEY(`id`)
);
