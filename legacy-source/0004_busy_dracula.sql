CREATE TABLE `content_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentType` enum('lesson','contest','assignment','access') NOT NULL,
	`contentId` int,
	`action` enum('publish','assign','activate','request_changes') NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contest_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`durationSeconds` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contest_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `diagnostic_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`track` enum('lebanese','sat') NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`recommendedTopic` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `diagnostic_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `homework_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lessonId` int,
	`prompt` text NOT NULL,
	`attachmentUrl` text,
	`attachmentName` varchar(255),
	`status` enum('submitted','reviewed','needs_revision') NOT NULL DEFAULT 'submitted',
	`feedback` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `homework_submissions_id` PRIMARY KEY(`id`)
);
