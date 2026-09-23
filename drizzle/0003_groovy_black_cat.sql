CREATE TABLE `upload_parts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`partIndex` int NOT NULL,
	`sizeBytes` int NOT NULL,
	`storageKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `upload_parts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` varchar(64) NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`contentType` varchar(128) NOT NULL,
	`totalBytes` int NOT NULL,
	`chunkSize` int NOT NULL,
	`totalParts` int NOT NULL,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`finalUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `upload_sessions_id` PRIMARY KEY(`id`)
);
