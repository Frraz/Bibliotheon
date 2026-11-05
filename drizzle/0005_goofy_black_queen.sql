CREATE TABLE `venda` (
	`id` text PRIMARY KEY NOT NULL,
	`ebook_id` text NOT NULL,
	`plataforma` text NOT NULL,
	`transacao` text NOT NULL,
	`status` text DEFAULT 'aprovada' NOT NULL,
	`valor` integer NOT NULL,
	`valor_informado` integer DEFAULT true NOT NULL,
	`afiliado` integer DEFAULT false NOT NULL,
	`origem` text DEFAULT 'direto' NOT NULL,
	`criadoEm` integer NOT NULL,
	`atualizadoEm` integer NOT NULL,
	FOREIGN KEY (`ebook_id`) REFERENCES `ebook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venda_plataforma_transacao` ON `venda` (`plataforma`,`transacao`);--> statement-breakpoint
CREATE INDEX `venda_ebook` ON `venda` (`ebook_id`,`criadoEm`);