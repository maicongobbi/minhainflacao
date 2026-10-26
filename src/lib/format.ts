const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export const money = (v: number) => brl.format(v || 0);
export const moneyCompact = (v: number) => brlCompact.format(v || 0);
export const number = (v: number) => num.format(v || 0);

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Converte "1.234,56" ou "1234.56" em número. */
export function parseDecimal(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  let s = String(value).replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Variação percentual de `from` para `to`. */
export function variation(from: number, to: number): number | null {
  if (!from) return null;
  return ((to - from) / from) * 100;
}

export function percent(v: number | null, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits).replace(".", ",")}%`;
}

/** Datas de calendário (coluna DATE) chegam como meia-noite UTC. */
export function toIsoDate(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

export function formatDate(d: Date | string): string {
  const [y, m, day] = toIsoDate(d).split("-");
  return `${day}/${m}/${y}`;
}

export function fromIsoDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
