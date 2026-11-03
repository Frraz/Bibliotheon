"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PLATAFORMAS } from "@/db/schema";
import { NOME_PLATAFORMA } from "@/lib/ofertas";

export type LojaInicial = { id: string | null; plataforma: (typeof PLATAFORMAS)[number]; url: string; urlPromo: string; ativa: boolean };
export type PrecoInicial = { precoNormal: string; garantiaDias: string; parcelamento: string; campanha: boolean; campanhaNome: string; campanhaPreco: string; campanhaFim: string };

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
const rotuloCls = "mb-1.5 text-[0.9375rem] font-medium";
const dicaCls = "mt-1.5 text-sm text-(--tinta-2) text-pretty";

/** Preço, campanha e lojas. O link de campanha só aparece (e só vale) com uma campanha ligada. As lojas vão ao formulário como JSON (`lojas`). */
export function PrecoELojas({ preco, lojas }: { preco: PrecoInicial; lojas: LojaInicial[] }) {
  const prox = useRef(lojas.length);
  const [campanha, setCampanha] = useState(preco.campanha);
  const [lista, setLista] = useState(() => lojas.map((l, k) => ({ ...l, chave: k })));
  const mudar = (chave: number, parte: Partial<LojaInicial>) => setLista((a) => a.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));

  return (
    <>
      <input type="hidden" name="campanhaAtiva" value={campanha ? "1" : "0"} />
      <input type="hidden" name="lojas" value={JSON.stringify(lista.map(({ id, plataforma, url, urlPromo, ativa }) => ({ id, plataforma, url, urlPromo: campanha ? urlPromo : urlPromo || null, ativa })))} />

      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
        <div>
          <Label htmlFor="precoNormal" className={rotuloCls}>Preço (R$)</Label>
          <Input id="precoNormal" name="precoNormal" inputMode="decimal" defaultValue={preco.precoNormal} placeholder="64,99" />
          <p className={dicaCls}>Deixe em branco para a página mostrar “Em breve”.</p>
        </div>
        <div>
          <Label htmlFor="garantiaDias" className={rotuloCls}>Garantia (dias)</Label>
          <Input id="garantiaDias" name="garantiaDias" inputMode="numeric" defaultValue={preco.garantiaDias} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="parcelamento" className={rotuloCls}>Parcelamento (opcional)</Label>
          <Input id="parcelamento" name="parcelamento" defaultValue={preco.parcelamento} placeholder="ou em até 12x no cartão" />
          <p className={dicaCls}>Escreva só o que o checkout realmente oferece.</p>
        </div>
      </div>

      <div className="border border-(--filete) bg-(--papel-3) p-4 sm:p-5">
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="block text-[0.9375rem] font-medium">Campanha com prazo</span>
            <span className="block text-sm text-(--tinta-2) text-pretty">Só com prazo real. No fim, a página e o checkout voltam ao preço normal sozinhos.</span>
          </span>
          <Switch checked={campanha} onCheckedChange={setCampanha} aria-label="Campanha com prazo" />
        </label>
        {campanha && (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="campanhaNome" className={rotuloCls}>Nome</Label>
              <Input id="campanhaNome" name="campanhaNome" defaultValue={preco.campanhaNome} placeholder="Black Friday" />
            </div>
            <div>
              <Label htmlFor="campanhaPreco" className={rotuloCls}>Preço na campanha (R$)</Label>
              <Input id="campanhaPreco" name="campanhaPreco" inputMode="decimal" defaultValue={preco.campanhaPreco} placeholder="47,00" />
            </div>
            <div>
              <Label htmlFor="campanhaFim" className={rotuloCls}>Termina em (horário de Brasília)</Label>
              <Input id="campanhaFim" name="campanhaFim" type="datetime-local" defaultValue={preco.campanhaFim} />
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-[0.9375rem] font-medium">Onde comprar</p>
        <p className="mt-1 mb-3 text-sm text-(--tinta-2) text-pretty">
          Todas as lojas ativas aparecem na página, e a pessoa escolhe. A primeira da lista é a do botão principal. Pode deixar para depois: sem nenhuma loja, a página mostra “Em breve”.
        </p>
        {lista.length > 0 && (
          <ul className="space-y-3">
            {lista.map((l, n) => (
              <li key={l.chave} className="grid grid-cols-1 gap-3 border border-(--filete) bg-(--papel-3) p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <select aria-label={`Loja ${n + 1}`} className={selectCls} value={l.plataforma} onChange={(e) => mudar(l.chave, { plataforma: e.target.value as LojaInicial["plataforma"] })}>
                  {PLATAFORMAS.map((p) => <option key={p} value={p}>{NOME_PLATAFORMA[p]}</option>)}
                </select>
                <Input aria-label={`Link de compra ${n + 1}`} inputMode="url" placeholder="https://" value={l.url} onChange={(e) => mudar(l.chave, { url: e.target.value })} />
                {campanha && (
                  <div className="sm:col-span-2">
                    <Label htmlFor={`promo-${l.chave}`} className={rotuloCls}>Link com o preço da campanha</Label>
                    <Input id={`promo-${l.chave}`} inputMode="url" placeholder="https://" value={l.urlPromo} onChange={(e) => mudar(l.chave, { urlPromo: e.target.value })} />
                    <p className={dicaCls}>Obrigatório em toda loja ativa: sem ele a página mostraria um preço e o checkout cobraria outro.</p>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:col-span-2">
                  <label className="mr-auto flex min-h-11 items-center gap-2 text-sm"><Switch checked={l.ativa} onCheckedChange={(v) => mudar(l.chave, { ativa: v })} aria-label={`Loja ${n + 1} ativa`} /> Ativa</label>
                  <Button type="button" variant="ghost" disabled={!l.url.startsWith("https://")} onClick={() => window.open(l.url, "_blank", "noopener")}><ExternalLink /> Testar link</Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover loja ${n + 1}`} onClick={() => setLista((a) => a.filter((x) => x.chave !== l.chave))}><X /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="ghost" size="sm" className="mt-2 min-h-11 text-(--terracota) hover:text-(--terracota-escura)" onClick={() => setLista((a) => [...a, { chave: prox.current++, id: null, plataforma: "hotmart", url: "", urlPromo: "", ativa: true }])}>
          <Plus /> Adicionar loja
        </Button>
      </div>
    </>
  );
}
