import { MONTHS_SHORT } from "@/lib/format";
import { normalizeName } from "@/lib/store-rules";

/** Séries do IPCA guardadas no banco (ver OfficialIndex no schema). */
export const OFFICIAL_SERIES = ["ipca", "alimentos", "domicilio"] as const;
export type OfficialSeries = (typeof OFFICIAL_SERIES)[number];

/** Períodos do comparativo, em meses. */
export const PERIODS = [1, 3, 6, 12] as const;

/**
 * Janela, em dias antes da compra mais recente, onde procuramos a compra
 * "de N meses atrás": [mínimo, alvo, máximo]. Ninguém compra o mesmo item todo
 * mês, então há folga, mas as janelas não se sobrepõem entre os períodos.
 */
const WINDOWS: Record<number, [number, number, number]> = {
  1: [15, 30, 45],
  3: [60, 91, 120],
  6: [135, 182, 225],
  12: [275, 365, 455],
};
/** Itens sem compra nos últimos 45 dias (antes da compra mais recente) ficam de fora. */
const CURRENT_WINDOW = 45;

const DAY = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);
const dayToIso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

/** Mês como número contínuo (ano * 12 + mês), para fazer contas com meses. */
export const monthIndex = (year: number, month: number) => year * 12 + (month - 1);
export const periodToIndex = (period: number) => monthIndex(Math.floor(period / 100), period % 100);
export function monthLabel(index: number) {
  return `${MONTHS_SHORT[index % 12].toLowerCase()}/${Math.floor(index / 12)}`;
}

export type Purchase = {
  name: string;
  unit: string | null;
  /** Data da compra (AAAA-MM-DD). */
  date: string;
  total: number;
  quantity: number;
};

export type ItemChange = { name: string; unit: string | null; from: string; to: string; change: number; spent: number };

export type PeriodResult = {
  months: number;
  /** Variação ponderada em %, ou null se nenhum item pôde ser comparado. */
  value: number | null;
  count: number;
  items?: ItemChange[];
};

/**
 * Inflação pessoal em cada período: para cada item comprado recentemente,
 * compara o preço por unidade da compra mais recente com o da compra feita
 * cerca de N meses antes. A média é ponderada pelo gasto na compra mais recente.
 */
export function personalInflation(purchases: Purchase[], periods: readonly number[] = PERIODS) {
  type Item = { name: string; unit: string | null; days: Map<number, { spent: number; qty: number }> };
  const items = new Map<string, Item>();
  let latest = -Infinity;
  for (const p of purchases) {
    if (!(p.quantity > 0) || !(p.total > 0)) continue;
    // Separar por unidade evita comparar preço por kg com preço por pacote.
    const key = `${normalizeName(p.name)}|${(p.unit ?? "").toUpperCase()}`;
    const day = dayNumber(p.date);
    latest = Math.max(latest, day);
    const item = items.get(key) ?? { name: p.name, unit: p.unit, days: new Map() };
    const agg = item.days.get(day) ?? { spent: 0, qty: 0 };
    agg.spent += p.total;
    agg.qty += p.quantity;
    item.days.set(day, agg);
    items.set(key, item);
  }

  const results: PeriodResult[] = periods.map((n) => {
    const [min, target, max] = WINDOWS[n] ?? [n * 22, n * 30, n * 38];
    let sum = 0, weight = 0;
    const changes: ItemChange[] = [];
    for (const item of items.values()) {
      const days = [...item.days.keys()];
      const cur = Math.max(...days);
      if (cur < latest - CURRENT_WINDOW) continue; // item que você não compra mais
      let base: number | null = null;
      for (const d of days) {
        const back = cur - d;
        if (back < min || back > max) continue;
        if (base === null || Math.abs(back - target) < Math.abs(cur - base - target)) base = d;
      }
      if (base === null) continue;
      const now = item.days.get(cur)!;
      const before = item.days.get(base)!;
      const change = ((now.spent / now.qty) / (before.spent / before.qty) - 1) * 100;
      sum += change * now.spent;
      weight += now.spent;
      changes.push({ name: item.name, unit: item.unit, from: dayToIso(base), to: dayToIso(cur), change, spent: now.spent });
    }
    changes.sort((a, b) => b.change - a.change);
    return { months: n, value: weight ? sum / weight : null, count: changes.length, items: changes };
  });

  return { latest: Number.isFinite(latest) ? dayToIso(latest) : null, results };
}

export type OfficialRow = { series: string; period: number; value: number };

/** IPCA acumulado nos últimos N meses divulgados de cada série. */
export function officialInflation(rows: OfficialRow[], periods: readonly number[] = PERIODS) {
  const out = {} as Record<OfficialSeries, { latest: number | null; results: PeriodResult[] }>;
  for (const series of OFFICIAL_SERIES) {
    const byMonth = new Map(rows.filter((r) => r.series === series).map((r) => [periodToIndex(r.period), r.value]));
    const latest = byMonth.size ? Math.max(...byMonth.keys()) : null;
    out[series] = {
      latest,
      results: periods.map((n) => {
        if (latest === null) return { months: n, value: null, count: 0 };
        let acc = 1;
        for (let i = latest - n + 1; i <= latest; i++) {
          const v = byMonth.get(i);
          if (v === undefined) return { months: n, value: null, count: 0 }; // falta mês no meio
          acc *= 1 + v / 100;
        }
        return { months: n, value: (acc - 1) * 100, count: n };
      }),
    };
  }
  return out;
}
