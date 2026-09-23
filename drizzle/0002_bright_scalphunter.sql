CREATE TABLE `project_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`snapshotJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dubbing_projects` ADD `waveformJson` text;