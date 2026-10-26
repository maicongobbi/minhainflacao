"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, QrCode, Receipt } from "lucide-react";
import { useDb } from "@/lib/db-client";
import { useCategories } from "@/lib/use-data";
import { CategoryBadge } from "@/lib/categories";
import { MONTHS, formatDate, money } from "@/lib/format";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { StepperNav } from "@/components/year-month-nav";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function MonthPage({ params }: PageProps<"/mes/[ano]/[mes]">) {
  const { ano, mes } = use(params);
  const year = Number(ano);
  const month = Math.min(12, Math.max(1, Number(mes)));
  const router = useRouter();
  const db = useDb();

  const { data: expenses, isLoading } = db.expense.useFindMany({
    where: { year, month },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: true } } },
  });
  const { data: categories } = useCategories();

  const go = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    router.push(`/mes/${d.getFullYear()}/${d.getMonth() + 1}`);
  };

  const summary = useMemo(() => {
    const byCat = new Map<string, number>();
    let total = 0, discount = 0, tax = 0;
    for (const e of expenses ?? []) {
      total += e.total;
      discount += e.discount;
      tax += e.tax;
      byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.total);
    }
    return { total, discount, tax, byCat };
  }, [expenses]);

  if (isLoading) return <PageSkeleton />;

  const groups = (categories ?? [])
    .map((c) => ({ category: c, items: (expenses ?? []).filter((e) => e.categoryId === c.id), total: summary.byCat.get(c.id) ?? 0 }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.total - a.total);

  const newHref = `/lancamento/novo?ano=${year}&mes=${month}`;

  return (
    <>
      <PageHeader title={`${MONTHS[month - 1]} de ${year}`} description="Gastos lançados neste mês, agrupados por tipo.">
        <StepperNav label={`${MONTHS[month - 1].slice(0, 3)}/${year}`} onPrev={() => go(-1)} onNext={() => go(1)} />
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={money(summary.total)} hint={`${expenses?.length ?? 0} lançamentos`} />
        <StatCard label="Descontos" value={money(summary.discount)} tone="down" />
        <StatCard label="Impostos" value={money(summary.tax)} />
      </div>

      <div className="mt-4 flex gap-2">
        <Button asChild className="flex-1 sm:flex-none">
          <Link href={newHref}><Plus /> Novo gasto</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1 sm:flex-none">
          <Link href={`${newHref}&qr=1`}><QrCode /> Ler nota fiscal</Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="mt-6 items-center gap-2 py-12 text-center">
          <Receipt className="size-10 text-muted-foreground" />
          <p className="font-medium">Nenhum gasto neste mês</p>
          <p className="text-sm text-muted-foreground">Lance uma conta ou leia o QR code de uma nota.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map(({ category, items, total }) => (
            <section key={category.id}>
              <div className="mb-2 flex items-center gap-3">
                <CategoryBadge icon={category.icon} color={category.color} size="sm" />
                <h2 className="font-semibold">{category.name}</h2>
                <span className="ml-auto font-semibold tabular-nums">{money(total)}</span>
              </div>
              <Card className="gap-0 divide-y overflow-hidden py-0">
                {items.map((e) => (
                  <Link key={e.id} href={`/lancamento/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{e.description}</span>
                        {e.source === "nfce" && <Badge variant="secondary" className="shrink-0">NFC-e</Badge>}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {formatDate(e.date)}
                        {e.subcategory && ` · ${e.subcategory}`}
                        {e.store && ` · ${e.store}`}
                        {e._count.items > 0 && ` · ${e._count.items} itens`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{money(e.total)}</div>
                      {e.discount > 0 && <div className="text-xs text-emerald-600 tabular-nums dark:text-emerald-400">-{money(e.discount)}</div>}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
