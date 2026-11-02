import "server-only";
import { rawDb } from "@/server/db";
import { OFFICIAL_SERIES, type OfficialSeries } from "@/lib/inflation";

// IPCA no SIDRA/IBGE: tabela 7060 (desde jan/2020), variável 63 (variação mensal),
// classificação 315 (geral, grupo, subgrupo...).
const CATEGORY_TO_SERIES: Record<string, OfficialSeries> = {
  "7169": "ipca",
  "7170": "alimentos",
  "7171": "domicilio",
};
const MONTHS_FETCHED = 25; // 12 meses acumulados + folga

type SidraRow = { D3C: string; D4C: string; V: string };

export class IpcaError extends Error {}

/** Busca no IBGE as variações mensais do IPCA e grava (ou atualiza) no banco. */
export async function refreshIpca() {
  const url =
    `https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63/p/last%20${MONTHS_FETCHED}` +
    `/c315/${Object.keys(CATEGORY_TO_SERIES).join(",")}`;

  let rows: SidraRow[];
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(String(res.status));
    rows = await res.json();
  } catch {
    throw new IpcaError("Não foi possível consultar o IBGE agora. Tente de novo em instantes.");
  }

  // A primeira linha do SIDRA é o cabeçalho. Valores ainda não divulgados vêm como "..." ou "-".
  const data = rows.slice(1).flatMap((r) => {
    const series = CATEGORY_TO_SERIES[r.D4C];
    const value = Number(r.V);
    const period = Number(r.D3C);
    return series && Number.isFinite(value) && r.V.trim() !== "" && period ? [{ series, period, value }] : [];
  });
  if (data.length === 0) throw new IpcaError("O IBGE não devolveu dados do IPCA.");

  const minPeriod = Math.min(...data.map((d) => d.period));
  await rawDb.$transaction(async (tx) => {
    await tx.officialIndex.deleteMany({
      where: { series: { in: [...OFFICIAL_SERIES] }, period: { gte: minPeriod } },
    });
    await tx.officialIndex.createMany({ data });
  });

  return { count: data.length, latest: Math.max(...data.map((d) => d.period)) };
}
