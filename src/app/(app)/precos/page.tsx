"use client";

import { useMemo, useState } from "react";
import { Search, TrendingDown, TrendingUp } from "lucide-react";
import { useDb } from "@/lib/db-client";
import { money, percent, variation } from "@/lib/format";
import { normalizeName } from "@/lib/store-rules";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const YEARS_SHOWN = 4;

type YearAgg = { spent: number; qty: number };
type ItemRow = {
  name: string;
  unit: string | null;
  /** Preço médio pago por unidade em cada ano (gasto / quantidade). */
  price: Map<number, number>;
  spent: Map<number, number>;
  change: number | null;
  from: number | null;
  to: number | null;
};

export default function PricesPage() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [now] = useState(() => new Date().getFullYear());
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => now - YEARS_SHOWN + 1 + i);
  // Um ano a mais para calcular a variação do primeiro ano exibido.
  const firstYear = years[0] - 1;

  const { data, isLoading } = db.expenseItem.useFindMany({
    where: { unitPrice: { gt: 0 }, quantity: { gt: 0 }, expense: { year: { gte: firstYear } } },
    select: { description: true, total: true, quantity: true, unit: true, expense: { select: { year: true } } },
  });

  const { rows, annual, accumulated } = useMemo(() => {
    const groups = new Map<string, { name: string; unit: string | null; years: Map<number, YearAgg> }>();
    for (const it of data ?? []) {
      const k = normalizeName(it.description);
      const g = groups.get(k) ?? { name: it.description, unit: it.unit ?? null, years: new Map() };
      const y = g.years.get(it.expense.year) ?? { spent: 0, qty: 0 };
      y.spent += it.total;
      y.qty += it.quantity;
      g.years.set(it.expense.year, y);
      groups.set(k, g);
    }

    const rows: ItemRow[] = [...groups.values()].map((g) => {
      const price = new Map<number, number>();
      const spent = new Map<number, number>();
      for (const [y, a] of g.years) {
        price.set(y, a.spent / a.qty);
        spent.set(y, a.spent);
      }
      const seen = years.filter((y) => price.has(y));
      const from = seen.length > 1 ? seen[0] : null;
      const to = seen.length > 1 ? seen[seen.length - 1] : null;
      return {
        name: g.name, unit: g.unit, price, spent, from, to,
        change: from !== null && to !== null ? variation(price.get(from)!, price.get(to)!) : null,
      };
    });

    // Inflação pessoal de cada ano: variação do preço médio dos itens comprados
    // nos dois anos, com peso pelo quanto você gastou em cada item no ano.
    const annual = years.map((y) => {
      let weight = 0, sum = 0, count = 0;
      for (const r of rows) {
        const before = r.price.get(y - 1);
        const after = r.price.get(y);
        if (!before || !after) continue;
        const w = r.spent.get(y)!;
        sum += ((after - before) / before) * 100 * w;
        weight += w;
        count++;
      }
      return { year: y, value: weight ? sum / weight : null, count };
    });
    const known = annual.filter((a) => a.value !== null);
    const accumulated = known.length ? (known.reduce((acc, a) => acc * (1 + a.value! / 100), 1) - 1) * 100 : null;

    rows.sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) || a.name.localeCompare(b.name));
    return { rows: rows.filter((r) => years.some((y) => r.price.has(y))), annual, accumulated };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, now]);

  if (isLoading) return <PageSkeleton />;

  const filtered = q ? rows.filter((r) => normalizeName(r.name).includes(normalizeName(q))) : rows;
  const tone = (v: number | null) => (v === null ? "neutral" : v > 0 ? "up" : "down");

  return (
    <>
      <PageHeader
        title="Preços"
        description={`Sua inflação pessoal de ${years[0]} a ${now}: quanto o preço dos itens que você compra mudou de um ano para o outro.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {annual.map((a) => (
          <StatCard
            key={a.year}
            label={`${a.year} vs ${a.year - 1}`}
            value={percent(a.value)}
            hint={a.count ? `${a.count} itens comparados` : "sem itens nos dois anos"}
            tone={tone(a.value)}
          />
        ))}
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            label={`Acumulado ${years[0]}–${now}`}
            value={percent(accumulated)}
            hint="anos com dados, compostos"
            tone={tone(accumulated)}
          />
        </div>
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
        <Card className="mt-4 gap-0 overflow-hidden py-0">
          {/* Cabeçalho (desktop) */}
          <div className="hidden grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)_6rem] gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Item (preço médio por unidade)</span>
            {years.map((y) => <span key={y} className="text-right">{y}</span>)}
            <span className="text-right">Variação</span>
          </div>
          <div className="divide-y">
            {filtered.slice(0, 300).map((r) => (
              <div key={r.name} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_repeat(4,6.5rem)_6rem] md:items-center">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {r.name}
                    {r.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">/{r.unit.toLowerCase()}</span>}
                  </span>
                  <Change value={r.change} className="md:hidden" />
                </div>
                {/* Celular: anos em linha; desktop: colunas */}
                <div className="grid grid-cols-4 gap-1 md:contents">
                  {years.map((y) => (
                    <div key={y} className="rounded-md bg-muted/60 px-2 py-1 text-right md:bg-transparent md:p-0">
                      <div className="text-[10px] text-muted-foreground md:hidden">{y}</div>
                      <div className={cn("text-xs tabular-nums md:text-sm", !r.price.has(y) && "text-muted-foreground")}>
                        {r.price.has(y) ? money(r.price.get(y)!) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <Change value={r.change} className="hidden justify-end md:flex" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Change({ value, className }: { value: number | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums",
        value === null && "text-muted-foreground",
        (value ?? 0) > 0 && "text-red-600 dark:text-red-400",
        (value ?? 0) < 0 && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {(value ?? 0) > 0 && <TrendingUp className="size-3.5" />}
      {(value ?? 0) < 0 && <TrendingDown className="size-3.5" />}
      {value === null ? "—" : percent(value)}
    </span>
  );
}
