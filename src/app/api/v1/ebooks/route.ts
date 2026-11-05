import { revalidateTag } from "next/cache";
import { autorizado, erro, naoAutorizado } from "@/lib/api";
import { manifesto } from "@/lib/manifesto";
import { primeiroOwner, publicarManifesto, type Arquivos } from "@/lib/publicar-manifesto";
import { SITE_URL } from "@/lib/site";

const LIMITE_ARQUIVO = 25 * 1024 * 1024;

const arquivoDe = async (v: FormDataEntryValue | null): Promise<Buffer | undefined> => (v instanceof File && v.size > 0 && v.size <= LIMITE_ARQUIVO ? Buffer.from(await v.arrayBuffer()) : undefined);

// Publicar pelo manifesto (./bibliotheon publicar). multipart/form-data: `manifest` (JSON), `capa`, `amostras` (várias), `amostraPdf`.
// ?dryRun=1 só mostra o que mudaria; ?publicar=1 publica se estiver completo; ?adotar=1 vincula um e-book criado no painel;
// ?amostras=1 troca as amostras mesmo que pareçam iguais. Regras: src/lib/publicar-manifesto.ts e docs/03-tecnico.md.
export async function POST(req: Request) {
  if (!autorizado(req)) return naoAutorizado();
  const q = new URL(req.url).searchParams;
  const form = await req.formData().catch(() => null);
  if (!form) return erro("Envie multipart/form-data com o campo manifest.", 422);

  const bruto = form.get("manifest");
  const texto = bruto instanceof File ? await bruto.text() : typeof bruto === "string" ? bruto : "";
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return erro("O manifesto não é um JSON válido.", 422);
  }
  const lido = manifesto.safeParse(json);
  if (!lido.success) return erro("Manifesto inválido.", 422, lido.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));

  const arquivos: Arquivos = {
    capa: await arquivoDe(form.get("capa")),
    amostras: await Promise.all(form.getAll("amostras").map(arquivoDe)).then((l) => l.flatMap((b) => (b ? [b] : []))),
    amostraPdf: await arquivoDe(form.get("amostraPdf")),
  };
  const dryRun = q.get("dryRun") === "1";
  const r = await publicarManifesto(lido.data, arquivos, {
    dryRun,
    publicar: q.get("publicar") === "1",
    adotar: q.get("adotar") === "1",
    reenviarAmostras: q.get("amostras") === "1",
    ownerId: primeiroOwner(),
  });
  if (!r.ok) return erro(r.erro, r.status, r.detalhes);

  if (r.gravado) revalidateTag("ebooks", { expire: 0 });
  return Response.json({ ...r, url: `${SITE_URL}/${r.slug}`, previewUrl: r.id ? `${SITE_URL}/painel/ebooks/${r.id}/previa` : null });
}
