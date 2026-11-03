// Em arquivo próprio: o formulário de Conta (cliente) usa este valor, e src/lib/senha.ts depende de node:crypto.
export const SENHA_MINIMA = 4; // decisão do titular (03/11/2026): qualquer senha a partir de 4 caracteres; a proteção a mais é a verificação em duas etapas, opcional
