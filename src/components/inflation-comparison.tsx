"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDb } from "@/lib/db-client";
import { formatDate, percent } from "@/lib/format";
import { monthLabel, officialInflation, PERIODS, periodToIndex, personalInflation, type Purchase } from "@/lib/inflation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PERIOD_LABEL: Record<number, string> = { 1: "Último mês", 3: "3 meses", 6: "6 meses", 12: "12 meses" };

const toneClass = (v: number | null) =>
  v === null ? "text-muted-foreground" : v > 0 ? "text-red-600 dark:text-red-400" : v < 0 ? "text-emerald-600 dark:text-emerald-400" : "";

/** Sua inflação nos últimos 1, 3, 6 e 12 meses, ao lado do IPCA divulgado pelo IBGE. */
export function InflationComparison({ purchases }: { purchases: Purchase[] }) {
  const db = useDb();
  const official = db.officialIndex.useFindMany({ select: { series: true, period: true, value: true, updatedAt: true } });
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshed = useRef(false);

  const personal = useMemo(() => personalInflation(purchases), [purchases]);
  const ipca = useMemo(() => officialInflation(official.data ?? []), [official.data]);
  const updatedAt = useMemo(() => {
    const times = (official.data ?? []).map((r) => new Date(r.updatedAt).getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  }, [official.data]);

  async function refresh(silent = false) {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ipca", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível atualizar o IPCA.");
      await official.refetch();
      if (!silent) toast.success(`IPCA atualizado até ${monthLabel(periodToIndex(json.latest))}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o IPCA.");
    } finally {
      setRefreshing(false);
    }
  }

  // Na primeira visita, ainda sem IPCA no banco, busca sozinho.
  useEffect(() => {
    if (official.isSuccess && official.data.length === 0 && !autoRefreshed.current) {
      autoRefreshed.current = true;
      refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [official.isSuccess, official.data]);

  const rows = [
    { key: "alimentos", label: "IPCA alimentação e bebidas", data: ipca.alimentos },
    { key: "domicilio", label: "IPCA alimentação no domicílio", data: ipca.domicilio },
    { key: "ipca", label: "IPCA geral", data: ipca.ipca },
  ] as const;

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Sua inflação x IPCA</h2>
          <p className="text-xs text-muted-foreground">Variação de preço dos itens que você compra, ao lado da inflação oficial.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
          <RefreshCw className={cn(refreshing && "animate-spin")} />
          Atualizar IPCA
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PERIODS.map((n, i) => {
          const mine = personal.results[i];
          return (
            <div key={n} className="rounded-lg border p-3">
              <div className="text-xs font-medium text-muted-foreground">{PERIOD_LABEL[n]}</div>
              <div className={cn("mt-1 text-xl font-semibold tabular-nums md:text-2xl", toneClass(mine.value))}>
                {percent(mine.value)}
              </div>
              <div className="text-xs text-muted-foreground">
                Você · {mine.count ? `${mine.count} ${mine.count === 1 ? "item" : "itens"}` : "sem compras para comparar"}
              </div>
              <dl className="mt-3 space-y-1 border-t pt-2 text-xs">
                {rows.map((r) => {
                  const v = r.data.results[i].value;
                  return (
                    <div key={r.key} className="flex items-baseline justify-between gap-2">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className={cn("shrink-0 font-medium tabular-nums", toneClass(v))}>{percent(v, 2)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {personal.latest !== null
          ? `Você: preço médio de cada item no mês mais recente em que foi comprado (até ${monthLabel(personal.latest)}), comparado com N meses antes, com peso pelo quanto você gastou nele. `
          : "Você: importe notas com itens para calcular sua inflação. "}
        {ipca.alimentos.latest !== null
          ? `IPCA: acumulado nos últimos meses divulgados, até ${monthLabel(ipca.alimentos.latest)}. Fonte: IBGE${updatedAt ? `, atualizado em ${formatDate(updatedAt)}` : ""}.`
          : refreshing ? "Buscando o IPCA no IBGE..." : "IPCA ainda não carregado: use o botão Atualizar IPCA."}
      </p>
    </Card>
  );
}
