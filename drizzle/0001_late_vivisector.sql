CREATE TABLE `lead` (
	`id` text PRIMARY KEY NOT NULL,
	`ebook_id` text NOT NULL,
	`email` text NOT NULL,
	`origem` text DEFAULT 'direto' NOT NULL,
	`criadoEm` integer NOT NULL,
	FOREIGN KEY (`ebook_id`) REFERENCES `ebook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_ebook_email` ON `lead` (`ebook_id`,`email`);--> statement-breakpoint
ALTER TABLE `ebook` ADD `dores` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ebook` ADD `diferenciais` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ebook` ADD `oferta_nome` text;--> statement-breakpoint
ALTER TABLE `ebook` ADD `parcelamento` text;--> statement-breakpoint
ALTER TABLE `oferta` ADD `url_promo` text;