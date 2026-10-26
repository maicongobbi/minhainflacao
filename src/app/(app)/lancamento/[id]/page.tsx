"use client";

import { use } from "react";
import Link from "next/link";
import { useDb } from "@/lib/db-client";
import { toIsoDate } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { ExpenseForm, type ExpenseDraft } from "@/components/expense-form";
import { Button } from "@/components/ui/button";

export default function EditExpensePage({ params }: PageProps<"/lancamento/[id]">) {
  const { id } = use(params);
  const db = useDb();
  const { data: e, isLoading } = db.expense.useFindUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (isLoading) return <PageSkeleton />;
  if (!e) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium">Lançamento não encontrado.</p>
        <Button asChild variant="link"><Link href="/painel">Voltar ao painel</Link></Button>
      </div>
    );
  }

  const initial: ExpenseDraft = {
    id: e.id,
    categoryId: e.categoryId,
    subcategory: e.subcategory ?? null,
    description: e.description,
    store: e.store ?? "",
    date: toIsoDate(e.date),
    year: e.year,
    month: e.month,
    amount: e.amount,
    discount: e.discount,
    tax: e.tax,
    notes: e.notes ?? "",
    items: e.items.map((i) => ({
      key: i.id, description: i.description, code: i.code ?? null, quantity: i.quantity, unit: i.unit ?? null,
      unitPrice: i.unitPrice, total: i.total, discount: i.discount, tax: i.tax,
    })),
    nfce: e.source === "nfce"
      ? {
          key: e.nfceKey ?? null, url: e.nfceUrl ?? "", number: e.nfceNumber ?? null, series: e.nfceSeries ?? null,
          issuedAt: e.issuedAt ? new Date(e.issuedAt).toISOString() : null, cnpj: e.cnpj ?? null, address: e.address ?? null,
          payments: (e.payments as Payment[] | null) ?? [],
        }
      : null,
  };

  return (
    <>
      <PageHeader title="Editar lançamento" description={e.description} />
      <ExpenseForm key={e.updatedAt.toString()} initial={initial} />
    </>
  );
}
