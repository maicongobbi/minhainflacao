"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Plus, QrCode, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ItemDraft, ParsedNfce, Payment } from "@/lib/types";
import { useDb } from "@/lib/db-client";
import { useCategories } from "@/lib/use-data";
import { CategoryIcon } from "@/lib/categories";
import { findStoreRule, normalizeName } from "@/lib/store-rules";
import { MONTHS, formatDate, fromIsoDate, money, newId, number, round2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/decimal-input";
import { ItemDialog, emptyItem } from "@/components/item-dialog";
import { NfceImportDialog } from "@/components/nfce-import-dialog";

export type NfceDraft = {
  key: string | null;
  url: string;
  number: string | null;
  series: string | null;
  issuedAt: string | null;
  cnpj: string | null;
  address: string | null;
  payments: Payment[];
};

export type ExpenseDraft = {
  id?: string;
  categoryId: string;
  subcategory: string | null;
  description: string;
  store: string;
  date: string; // yyyy-MM-dd
  year: number;
  month: number;
  amount: number;
  discount: number;
  tax: number;
  notes: string;
  items: ItemDraft[];
  nfce: NfceDraft | null;
};

/** Distribui um valor (desconto ou imposto da nota) entre os itens, proporcional ao total de cada um. */
function distribute(items: ItemDraft[], value: number, field: "discount" | "tax"): ItemDraft[] {
  const sum = items.reduce((s, i) => s + i.total, 0);
  if (!value || !sum) return items;
  let left = round2(value);
  const biggest = items.reduce((b, it, idx) => (it.total > items[b].total ? idx : b), 0);
  const out = items.map((it) => {
    const share = round2((it.total / sum) * value);
    left = round2(left - share);
    return { ...it, [field]: share };
  });
  out[biggest] = { ...out[biggest], [field]: round2(out[biggest][field] + left) };
  return out;
}

export function ExpenseForm({ initial, openScanner = false }: { initial: ExpenseDraft; openScanner?: boolean }) {
  const router = useRouter();
  const db = useDb();
  const { data: categories } = useCategories();
  const create = db.expense.useCreate();
  const update = db.expense.useUpdate();
  const remove = db.expense.useDelete();
  const { data: rules } = db.storeRule.useFindMany();
  const createRule = db.storeRule.useCreate();
  const updateRule = db.storeRule.useUpdate();

  const [form, setForm] = useState<ExpenseDraft>(initial);
  const [refTouched, setRefTouched] = useState(!!initial.id);
  const [editing, setEditing] = useState<ItemDraft | null>(null);
  const [scannerOpen, setScannerOpen] = useState(openScanner);

  // O Next mantém a tela viva ao navegar; ao esconder, fecha a câmera e o item aberto.
  useLayoutEffect(() => () => {
    setScannerOpen(false);
    setEditing(null);
  }, []);

  const set = <K extends keyof ExpenseDraft>(k: K, v: ExpenseDraft[K]) => setForm((f) => ({ ...f, [k]: v }));
  const category = categories?.find((c) => c.id === form.categoryId);
  const hasItems = form.items.length > 0;

  const totals = useMemo(() => {
    if (!hasItems) return { amount: form.amount, discount: form.discount, tax: form.tax };
    const s = (k: "total" | "discount" | "tax") => round2(form.items.reduce((acc, i) => acc + i[k], 0));
    return { amount: s("total"), discount: s("discount"), tax: s("tax") };
  }, [form, hasItems]);
  const toPay = round2(totals.amount - totals.discount);

  function setDate(date: string) {
    setForm((f) => {
      const next = { ...f, date };
      if (!refTouched && date) {
        const [y, m] = date.split("-").map(Number);
        next.year = y;
        next.month = m;
      }
      return next;
    });
  }

  function onImported(n: ParsedNfce, url: string) {
    let items: ItemDraft[] = n.items.map((i) => ({ ...i, key: newId(), discount: 0, tax: 0 }));
    items = distribute(items, n.discount, "discount");
    items = distribute(items, n.tax, "tax");
    const date = n.issuedAt?.slice(0, 10);
    // Tipo de gasto pelo nome do estabelecimento (vínculos automáticos)
    const rule = findStoreRule(n.store, rules ?? []);
    setForm((f) => ({
      ...f,
      items,
      store: n.store,
      description: f.description || `Compra em ${n.store}`,
      categoryId: rule?.categoryId ?? f.categoryId,
      subcategory: rule ? rule.subcategory ?? null : f.subcategory,
      nfce: { key: n.key, url, number: n.number, series: n.series, issuedAt: n.issuedAt, cnpj: n.cnpj, address: n.address, payments: n.payments },
    }));
    if (date) setDate(date);
  }

  /** Ao digitar a loja à mão, sugere o tipo se ainda não foi escolhido. */
  function applyStoreRule() {
    if (form.categoryId || !form.store.trim()) return;
    const rule = findStoreRule(form.store, rules ?? []);
    if (rule) setForm((f) => ({ ...f, categoryId: rule.categoryId, subcategory: rule.subcategory ?? null }));
  }

  /** Lembra o tipo escolhido para esta loja (vínculo pelo nome exato). */
  async function learnStore(store: string | null, categoryId: string, subcategory: string | null) {
    if (!store) return;
    const current = findStoreRule(store, rules ?? []);
    if (current && current.categoryId === categoryId && (current.subcategory ?? null) === subcategory) return;
    const exact = rules?.find((r) => r.match === "exact" && normalizeName(r.pattern) === normalizeName(store));
    try {
      if (exact) await updateRule.mutateAsync({ where: { id: exact.id }, data: { categoryId, subcategory } });
      else await createRule.mutateAsync({ data: { pattern: store, match: "exact", categoryId, subcategory } });
    } catch {
      // Aprender o vínculo é opcional; não atrapalha o lançamento.
    }
  }

  function saveItem(item: ItemDraft) {
    setForm((f) => {
      const exists = f.items.some((i) => i.key === item.key);
      return { ...f, items: exists ? f.items.map((i) => (i.key === item.key ? item : i)) : [...f.items, item] };
    });
    setEditing(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId) return toast.error("Escolha o tipo de gasto.");
    if (!form.description.trim()) return toast.error("Informe uma descrição.");
    if (totals.amount <= 0) return toast.error("Informe o valor do gasto ou adicione itens.");

    const data = {
      categoryId: form.categoryId,
      subcategory: form.subcategory || null,
      description: form.description.trim(),
      store: form.store.trim() || null,
      date: fromIsoDate(form.date),
      year: form.year,
      month: form.month,
      amount: totals.amount,
      discount: totals.discount,
      tax: totals.tax,
      total: toPay,
      notes: form.notes.trim() || null,
      source: form.nfce ? "nfce" : "manual",
      nfceKey: form.nfce?.key ?? null,
      nfceUrl: form.nfce?.url ?? null,
      nfceNumber: form.nfce?.number ?? null,
      nfceSeries: form.nfce?.series ?? null,
      issuedAt: form.nfce?.issuedAt ? new Date(form.nfce.issuedAt) : null,
      cnpj: form.nfce?.cnpj ?? null,
      address: form.nfce?.address ?? null,
      payments: form.nfce?.payments ?? undefined,
    };
    const items = form.items.map((i, position) => ({
      id: crypto.randomUUID(),
      position,
      description: i.description,
      code: i.code,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      total: i.total,
      discount: i.discount,
      tax: i.tax,
    }));

    try {
      if (form.id) {
        await update.mutateAsync({
          where: { id: form.id },
          data: {
            ...data,
            // O ZenStack roda o create antes do deleteMany, então apagamos só os itens antigos.
            items: { deleteMany: { id: { notIn: items.map((i) => i.id) } }, create: items },
          },
        });
        toast.success("Lançamento atualizado");
      } else {
        await create.mutateAsync({ data: { ...data, items: { create: items } } });
        toast.success("Gasto lançado");
      }
      learnStore(data.store, data.categoryId, data.subcategory);
      if (form.id) {
        router.push(`/mes/${form.year}/${form.month}`);
      } else {
        // Novo lançamento: limpa o formulário e volta para o painel.
        setForm(initial);
        setRefTouched(false);
        router.push("/painel");
      }
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      toast.error(/unique|duplicate/i.test(msg) ? "Essa nota fiscal já foi importada." : "Não foi possível salvar. Tente de novo.");
    }
  }

  async function onDelete() {
    if (!form.id || !confirm("Excluir este lançamento?")) return;
    await remove.mutateAsync({ where: { id: form.id } });
    toast.success("Lançamento excluído");
    router.push(`/mes/${form.year}/${form.month}`);
  }

  const saving = create.isPending || update.isPending;
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i);

  const saveLabel = form.id ? "Salvar" : "Lançar";

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="grid min-w-0 gap-4">
        {/* Ações no topo: ler nota e salvar */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setScannerOpen(true)}>
            <QrCode /> Ler nota fiscal
          </Button>
          <Button type="submit" size="lg" disabled={saving} aria-label={saveLabel} className="px-4 sm:px-6">
            {saving ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            {saveLabel}
            <span className="hidden tabular-nums sm:inline">· {money(toPay)}</span>
          </Button>
        </div>

        {/* Tipo de gasto */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de gasto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {categories?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, categoryId: c.id, subcategory: f.categoryId === c.id ? f.subcategory : null }))}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors hover:bg-accent",
                    form.categoryId === c.id && "border-transparent ring-2",
                  )}
                  style={form.categoryId === c.id ? ({ "--tw-ring-color": c.color, backgroundColor: `${c.color}14` } as React.CSSProperties) : undefined}
                >
                  <CategoryIcon icon={c.icon} color={c.color} className="size-5" />
                  <span className="w-full truncate text-center">{c.name}</span>
                </button>
              ))}
            </div>
            {category && category.subcategories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {category.subcategories.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("subcategory", form.subcategory === s ? null : s)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent",
                      form.subcategory === s && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do gasto</CardTitle>
            {form.nfce && (
              <CardAction>
                <Badge variant="secondary">NFC-e {form.nfce.number ? `nº ${form.nfce.number}` : ""}</Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input id="desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Conta de luz, Compra do mês" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store">Estabelecimento</Label>
              <Input id="store" value={form.store} onChange={(e) => set("store", e.target.value)} onBlur={applyStoreRule} placeholder="Opcional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Mês de referência</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={String(form.month)} onValueChange={(v) => { setRefTouched(true); set("month", Number(v)); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(form.year)} onValueChange={(v) => { setRefTouched(true); set("year", Number(v)); }}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!hasItems && (
              <>
                <div className="grid gap-2">
                  <Label>Valor</Label>
                  <DecimalInput prefix="R$" value={form.amount} onValueChange={(v) => set("amount", v)} placeholder="0,00" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>Desconto</Label>
                    <DecimalInput value={form.discount} onValueChange={(v) => set("discount", v)} placeholder="0,00" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Impostos</Label>
                    <DecimalInput value={form.tax} onValueChange={(v) => set("tax", v)} placeholder="0,00" />
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" />
            </div>
          </CardContent>
        </Card>

        {/* Itens */}
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Itens {hasItems && <span className="text-muted-foreground">({form.items.length})</span>}</CardTitle>
            <CardAction className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(emptyItem())}>
                <Plus /> <span className="hidden sm:inline">Item</span>
              </Button>
            </CardAction>
          </CardHeader>
          {hasItems ? (
            <ul className="divide-y border-t">
              {form.items.map((it) => (
                <li key={it.key}>
                  <button type="button" onClick={() => setEditing(it)} className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.description}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {number(it.quantity)} {it.unit ?? ""} × {money(it.unitPrice)}
                        {it.discount > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · desc. {money(it.discount)}</span>}
                        {it.tax > 0 && <span> · imp. {money(it.tax)}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{money(it.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 border-t px-6 py-8 text-center text-sm text-muted-foreground">
              <Receipt className="size-8" />
              Sem itens. Informe só o valor acima, adicione itens um a um ou leia o QR code da nota fiscal.
            </div>
          )}
        </Card>
      </div>

      {/* Resumo: fixo embaixo no celular, lateral no desktop */}
      <div className="lg:sticky lg:top-20">
        <Card className="gap-3 p-4">
          <div className="grid gap-1.5 text-sm">
            <Row label="Valor bruto" value={money(totals.amount)} />
            <Row label="Descontos" value={`- ${money(totals.discount)}`} className="text-emerald-600 dark:text-emerald-400" />
            <Row label="Impostos (já inclusos)" value={money(totals.tax)} className="text-muted-foreground" />
            <div className="mt-1 flex items-baseline justify-between border-t pt-2">
              <span className="font-medium">Total pago</span>
              <span className="text-xl font-semibold tabular-nums">{money(toPay)}</span>
            </div>
          </div>
          {form.nfce && (
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{form.store}</div>
              {form.nfce.cnpj && <div>CNPJ {form.nfce.cnpj}</div>}
              {form.nfce.issuedAt && <div>Emitida em {formatDate(form.nfce.issuedAt)}</div>}
              {form.nfce.payments.map((p, i) => <div key={i}>{p.method}: {money(p.amount)}</div>)}
            </div>
          )}
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            {form.id ? "Salvar alterações" : "Lançar gasto"}
          </Button>
          {form.id && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete} disabled={remove.isPending}>
              <Trash2 /> Excluir lançamento
            </Button>
          )}
        </Card>
      </div>

      <ItemDialog
        item={editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSave={saveItem}
        onDelete={(key) => {
          setForm((f) => ({ ...f, items: f.items.filter((i) => i.key !== key) }));
          setEditing(null);
        }}
      />
      <NfceImportDialog open={scannerOpen} onOpenChange={setScannerOpen} onImported={onImported} />
    </form>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
