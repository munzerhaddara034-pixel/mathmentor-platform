CREATE TABLE `parent_student_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`parentUserId` int,
	`inviteEmail` varchar(320) NOT NULL,
	`inviteTokenHash` varchar(128) NOT NULL,
	`status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
	`reportConsent` enum('unknown','confirmed','revoked') NOT NULL DEFAULT 'unknown',
	`consentScope` varchar(80) NOT NULL DEFAULT 'weekly_parent_reports',
	`consentedAt` timestamp,
	`acceptedAt` timestamp,
	`revokedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parent_student_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `parent_student_links_inviteTokenHash_unique` UNIQUE(`inviteTokenHash`)
);
