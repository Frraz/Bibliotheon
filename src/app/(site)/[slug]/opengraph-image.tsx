import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { getEbook } from "@/lib/catalogo";
import { caminhoDaMidia } from "@/lib/midia";
import { brl } from "@/lib/preco";

export const alt = "Capa do e-book";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagem de compartilhamento (WhatsApp, Instagram, Facebook, X): capa + título + preço, na identidade da marca.
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await getEbook(slug);
  const fonte = await readFile(new URL("../../../assets/fonts/fraunces-500.woff", import.meta.url)); // runtime Node: readFile, não fetch

  let capa: string | null = null;
  const alvo = e?.capa ? caminhoDaMidia(e.capa.replace(/^\/m\//, "").split("/")) : null;
  if (alvo && /\.(jpe?g|png)$/i.test(alvo.caminho)) {
    capa = `data:${alvo.tipo};base64,${(await readFile(alvo.caminho)).toString("base64")}`;
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F3ECDD", color: "#1F2A29", fontFamily: "Fraunces" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "64px 40px 64px 72px" }}>
          <div style={{ fontSize: 26, color: "#4B5E55", marginBottom: 28 }}>Bibliotheon</div>
          <div style={{ fontSize: e && e.titulo.length > 42 ? 58 : 70, lineHeight: 1.05, letterSpacing: -1 }}>{e?.titulo ?? "Bibliotheon"}</div>
          {e?.vigente.valor != null && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
              <div style={{ background: "#A9422A", color: "#F3ECDD", fontSize: 34, padding: "14px 30px" }}>{brl(e.vigente.valor)}</div>
            </div>
          )}
        </div>
        {capa && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 470, background: "#EAE1CE" }}>
            <img src={capa} width={300} height={480} alt="" style={{ boxShadow: "0 24px 50px -12px rgba(31,42,41,.55)" }} />
          </div>
        )}
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: fonte.buffer.slice(fonte.byteOffset, fonte.byteOffset + fonte.byteLength) as ArrayBuffer, weight: 500, style: "normal" }] },
  );
}
