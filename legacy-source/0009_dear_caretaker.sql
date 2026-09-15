CREATE TABLE `daily_student_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`summaryDate` varchar(10) NOT NULL,
	`cohort` varchar(40) NOT NULL DEFAULT 'middle_school',
	`snapshot` text NOT NULL,
	`summary` text NOT NULL,
	`status` enum('draft','awaiting_approval','reviewed') NOT NULL DEFAULT 'awaiting_approval',
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_student_summaries_id` PRIMARY KEY(`id`)
);
