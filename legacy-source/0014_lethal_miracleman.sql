CREATE TABLE `school_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolName` varchar(180) NOT NULL,
	`market` varchar(40) NOT NULL,
	`country` varchar(80) NOT NULL,
	`contactName` varchar(180),
	`contactEmail` varchar(320),
	`contactChannel` varchar(40),
	`notes` text,
	`status` enum('new','qualified','contacted','pilot_discussion','won','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_outreach_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`language` enum('en','ar') NOT NULL DEFAULT 'en',
	`subject` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`channel` varchar(40) NOT NULL DEFAULT 'email',
	`status` enum('draft','awaiting_approval','approved','sent','rejected') NOT NULL DEFAULT 'awaiting_approval',
	`professorNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `school_outreach_drafts_id` PRIMARY KEY(`id`)
);
