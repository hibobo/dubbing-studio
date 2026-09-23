CREATE TABLE `dubbing_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`sourceUrl` text,
	`durationMs` int,
	`sourceLanguage` varchar(16) DEFAULT 'en',
	`targetLanguage` varchar(16) DEFAULT 'cmn-CN',
	`status` enum('draft','transcribing','editing','processing','ready','failed') NOT NULL DEFAULT 'draft',
	`backgroundGain` int NOT NULL DEFAULT 82,
	`voiceGain` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dubbing_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dubbing_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`segmentIndex` int NOT NULL,
	`startMs` int NOT NULL,
	`endMs` int NOT NULL,
	`speaker` varchar(64) NOT NULL,
	`sourceText` text NOT NULL,
	`targetText` text NOT NULL,
	`voicePreset` varchar(64),
	`confidence` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dubbing_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`kind` enum('transcribe','translate','separate','synthesize','mix','export') NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`message` text,
	`resultUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_jobs_id` PRIMARY KEY(`id`)
);
