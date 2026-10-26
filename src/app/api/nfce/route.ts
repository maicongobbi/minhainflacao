import { getSessionUser } from "@/lib/auth/server";
import { fetchNfce, keyFromUrl, NfceError, validateNfceUrl } from "@/server/nfce";
import { dbFor } from "@/server/db";

/** Recebe a URL do QR code, consulta a SEFAZ e devolve os dados da nota. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Faça login para importar notas." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) return Response.json({ error: "Informe o conteúdo do QR code." }, { status: 400 });

  try {
    const url = validateNfceUrl(body.url);
    const db = dbFor(user);
    // Nota já importada? Evita consultar a SEFAZ de novo.
    const urlKey = keyFromUrl(url);
    if (urlKey) {
      const existing = await db.expense.findFirst({ where: { nfceKey: urlKey }, select: { id: true } });
      if (existing) return Response.json({ existingId: existing.id }, { status: 409 });
    }
    const nfce = await fetchNfce(url);
    if (nfce.key && nfce.key !== urlKey) {
      const existing = await db.expense.findFirst({ where: { nfceKey: nfce.key }, select: { id: true } });
      if (existing) return Response.json({ existingId: existing.id }, { status: 409 });
    }
    return Response.json({ nfce, url: url.toString() });
  } catch (e) {
    if (e instanceof NfceError) return Response.json({ error: e.message }, { status: e.status });
    console.error("nfce import failed", e);
    return Response.json({ error: "Erro inesperado ao ler a nota." }, { status: 500 });
  }
}
