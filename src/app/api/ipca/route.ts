import { getSessionUser } from "@/lib/auth/server";
import { IpcaError, refreshIpca } from "@/server/ipca";

/** Atualiza o IPCA (IBGE) no banco. Acionado pelo botão na página de preços. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Faça login para atualizar o IPCA." }, { status: 401 });

  try {
    return Response.json(await refreshIpca());
  } catch (e) {
    if (e instanceof IpcaError) return Response.json({ error: e.message }, { status: 502 });
    console.error("ipca refresh failed", e);
    return Response.json({ error: "Erro inesperado ao atualizar o IPCA." }, { status: 500 });
  }
}
