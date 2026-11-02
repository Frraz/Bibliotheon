"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type LojaInicial = { plataforma: string; url: string; urlPromo?: string; ativa: boolean };

const PLATAFORMAS = ["Hotmart", "Kiwify", "Cakto", "Eduzz", "Monetizze", "Ticto", "Perfect Pay", "Amazon", "Google Play", "Outra"];

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
const rotuloCls = "mb-1.5 text-[0.9375rem] font-medium";
const dicaCls = "mt-1.5 text-sm text-(--tinta-2) text-pretty";

/** Preço, campanha e lojas: o link de campanha só faz sentido (e só aparece) com uma campanha ligada. */
export function PrecoELojas({ lojas, campanhaInicial = false }: { lojas: LojaInicial[]; campanhaInicial?: boolean }) {
  const prox = useRef(lojas.length);
  const [campanha, setCampanha] = useState(campanhaInicial);
  const [lista, setLista] = useState(() => lojas.map((l, id) => ({ ...l, id })));

  return (
    <>
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
        <div>
          <Label htmlFor="preco-in" className={rotuloCls}>Preço (R$)</Label>
          <Input id="preco-in" inputMode="decimal" defaultValue="64,99" />
        </div>
        <div>
          <Label htmlFor="garantia" className={rotuloCls}>Garantia (dias)</Label>
          <Input id="garantia" inputMode="numeric" defaultValue="7" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="parcelamento" className={rotuloCls}>Parcelamento (opcional)</Label>
          <Input id="parcelamento" placeholder="ou em até 12x no cartão" />
          <p className={dicaCls}>Escreva só o que o checkout realmente oferece.</p>
        </div>
      </div>

      <div className="border border-(--filete) bg-(--papel-3) p-4 sm:p-5">
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="block text-[0.9375rem] font-medium">Campanha com prazo</span>
            <span className="block text-sm text-(--tinta-2) text-pretty">Só com prazo real. No fim, a página e o checkout voltam ao preço normal sozinhos.</span>
          </span>
          <Switch checked={campanha} onCheckedChange={setCampanha} />
        </label>
        {campanha && (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="c-nome" className={rotuloCls}>Nome</Label>
              <Input id="c-nome" defaultValue="Black Friday" />
            </div>
            <div>
              <Label htmlFor="c-preco" className={rotuloCls}>Preço na campanha (R$)</Label>
              <Input id="c-preco" inputMode="decimal" defaultValue="47,00" />
            </div>
            <div>
              <Label htmlFor="c-fim" className={rotuloCls}>Termina em</Label>
              <Input id="c-fim" type="datetime-local" defaultValue="2026-11-30T23:59" />
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-[0.9375rem] font-medium">Onde comprar</p>
        <p className="mt-1 mb-3 text-sm text-(--tinta-2) text-pretty">
          Todas as lojas ativas aparecem na página, e a pessoa escolhe. Pode deixar para depois: sem nenhum link, a página mostra “Em breve”.
        </p>
        {lista.length > 0 && (
          <ul className="space-y-3">
            {lista.map((l, n) => (
              <li key={l.id} className="grid grid-cols-1 gap-3 border border-(--filete) bg-(--papel-3) p-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
                <select aria-label={`Loja ${n + 1}`} className={selectCls} defaultValue={l.plataforma}>
                  {PLATAFORMAS.map((p) => <option key={p}>{p}</option>)}
                </select>
                <Input aria-label={`Link de compra ${n + 1}`} inputMode="url" placeholder="https://" defaultValue={l.url} />
                {campanha && (
                  <div className="sm:col-span-2">
                    <Label htmlFor={`promo-${l.id}`} className={rotuloCls}>Link com o preço da campanha</Label>
                    <Input id={`promo-${l.id}`} inputMode="url" placeholder="https://" defaultValue={l.urlPromo} />
                    <p className={dicaCls}>Sem este link a campanha não salva: a página mostraria um preço e o checkout cobraria outro.</p>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:col-span-2">
                  <label className="mr-auto flex min-h-11 items-center gap-2 text-sm"><Switch defaultChecked={l.ativa} aria-label={`Loja ${n + 1} ativa`} /> Ativa</label>
                  <Button type="button" variant="ghost" onClick={() => l.url && window.open(l.url, "_blank", "noopener")}><ExternalLink /> Testar link</Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover loja ${n + 1}`} onClick={() => setLista((a) => a.filter((x) => x.id !== l.id))}><X /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="ghost" size="sm" className="mt-2 text-(--terracota) hover:text-(--terracota-escura)" onClick={() => setLista((a) => [...a, { id: prox.current++, plataforma: "Cakto", url: "", ativa: true }])}>
          <Plus /> Adicionar loja
        </Button>
      </div>
    </>
  );
}
