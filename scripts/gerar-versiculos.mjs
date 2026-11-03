/**
 * Gera public/versiculos.json (faixa de versículos do site) a partir do arquivo da Bíblia Livre e de seeds/versiculos/referencias.txt.
 *
 *   node scripts/gerar-versiculos.mjs <porbr2018_vpl.txt>
 *
 * Fonte: https://ebible.org/Scriptures/porbr2018_vpl.zip (Bíblia Livre, fev/2018, CC BY 4.0 Brasil). O arquivo não fica no repositório.
 * Nenhum texto é digitado à mão. Únicas mudanças (informadas no crédito): colchetes do tradutor, títulos de salmo, "Selá", letra hebraica
 * do Salmo 119, espaços soltos antes da pontuação e ponto final quando a frase continuava no versículo seguinte.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LIMITE = 155; // maior versículo aceito; no celular a faixa pula os mais longos (src/lib/versiculos.ts)

const LIVROS = {
  GEN: "Gênesis", EXO: "Êxodo", LEV: "Levítico", NUM: "Números", DEU: "Deuteronômio", JOS: "Josué", JDG: "Juízes", RUT: "Rute", "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Reis", "2KI": "2 Reis",
  "1CH": "1 Crônicas", "2CH": "2 Crônicas", EZR: "Esdras", NEH: "Neemias", EST: "Ester", JOB: "Jó", PSA: "Salmos", PRO: "Provérbios", ECC: "Eclesiastes", SOL: "Cânticos", ISA: "Isaías", JER: "Jeremias",
  LAM: "Lamentações", EZE: "Ezequiel", DAN: "Daniel", HOS: "Oseias", JOE: "Joel", AMO: "Amós", OBA: "Obadias", JON: "Jonas", MIC: "Miqueias", NAH: "Naum", HAB: "Habacuque", ZEP: "Sofonias", HAG: "Ageu",
  ZEC: "Zacarias", MAL: "Malaquias", MAT: "Mateus", MAR: "Marcos", LUK: "Lucas", JOH: "João", ACT: "Atos", ROM: "Romanos", "1CO": "1 Coríntios", "2CO": "2 Coríntios", GAL: "Gálatas", EPH: "Efésios",
  PHI: "Filipenses", COL: "Colossenses", "1TH": "1 Tessalonicenses", "2TH": "2 Tessalonicenses", "1TI": "1 Timóteo", "2TI": "2 Timóteo", TIT: "Tito", PHM: "Filemom", HEB: "Hebreus", JAM: "Tiago",
  "1PE": "1 Pedro", "2PE": "2 Pedro", "1JO": "1 João", "2JO": "2 João", "3JO": "3 João", JUD: "Judas", REV: "Apocalipse",
};

const limpar = (livro, cap, v, t) => {
  let s = t.replace(/[[\]]/g, "").replace(/\s*\(Selá\)\s*/g, " ");
  if (livro === "PSA" && v === 1) s = s.replace(/^[^:]{0,90}:\s*/, ""); // título do salmo ("Salmo de Davi:")
  if (livro === "PSA" && cap === 119) s = s.replace(/^[\p{L}]+\s*:\s*/u, ""); // letra hebraica da estrofe ("Nun :")
  return s
    .replace(/\s+([,.;:!?)])/g, "$1") // espaço solto antes da pontuação, comum neste arquivo
    .replace(/([,;!?])(?=[\p{L}])/gu, "$1 ")
    .replace(/\s*-\s+(la|lo|nos|me)\b/g, "-$1")
    .replace(/\s+-(la|lo|nos|me)\b/g, "-$1")
    .replace(/^“([^”]*)$/, "$1") // aspa aberta ou fechada em outro versículo
    .replace(/^([^“]*)”$/, "$1")
    .replace(/[,;:]$/, ".") // o versículo continua no seguinte: encerra a frase
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
};

const fonte = process.argv[2];
if (!fonte) { console.error("Uso: node scripts/gerar-versiculos.mjs <porbr2018_vpl.txt>"); process.exit(1); }

const texto = new Map();
for (const l of readFileSync(fonte, "utf8").split(/\r?\n/)) {
  const m = l.match(/^(\S{3}) (\d+):(\d+) (.+)$/);
  if (m) texto.set(`${m[1]} ${m[2]}:${m[3]}`, { livro: m[1], cap: +m[2], v: +m[3], t: m[4] });
}
if (texto.size < 31000) { console.error(`Fonte inesperada: só ${texto.size} versículos.`); process.exit(1); }

const refs = readFileSync("seeds/versiculos/referencias.txt", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .flatMap((l) => { const [livro, ...p] = l.split(/\s+/); return p.map((x) => `${livro} ${x}`); });

const problemas = [];
const vistos = new Set();
const saida = [];
for (const ref of refs) {
  const x = texto.get(ref);
  if (!x) { problemas.push(`${ref}: não existe na fonte`); continue; }
  if (vistos.has(ref)) { problemas.push(`${ref}: repetido na lista`); continue; }
  vistos.add(ref);
  const s = limpar(x.livro, x.cap, x.v, x.t);
  if (s.length > LIMITE) { problemas.push(`${ref}: ${s.length} caracteres`); continue; }
  if (saida.some((o) => o.t === s)) { problemas.push(`${ref}: texto igual a outro`); continue; }
  saida.push({ t: s, r: `${LIVROS[x.livro]} ${x.cap}:${x.v}`, ref });
}
if (process.argv.includes("--revisao")) {
  for (const x of saida) console.log(`${x.ref}\t${x.t}`);
} else {
  writeFileSync("public/versiculos.json", `[\n${saida.map(({ t, r }) => JSON.stringify({ t, r })).join(",\n")}\n]\n`);
}
console.error(`${saida.length} versículos; maior: ${Math.max(...saida.map((x) => x.t.length))} caracteres.`);
if (problemas.length) console.error(`Fora:\n  ${problemas.join("\n  ")}`);
