CREATE TABLE `listening_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`listened_for_seconds` integer DEFAULT 1 NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_listening_events_track_id` ON `listening_events` (`track_id`);--> statement-breakpoint
CREATE INDEX `idx_listening_events_started_at` ON `listening_events` (`started_at`);--> statement-breakpoint
CREATE INDEX `idx_listening_events_track_started` ON `listening_events` (`track_id`,"started_at" DESC);--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL,
	`track_id` integer NOT NULL,
	`added_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_playlist_tracks_playlist_id` ON `playlist_tracks` (`playlist_id`);--> statement-breakpoint
CREATE INDEX `idx_playlist_tracks_track_id` ON `playlist_tracks` (`track_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_tracks_playlist_id_track_id_unique` ON `playlist_tracks` (`playlist_id`,`track_id`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`last_played` text
);
--> statement-breakpoint
CREATE INDEX `idx_playlists_name` ON `playlists` (`name`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`title` text,
	`artist` text,
	`album` text,
	`genre` text,
	`duration` integer,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP,
	`thumbnail_path` text,
	`seconds_listened` integer DEFAULT 0 NOT NULL,
	`last_played` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_storage_key_unique` ON `tracks` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_tracks_filename` ON `tracks` (`filename`);--> statement-breakpoint
CREATE INDEX `idx_tracks_artist` ON `tracks` (`artist`);--> statement-breakpoint
CREATE INDEX `idx_tracks_album` ON `tracks` (`album`);