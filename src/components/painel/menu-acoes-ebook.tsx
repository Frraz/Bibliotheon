"use client";

import { Menu } from "@base-ui/react/menu";
import { Download, FileText, MoreHorizontal, SquareArrowOutUpRight } from "lucide-react";

type Props = { titulo: string; verHref: string; verRotulo: "Ver página" | "Ver prévia"; exportarHref: string; pdfHref?: string };

const item =
  "flex min-h-11 cursor-pointer items-center gap-3 px-3 text-[0.9375rem] text-(--tinta) outline-none select-none data-[highlighted]:bg-(--papel-2) [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-(--tinta-2)";

/** Ações de apoio de um e-book na lista: a principal (Editar) fica à vista; o resto cabe aqui. */
export function MenuAcoesEbook({ titulo, verHref, verRotulo, exportarHref, pdfHref }: Props) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Mais ações de ${titulo}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-(--tinta-2) transition-colors outline-none hover:bg-(--papel-2) hover:text-(--tinta) focus-visible:ring-3 focus-visible:ring-(--terracota)/40 data-[popup-open]:bg-(--papel-2) data-[popup-open]:text-(--tinta)"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-52 origin-(--transform-origin) rounded-sm border border-(--filete) bg-(--papel-3) py-1 shadow-[0_8px_24px_-8px_rgb(31_42_41/.25),0_1px_2px_rgb(31_42_41/.08)] transition-[opacity,transform] duration-150 ease-out data-[ending-style]:scale-98 data-[ending-style]:opacity-0 data-[starting-style]:scale-98 data-[starting-style]:opacity-0">
            <Menu.LinkItem className={item} href={verHref} target="_blank" rel="noopener">
              <SquareArrowOutUpRight aria-hidden /> {verRotulo}
            </Menu.LinkItem>
            <Menu.LinkItem className={item} href={exportarHref} download>
              <Download aria-hidden /> Exportar dados
            </Menu.LinkItem>
            {pdfHref && (
              <Menu.LinkItem className={item} href={pdfHref} download>
                <FileText aria-hidden /> Baixar PDF
              </Menu.LinkItem>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
