import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";

export const alt = "Bibliotheon · E-books práticos para resolver problemas reais";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagem de compartilhamento da Home (e de Termos, Privacidade e temas, que não têm a sua): a marca na identidade do site.
// Não lê o banco: assim ela é gerada uma vez, no build, e nunca depende de capa nem de preço. As landings dos e-books têm a sua.
export default async function OgImage() {
  const fonte = await readFile(new URL("../../assets/fonts/fraunces-500.woff", import.meta.url)); // runtime Node: readFile, não fetch
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#F3ECDD", color: "#1F2A29", fontFamily: "Fraunces", padding: "0 96px", borderLeft: "20px solid #A9422A" }}>
        <div style={{ fontSize: 112, lineHeight: 1, letterSpacing: -2 }}>Bibliotheon</div>
        <div style={{ fontSize: 44, lineHeight: 1.2, marginTop: 36, color: "#4B5E55", maxWidth: 840 }}>E-books práticos para resolver problemas reais</div>
        <div style={{ fontSize: 30, marginTop: 56, color: "#A9422A" }}>Folheie uma amostra e compre na plataforma que preferir</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: fonte.buffer.slice(fonte.byteOffset, fonte.byteOffset + fonte.byteLength) as ArrayBuffer, weight: 500, style: "normal" }] },
  );
}
