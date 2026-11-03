import { Consentimento } from "@/components/site/rastreio";
import { CabecalhoSite, RodapeSite } from "@/components/site/moldura";

// O cabeçalho e o rodapé do layout somem (CSS, globals.css) enquanto uma landing com moldura própria está na tela.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-moldura className="bg-(--papel) font-(family-name:--font-texto) text-(--tinta)">
      <CabecalhoSite />
      <main className="border-t border-(--filete)">{children}</main>
      <RodapeSite />
      <Consentimento />
    </div>
  );
}
