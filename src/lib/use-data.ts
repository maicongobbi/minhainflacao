"use client";
import { useDb } from "@/lib/db-client";

export function useCategories() {
  const db = useDb();
  return db.category.useFindMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
}

/** Resumo dos lançamentos de um ano (sem itens), para painéis e totais. */
export function useYearExpenses(year: number) {
  const db = useDb();
  return db.expense.useFindMany({
    where: { year },
    select: { id: true, month: true, total: true, amount: true, discount: true, tax: true, categoryId: true },
  });
}
