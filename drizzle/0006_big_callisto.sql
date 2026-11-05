PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_venda` (
	`id` text PRIMARY KEY NOT NULL,
	`ebook_id` text,
	`plataforma` text NOT NULL,
	`produto_externo` text,
	`produto_nome` text,
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
INSERT INTO `__new_venda`("id", "ebook_id", "plataforma", "transacao", "status", "valor", "valor_informado", "afiliado", "origem", "criadoEm", "atualizadoEm") SELECT "id", "ebook_id", "plataforma", "transacao", "status", "valor", "valor_informado", "afiliado", "origem", "criadoEm", "atualizadoEm" FROM `venda`;--> statement-breakpoint
DROP TABLE `venda`;--> statement-breakpoint
ALTER TABLE `__new_venda` RENAME TO `venda`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `venda_plataforma_transacao` ON `venda` (`plataforma`,`transacao`);--> statement-breakpoint
CREATE INDEX `venda_ebook` ON `venda` (`ebook_id`,`criadoEm`);--> statement-breakpoint
ALTER TABLE `oferta` ADD `produto_externo` text;