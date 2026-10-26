"use client";

import { useMemo, useState } from "react";
import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { useDb } from "@/lib/db-client";
import { formatDate, money, percent, toIsoDate, variation } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Purchase = { date: string; price: number; store: string | null; total: number };

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

export default function PricesPage() {
  const db = useDb();
  const [q, setQ] = useState("");
  const { data, isLoading } = db.expenseItem.useFindMany({
    where: { unitPrice: { gt: 0 } },
    select: { description: true, unitPrice: true, total: true, unit: true, expense: { select: { date: true, store: true } } },
  });

  const rows = useMemo(() => {
    const groups = new Map<string, { name: string; unit: string | null; purchases: Purchase[] }>();
    for (const it of data ?? []) {
      const k = normalize(it.description);
      const g = groups.get(k) ?? { name: it.description, unit: it.unit ?? null, purchases: [] };
      g.purchases.push({ date: toIsoDate(it.expense.date), price: it.unitPrice, store: it.expense.store ?? null, total: it.total });
      groups.set(k, g);
    }
    return [...groups.values()]
      .map((g) => {
        const p = g.purchases.sort((a, b) => a.date.localeCompare(b.date));
        const first = p[0];
        const last = p[p.length - 1];
        return { ...g, count: p.length, first, last, change: p.length > 1 ? variation(first.price, last.price) : null };
      })
      .sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) || b.count - a.count);
  }, [data]);

  if (isLoading) return <PageSkeleton />;

  const compared = rows.filter((r) => r.change !== null);
  // Inflação pessoal: média das variações, com peso pelo quanto você gasta em cada item.
  const weight = compared.reduce((s, r) => s + r.last.total, 0);
  const personal = weight ? compared.reduce((s, r) => s + (r.change ?? 0) * r.last.total, 0) / weight : null;
  const ups = compared.filter((r) => (r.change ?? 0) > 0).length;
  const filtered = q ? rows.filter((r) => normalize(r.name).includes(normalize(q))) : rows;

  return (
    <>
      <PageHeader title="Preços" description="Como o preço dos itens que você compra mudou entre a primeira e a última compra." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Sua inflação"
          value={percent(personal)}
          hint="média ponderada pelo seu gasto"
          tone={personal === null ? "neutral" : personal > 0 ? "up" : "down"}
        />
        <StatCard label="Itens comparados" value={compared.length} hint={`de ${rows.length} itens comprados`} />
        <StatCard label="Ficaram mais caros" value={ups} hint={`${compared.length - ups} ficaram iguais ou mais baratos`} />
      </div>

      <div className="relative mt-5">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item..." className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-4 py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "Importe notas fiscais ou lance itens para acompanhar os preços." : "Nenhum item encontrado."}
        </Card>
      ) : (
        <Card className="mt-4 gap-0 divide-y overflow-hidden py-0">
          {filtered.slice(0, 300).map((r) => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.count} compra{r.count > 1 ? "s" : ""} · última em {formatDate(r.last.date)}
                  {r.last.store && ` · ${r.last.store}`}
                </div>
              </div>
              <div className="text-right text-sm tabular-nums">
                <div className="font-medium">
                  {money(r.last.price)}
                  {r.unit && <span className="text-xs text-muted-foreground">/{r.unit.toLowerCase()}</span>}
                </div>
                {r.count > 1 && <div className="text-xs text-muted-foreground">antes {money(r.first.price)}</div>}
              </div>
              <div
                className={cn(
                  "flex w-20 items-center justify-end gap-1 text-sm font-medium tabular-nums",
                  r.change === null && "text-muted-foreground",
                  (r.change ?? 0) > 0 && "text-red-600 dark:text-red-400",
                  (r.change ?? 0) < 0 && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {(r.change ?? 0) > 0 && <TrendingUp className="size-3.5" />}
                {(r.change ?? 0) < 0 && <TrendingDown className="size-3.5" />}
                {r.change === null ? "—" : percent(r.change)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
