CREATE TABLE `tournament_records` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`champion_name` text NOT NULL,
	`players` text NOT NULL,
	`matches` text NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
