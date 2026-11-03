import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";

// E-mail só para o que o painel precisa (hoje: recuperar senha). Qualquer SMTP serve; com Gmail, use uma "senha de app".
// Tudo opcional: sem SMTP_HOST o site e o painel funcionam, e a tela de recuperação manda falar com o administrador.
// EMAIL_SAIDA_DIR grava cada e-mail em JSON no lugar de enviar (testes e desenvolvimento).

export type Mensagem = { para: string; assunto: string; texto: string; html: string };

const env = (nome: string) => process.env[nome]?.trim() || undefined;

export const emailConfigurado = () => Boolean(env("SMTP_HOST") || env("EMAIL_SAIDA_DIR"));

function remetente() {
  const usuario = env("SMTP_USUARIO");
  return env("EMAIL_REMETENTE") ?? (usuario ? `Bibliotheon <${usuario}>` : "Bibliotheon <nao-responda@localhost>");
}

export async function enviarEmail(m: Mensagem): Promise<void> {
  const de = remetente();
  const saida = env("EMAIL_SAIDA_DIR");
  if (saida) {
    await mkdir(saida, { recursive: true });
    await writeFile(join(/*turbopackIgnore: true*/ saida, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify({ de, ...m }, null, 2));
    return;
  }
  const host = env("SMTP_HOST");
  if (!host) throw new Error("E-mail não configurado: defina SMTP_HOST, SMTP_USUARIO e SMTP_SENHA no .env.");
  const porta = Number(env("SMTP_PORTA") ?? 587);
  const usuario = env("SMTP_USUARIO");
  const transporte = nodemailer.createTransport({
    host,
    port: porta,
    secure: porta === 465, // 465 é TLS direto; 587 começa aberto e sobe para TLS (STARTTLS)
    auth: usuario ? { user: usuario, pass: env("SMTP_SENHA") ?? "" } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transporte.sendMail({ from: de, to: m.para, subject: m.assunto, text: m.texto, html: m.html });
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto e HTML do e-mail de redefinição. O link vale por 1 hora e só uma vez. */
export function emailDeRedefinicao(nome: string, link: string): Pick<Mensagem, "assunto" | "texto" | "html"> {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  const ola = primeiro ? `Olá, ${primeiro}.` : "Olá.";
  const texto = [
    ola,
    "",
    "Recebemos um pedido para criar uma senha nova no painel da Bibliotheon. Para continuar, abra o link abaixo (vale por 1 hora e funciona uma vez só):",
    "",
    link,
    "",
    "Se não foi você, ignore esta mensagem: sua senha continua a mesma.",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1f1b16;max-width:480px">
<p>${escapar(ola)}</p>
<p>Recebemos um pedido para criar uma senha nova no painel da Bibliotheon.</p>
<p><a href="${escapar(link)}" style="display:inline-block;background:#1f1b16;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Criar senha nova</a></p>
<p style="font-size:14px;color:#5b544a">O link vale por 1 hora e funciona uma vez só. Se o botão não abrir, copie este endereço no navegador:<br>${escapar(link)}</p>
<p style="font-size:14px;color:#5b544a">Se não foi você, ignore esta mensagem: sua senha continua a mesma.</p>
</div>`;
  return { assunto: "Criar uma senha nova na Bibliotheon", texto, html };
}
