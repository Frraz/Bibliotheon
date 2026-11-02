import type { Metadata } from "next";
import { Prosa } from "@/components/site/prosa";
import { CONTATO_EMAIL } from "@/lib/site";

export const ensureStatic = "navigation";
export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };

export default function Privacidade() {
  return (
    <Prosa titulo="Política de privacidade" atualizado="02/11/2026">
      <p>Esta política explica quais dados o Bibliotheon trata e por quê, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</p>

      <h2>Quem é o responsável</h2>
      <p>O Bibliotheon é operado por Warley Ferraz Almeida.{CONTATO_EMAIL && <> Contato para assuntos de privacidade: <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.</>}</p>

      <h2>Dados que tratamos</h2>
      <ul>
        <li><strong>Contadores de visitas e cliques, anônimos.</strong> Contamos quantas pessoas abriram a página de um e-book e quantas clicaram em um botão de compra, por dia e por origem do acesso (por exemplo, “instagram” ou “google”). Esses contadores <strong>não usam cookie e não guardam IP</strong> nem qualquer dado que identifique você.</li>
        <li><strong>Registros do servidor.</strong> Por segurança e para manter o site no ar, o servidor registra por tempo limitado dados técnicos de cada acesso, como o endereço IP e o tipo de navegador.</li>
        <li><strong>Cookies e pixels de medição, somente se você aceitar.</strong> Podemos usar o Meta Pixel e o Google Analytics para entender o que funciona nos anúncios e melhorar a experiência. Eles só são carregados depois que você clica em “Aceitar” no aviso do site. Se você recusar, o site funciona normalmente.</li>
      </ul>

      <h2>O que não fazemos</h2>
      <p>Este site não tem cadastro, não pede seus dados pessoais e não processa pagamentos. Ao comprar, os dados de pagamento e de contato são tratados pela plataforma de vendas que você escolher, segundo a política dela.</p>

      <h2>Com quem compartilhamos</h2>
      <p>Compartilhamos dados apenas com os serviços de medição que você autorizar (Meta e Google) e com a infraestrutura que hospeda o site. Não vendemos dados.</p>

      <h2>Seus direitos</h2>
      <p>Você pode pedir confirmação de que tratamos seus dados, acesso, correção, eliminação, portabilidade, informação sobre compartilhamento e a revogação do consentimento, entre outros direitos do art. 18 da LGPD. Para revogar o consentimento de cookies, limpe os dados deste site no seu navegador: o aviso aparecerá de novo.{CONTATO_EMAIL && <> Para outros pedidos, escreva para <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.</>}{!CONTATO_EMAIL && " Este site não pede seu nome nem seu e-mail, e os contadores de visita são anônimos. Os dados da compra (nome, e-mail, pagamento) ficam com a plataforma onde você comprou: faça esses pedidos a ela."}</p>

      <h2>Alterações</h2>
      <p>Podemos atualizar esta política. A data de atualização fica no topo da página.</p>
    </Prosa>
  );
}
