CREATE TABLE `amostra` (
	`id` text PRIMARY KEY NOT NULL,
	`ebook_id` text NOT NULL,
	`imagem` text NOT NULL,
	`alt` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`ebook_id`) REFERENCES `ebook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `amostra_ebook` ON `amostra` (`ebook_id`);--> statement-breakpoint
CREATE TABLE `ebook` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`tema_id` text,
	`source_id` text,
	`idioma` text DEFAULT 'pt-BR' NOT NULL,
	`edicao` text,
	`slug` text NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`destaque` integer DEFAULT false NOT NULL,
	`publicado_em` integer,
	`criadoEm` integer NOT NULL,
	`atualizadoEm` integer NOT NULL,
	`titulo` text NOT NULL,
	`subtitulo` text,
	`autor_exibido` text,
	`formatos` text DEFAULT '[]' NOT NULL,
	`capa` text,
	`capa_hash` text,
	`capa_alt` text,
	`accent` text,
	`headline` text,
	`resumo` text,
	`problema` text,
	`descricao` text,
	`beneficios` text DEFAULT '[]' NOT NULL,
	`para_quem` text DEFAULT '[]' NOT NULL,
	`nao_e_para` text DEFAULT '[]' NOT NULL,
	`incluido` text DEFAULT '[]' NOT NULL,
	`observacoes` text,
	`sobre_autor` text,
	`autor_foto` text,
	`figura` text,
	`figura_alt` text,
	`figura_legenda` text,
	`sumario` text DEFAULT '[]' NOT NULL,
	`faq` text DEFAULT '[]' NOT NULL,
	`amostra_pdf` text,
	`preco` integer,
	`preco_de` integer,
	`oferta_ate` integer,
	`garantia_dias` integer DEFAULT 7 NOT NULL,
	`em_breve` integer DEFAULT false NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`meta_pixel_id` text,
	FOREIGN KEY (`tema_id`) REFERENCES `tema`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ebook_slug_unique` ON `ebook` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `ebook_source_idioma` ON `ebook` (`source_id`,`idioma`);--> statement-breakpoint
CREATE INDEX `ebook_status` ON `ebook` (`status`);--> statement-breakpoint
CREATE INDEX `ebook_tema` ON `ebook` (`tema_id`);--> statement-breakpoint
CREATE TABLE `metrica_diaria` (
	`ebook_id` text NOT NULL,
	`data` text NOT NULL,
	`oferta_id` text DEFAULT '' NOT NULL,
	`origem` text DEFAULT 'direto' NOT NULL,
	`contagem` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`ebook_id`, `data`, `oferta_id`, `origem`),
	FOREIGN KEY (`ebook_id`) REFERENCES `ebook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oferta` (
	`id` text PRIMARY KEY NOT NULL,
	`ebook_id` text NOT NULL,
	`plataforma` text NOT NULL,
	`rotulo` text,
	`url` text NOT NULL,
	`preco` integer,
	`principal` integer DEFAULT false NOT NULL,
	`ativa` integer DEFAULT true NOT NULL,
	`ordem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`ebook_id`) REFERENCES `ebook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oferta_ebook` ON `oferta` (`ebook_id`);--> statement-breakpoint
CREATE TABLE `tema` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`slug` text NOT NULL,
	`descricao` text,
	`cor` text,
	`ordem` integer DEFAULT 0 NOT NULL,
	`publicado` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tema_slug_unique` ON `tema` (`slug`);