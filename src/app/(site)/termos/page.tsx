import type { Metadata } from "next";
import { Prosa } from "@/components/site/prosa";
import { CONTATO_EMAIL } from "@/lib/site";

export const ensureStatic = "navigation";
export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Termos de uso do Bibliotheon: o que o site é, como funcionam compras, entrega e reembolso nas plataformas, o conteúdo dos e-books e a propriedade intelectual.",
  alternates: { canonical: "/termos" },
};

export default function Termos() {
  return (
    <Prosa titulo="Termos de uso" atualizado="02/11/2026">
      <p>O Bibliotheon é uma vitrine de e-books. Ao usar este site, você concorda com os termos abaixo.</p>

      <h2>O que é o Bibliotheon</h2>
      <p>Aqui você conhece cada e-book, folheia páginas de amostra e escolhe em qual plataforma de vendas prefere comprar. O Bibliotheon <strong>não vende, não cobra e não entrega os e-books</strong>: a compra acontece na plataforma que você escolher (por exemplo Hotmart, Kiwify ou Cakto).</p>

      <h2>Compras, entrega e reembolso</h2>
      <ul>
        <li>O pagamento, a entrega do arquivo, o suporte da compra e o reembolso são de responsabilidade da plataforma em que você comprar, e seguem os termos dela.</li>
        <li>Nas compras feitas pela internet vale o direito de arrependimento de 7 dias previsto no art. 49 do Código de Defesa do Consumidor, além das regras de reembolso da própria plataforma.</li>
        <li>Os preços e prazos de promoção mostrados aqui podem mudar. Vale o preço exibido na página de pagamento da plataforma no momento da compra.</li>
      </ul>

      <h2>Sobre o conteúdo dos e-books</h2>
      <p>Os e-books têm caráter informativo e educacional. Não garantimos renda, clientes, resultados de saúde, aprovação ou qualquer outro resultado específico: ele depende de você, do contexto e da aplicação do conteúdo. O conteúdo não substitui orientação profissional individual (médica, jurídica, financeira ou outra).</p>

      <h2>Propriedade intelectual</h2>
      <p>Os textos, imagens, capas e demais materiais deste site e dos e-books pertencem aos seus autores e não podem ser copiados, revendidos ou redistribuídos sem autorização. As páginas de amostra são oferecidas apenas para você avaliar o livro.</p>

      <h2>Links para outros sites</h2>
      <p>Os botões de compra levam a sites de terceiros (as plataformas de venda). Não controlamos esses sites e não respondemos pelo conteúdo ou pelas práticas deles.</p>

      <h2>Alterações</h2>
      <p>Podemos atualizar estes termos. A data de atualização fica no topo desta página.</p>

      {CONTATO_EMAIL && (
        <>
          <h2>Contato</h2>
          <p>Dúvidas sobre este site: <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>. Para dúvidas sobre uma compra, fale com o suporte da plataforma onde você comprou.</p>
        </>
      )}
    </Prosa>
  );
}
