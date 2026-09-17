CREATE TABLE `manager_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`direction` enum('manager','professor') NOT NULL,
	`subject` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`relatedProposalId` int,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manager_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalType` enum('pricing','campaign','operations') NOT NULL,
	`audience` enum('grade9','grade12','sat','all') NOT NULL,
	`title` varchar(180) NOT NULL,
	`summary` text NOT NULL,
	`suggestedAmount` int,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`suggestedBudget` int,
	`campaignChannel` varchar(40),
	`campaignCopy` text,
	`status` enum('draft','awaiting_approval','approved','rejected') NOT NULL DEFAULT 'awaiting_approval',
	`decisionNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_proposals_id` PRIMARY KEY(`id`)
);
