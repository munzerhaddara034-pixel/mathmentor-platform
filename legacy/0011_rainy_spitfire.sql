CREATE TABLE `interactive_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionDate` varchar(10) NOT NULL,
	`sessionTitle` varchar(180) NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL,
	`joinDurationSeconds` int NOT NULL DEFAULT 0,
	`engagementEvents` int NOT NULL DEFAULT 0,
	`submittedWorkCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactive_attendance_id` PRIMARY KEY(`id`)
);
