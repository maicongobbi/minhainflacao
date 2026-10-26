"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BadgePercent, CalendarDays, Landmark, Wallet } from "lucide-react";
import { useCategories, useYearExpenses } from "@/lib/use-data";
import { MONTHS, MONTHS_SHORT, money, moneyCompact, percent, variation } from "@/lib/format";
import { CategoryBadge } from "@/lib/categories";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { StepperNav } from "@/components/year-month-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

const chartConfig = { total: { label: "Gasto", color: "var(--chart-1)" } } satisfies ChartConfig;

export default function DashboardPage() {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(now.getFullYear());
  const { data: expenses, isLoading } = useYearExpenses(year);
  const { data: categories } = useCategories();

  const stats = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, () => 0);
    const byCat = new Map<string, number>();
    let total = 0, discount = 0, tax = 0;
    for (const e of expenses ?? []) {
      byMonth[e.month - 1] += e.total;
      byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.total);
      total += e.total;
      discount += e.discount;
      tax += e.tax;
    }
    const isCurrentYear = year === now.getFullYear();
    const refMonth = isCurrentYear ? now.getMonth() : 11; // índice 0-11
    const monthsWithData = byMonth.filter((v, i) => v > 0 && i <= refMonth).length || 1;
    return {
      byMonth, byCat, total, discount, tax,
      average: total / monthsWithData,
      refMonth,
      current: byMonth[refMonth],
      previous: refMonth > 0 ? byMonth[refMonth - 1] : 0,
    };
  }, [expenses, year, now]);

  if (isLoading) return <PageSkeleton />;

  const chartData = stats.byMonth.map((total, i) => ({ month: MONTHS_SHORT[i], index: i + 1, total }));
  const monthVar = variation(stats.previous, stats.current);
  const catRows = (categories ?? [])
    .map((c) => ({ ...c, value: stats.byCat.get(c.id) ?? 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader title="Painel" description="Seus gastos do ano, mês a mês.">
        <StepperNav
          label={year}
          onPrev={() => setYear((y) => y - 1)}
          onNext={() => setYear((y) => y + 1)}
          nextDisabled={year >= now.getFullYear()}
        />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Total em ${year}`} value={money(stats.total)} hint={`${expenses?.length ?? 0} lançamentos`} icon={<Wallet className="size-4" />} />
        <StatCard label="Média mensal" value={money(stats.average)} hint="nos meses com gastos" icon={<CalendarDays className="size-4" />} />
        <StatCard
          label={MONTHS[stats.refMonth]}
          value={money(stats.current)}
          hint={monthVar === null ? "sem mês anterior" : `${percent(monthVar)} vs ${MONTHS[stats.refMonth - 1]?.toLowerCase()}`}
          tone={monthVar === null ? "neutral" : monthVar > 0 ? "up" : "down"}
        />
        <StatCard
          label="Descontos · Impostos"
          value={<span className="text-emerald-600 dark:text-emerald-400">{money(stats.discount)}</span>}
          hint={<span className="inline-flex items-center gap-1"><Landmark className="size-3" /> {money(stats.tax)} em tributos</span>}
          icon={<BadgePercent className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Gastos por mês</CardTitle>
            <CardDescription>Toque em um mês para ver os lançamentos</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={chartData} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={56} fontSize={11} tickFormatter={(v) => moneyCompact(v)} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => money(Number(v))} />} />
                <Bar
                  dataKey="total"
                  fill="var(--color-total)"
                  radius={[6, 6, 0, 0]}
                  className="cursor-pointer"
                  onClick={(d) => router.push(`/mes/${year}/${(d.payload as { index: number }).index}`)}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Por tipo de gasto</CardTitle>
            <CardDescription>Participação no total do ano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {catRows.length === 0 && <EmptyYear year={year} />}
            {catRows.map((c) => {
              const pct = stats.total ? (c.value / stats.total) * 100 : 0;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <CategoryBadge icon={c.icon} color={c.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="tabular-nums">{money(c.value)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                  <span className="w-11 text-right text-xs text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Meses</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.byMonth.map((v, i) => {
          const future = year === now.getFullYear() && i > now.getMonth();
          return (
            <Link
              key={i}
              href={`/mes/${year}/${i + 1}`}
              className={`rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent ${future ? "opacity-50" : ""}`}
            >
              <div className="text-xs font-medium text-muted-foreground">{MONTHS[i]}</div>
              <div className="mt-1 font-semibold tabular-nums">{v ? money(v) : "—"}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function EmptyYear({ year }: { year: number }) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground">
      Nenhum gasto lançado em {year}.
      <div className="mt-3">
        <Button asChild size="sm">
          <Link href="/lancamento/novo">Lançar primeiro gasto</Link>
        </Button>
      </div>
    </div>
  );
}
