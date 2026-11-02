import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SENHA_MINIMA } from "./regras-senha";
import { conferirSenha, hashSenha } from "./senha";
import { SITE_URL } from "./site";

// Better Auth: e-mail e senha, sessão em cookie httpOnly guardada no banco. Sem cadastro público: quem cria contas é o owner
// (painel/usuarios) ou o scripts/criar-owner.mjs. Criado só no primeiro uso, para o build não exigir o segredo.

function criar() {
  return betterAuth({
    baseURL: SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: SENHA_MINIMA,
      password: { hash: hashSenha, verify: conferirSenha },
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "parceiro", input: false },
        ativo: { type: "boolean", defaultValue: true, input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 14 },
    advanced: {
      database: { generateId: "uuid" },
      // O nginx grava o IP real em X-Real-IP; X-Forwarded-For pode vir com valores colocados pelo cliente.
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    // Usuário desativado não abre sessão nova, mesmo com a senha certa.
    databaseHooks: {
      session: {
        create: {
          before: async (sessao) => {
            const u = db.select({ ativo: schema.user.ativo }).from(schema.user).where(eq(schema.user.id, sessao.userId)).get();
            if (!u?.ativo) throw new APIError("FORBIDDEN", { message: "Acesso desativado", code: "ACESSO_DESATIVADO" });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

const g = globalThis as unknown as { __bibliotheonAuth?: ReturnType<typeof criar> };
export const auth = () => (g.__bibliotheonAuth ??= criar());
