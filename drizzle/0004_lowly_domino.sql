CREATE TABLE `export_jobs` (
	`id` varchar(64) NOT NULL,
	`projectId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`status` enum('queued','running','completed','cancelled','failed') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`resultUrl` text,
	`message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `export_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dubbing_segments` ADD `voiceGain` int DEFAULT 100 NOT NULL;