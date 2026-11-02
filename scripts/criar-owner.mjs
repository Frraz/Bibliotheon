// Cria (ou recupera) a conta de administrador e entrega a ela os e-books que ainda não têm dono.
// JS puro, sem tsx: roda dentro da imagem Docker.
//   docker exec -it bibliotheon_web node scripts/criar-owner.mjs voce@exemplo.com "Seu Nome"
// Se o e-mail já existir, vira administrador, fica ativo e recebe uma senha nova: serve também para recuperar o acesso.
// O hash repete src/lib/senha.ts (senha.test.ts garante que os dois conferem).
import Database from "better-sqlite3";
import { randomBytes, randomInt, scrypt } from "node:crypto";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const derivar = promisify(scrypt);
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function hashSenha(senha) {
  const sal = randomBytes(16);
  const hash = await derivar(senha.normalize("NFKC"), sal, 64);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

export const senhaTemporaria = () => Array.from({ length: 14 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

async function principal() {
  const [emailBruto, ...resto] = process.argv.slice(2);
  const email = emailBruto?.trim().toLowerCase();
  const nome = resto.join(" ").trim() || "Administrador";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Uso: node scripts/criar-owner.mjs <e-mail> ["Nome"]');
    process.exit(2);
  }

  const banco = new Database(process.env.DATABASE_PATH ?? "data/bibliotheon.db", { fileMustExist: true });
  banco.pragma("foreign_keys = ON");
  banco.pragma("busy_timeout = 5000");
  if (!banco.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user'").get()) {
    console.error("O banco ainda não tem a tabela de usuários. Inicie o site uma vez (as migrações rodam na partida) e tente de novo.");
    process.exit(1);
  }

  const senha = senhaTemporaria();
  const hash = await hashSenha(senha);
  const agora = Date.now();
  const existente = banco.prepare("SELECT id FROM user WHERE email = ?").get(email);
  const id = existente?.id ?? crypto.randomUUID();

  const atribuidos = banco.transaction(() => {
    if (existente) {
      banco.prepare("UPDATE user SET role = 'owner', ativo = 1, updatedAt = ? WHERE id = ?").run(agora, id);
      banco.prepare("DELETE FROM session WHERE user_id = ?").run(id);
      const conta = banco.prepare("UPDATE account SET password = ?, updatedAt = ? WHERE user_id = ? AND provider_id = 'credential'").run(hash, agora, id);
      if (conta.changes === 0) {
        banco.prepare("INSERT INTO account (id, user_id, account_id, provider_id, password, createdAt, updatedAt) VALUES (?, ?, ?, 'credential', ?, ?, ?)").run(crypto.randomUUID(), id, id, hash, agora, agora);
      }
    } else {
      banco.prepare("INSERT INTO user (id, name, email, email_verified, role, ativo, createdAt, updatedAt) VALUES (?, ?, ?, 0, 'owner', 1, ?, ?)").run(id, nome, email, agora, agora);
      banco.prepare("INSERT INTO account (id, user_id, account_id, provider_id, password, createdAt, updatedAt) VALUES (?, ?, ?, 'credential', ?, ?, ?)").run(crypto.randomUUID(), id, id, hash, agora, agora);
    }
    return banco.prepare("UPDATE ebook SET owner_id = ? WHERE owner_id IS NULL").run(id).changes;
  })();

  console.log(`${existente ? "Administrador atualizado" : "Administrador criado"}: ${email}`);
  console.log(`Senha temporária (aparece só agora): ${senha}`);
  console.log(`E-books sem dono entregues a esta conta: ${atribuidos}`);
  console.log("Entre em /entrar e troque a senha em Conta.");
  banco.close();
}

// Só executa quando chamado como script (o teste importa as funções).
if (import.meta.url === pathToFileURL(process.argv[1]).href) await principal();
