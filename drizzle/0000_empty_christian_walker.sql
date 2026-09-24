CREATE TABLE `bracket_states` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
