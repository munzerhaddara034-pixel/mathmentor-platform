CREATE TABLE `solution_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`skill` varchar(120) NOT NULL,
	`questionRef` varchar(160) NOT NULL,
	`videoScript` text NOT NULL,
	`videoUrl` text,
	`printableSolution` text NOT NULL,
	`language` enum('en','ar') NOT NULL DEFAULT 'en',
	`status` enum('draft','awaiting_approval','approved','rejected','changes_requested') NOT NULL DEFAULT 'awaiting_approval',
	`professorNote` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `solution_assets_id` PRIMARY KEY(`id`)
);
