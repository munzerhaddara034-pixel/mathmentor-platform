CREATE TABLE `weekly_parent_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`weekEnd` varchar(10) NOT NULL,
	`snapshot` text NOT NULL,
	`englishSummary` text NOT NULL,
	`arabicSummary` text NOT NULL,
	`recipientLabel` varchar(180),
	`deliveryChannel` enum('in_app','whatsapp','email') NOT NULL DEFAULT 'in_app',
	`consentStatus` enum('unknown','confirmed','revoked') NOT NULL DEFAULT 'unknown',
	`status` enum('draft','awaiting_approval','approved','sent','rejected') NOT NULL DEFAULT 'awaiting_approval',
	`professorNote` text,
	`reviewedAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weekly_parent_reports_id` PRIMARY KEY(`id`)
);
