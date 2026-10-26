"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { todayIso } from "@/lib/format";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { ExpenseForm, type ExpenseDraft } from "@/components/expense-form";

function NewExpense() {
  const sp = useSearchParams();
  // Cada vez que se entra na página o formulário começa limpo
  // (o Next 16 mantém telas visitadas vivas; o bfcacheId muda a cada navegação).
  const { bfcacheId } = useRouter();
  const today = todayIso();
  const [ty, tm] = today.split("-").map(Number);
  const year = Number(sp.get("ano")) || ty;
  const month = Number(sp.get("mes")) || tm;
  // Lançando para outro mês: a data padrão vira o dia 1 daquele mês.
  const date = year === ty && month === tm ? today : `${year}-${String(month).padStart(2, "0")}-01`;

  const initial: ExpenseDraft = {
    categoryId: "", subcategory: null, description: "", store: "", date, year, month,
    amount: 0, discount: 0, tax: 0, notes: "", items: [], nfce: null,
  };
  return <ExpenseForm key={bfcacheId} initial={initial} openScanner={sp.get("qr") === "1"} />;
}

export default function NewExpensePage() {
  return (
    <>
      <PageHeader title="Novo lançamento" description="Escolha o tipo, informe o valor ou importe a nota fiscal." />
      <Suspense fallback={<PageSkeleton />}>
        <NewExpense />
      </Suspense>
    </>
  );
}
