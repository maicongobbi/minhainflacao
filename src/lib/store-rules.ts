/** Normaliza nomes: sem acento, maiúsculo, só letras/números separados por espaço. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export type StoreRuleLike = {
  pattern: string;
  match: string;
  categoryId: string;
  subcategory?: string | null;
};

/**
 * Acha o vínculo de uma loja. Prioridade: nome exato (aprendido) e depois
 * a palavra mais específica (mais longa) que aparece no início de uma palavra
 * do nome. Ex.: "DROGA" vale para "DROGARIA S L LTDA" e "RAIA DROGASIL".
 */
export function findStoreRule<T extends StoreRuleLike>(store: string, rules: T[]): T | null {
  const name = normalizeName(store);
  if (!name) return null;
  const exact = rules.find((r) => r.match === "exact" && normalizeName(r.pattern) === name);
  if (exact) return exact;
  const padded = ` ${name}`;
  return (
    rules
      .filter((r) => r.match !== "exact")
      .filter((r) => {
        const p = normalizeName(r.pattern);
        return p && padded.includes(` ${p}`);
      })
      .sort((a, b) => b.pattern.length - a.pattern.length)[0] ?? null
  );
}

/** Vínculos criados para todo usuário novo (por nome do tipo e subtipo). */
export const DEFAULT_STORE_RULES: { pattern: string; category: string; subcategory: string | null }[] = [
  // Saúde
  ...["DROGA", "FARMA", "RAIA", "PAGUE MENOS", "PACHECO"].map((p) => ({ pattern: p, category: "Saúde", subcategory: "Farmácia" })),
  ...["LABORATORIO"].map((p) => ({ pattern: p, category: "Saúde", subcategory: "Exames" })),
  // Alimentação
  ...["ATACAD", "SUPERMERCADO", "MERCADO", "MERCEARIA", "ALIMENTOS", "ASSAI", "COMPER", "CARREFOUR", "PIRES", "NUNES"].map((p) => ({
    pattern: p, category: "Alimentação", subcategory: "Mercado",
  })),
  ...["HORTIFRUTI", "SACOLAO", "FEIRA"].map((p) => ({ pattern: p, category: "Alimentação", subcategory: "Feira" })),
  ...["PADARIA", "PANIFICADORA", "PANIFICACAO"].map((p) => ({ pattern: p, category: "Alimentação", subcategory: "Padaria" })),
  ...["ACOUGUE", "CASA DE CARNES", "CARNES"].map((p) => ({ pattern: p, category: "Alimentação", subcategory: "Açougue" })),
  ...["RESTAURANTE", "CHURRASCARIA", "LANCHONETE", "PIZZARIA"].map((p) => ({ pattern: p, category: "Alimentação", subcategory: "Restaurante" })),
  // Automóvel
  ...["POSTO", "AUTO POSTO", "COMBUSTIV"].map((p) => ({ pattern: p, category: "Automóvel", subcategory: "Combustível" })),
  ...["AUTO PECAS", "PECAS", "PNEUS", "OFICINA"].map((p) => ({ pattern: p, category: "Automóvel", subcategory: "Manutenção" })),
  // Casa
  { pattern: "ENERGISA", category: "Casa", subcategory: "Luz" },
  ...["AGUAS GUARIROBA", "SANESUL"].map((p) => ({ pattern: p, category: "Casa", subcategory: "Água" })),
  ...["MATERIAIS DE CONSTRUCAO", "HOME CENTER", "LEROY"].map((p) => ({ pattern: p, category: "Casa", subcategory: "Manutenção" })),
  // Lazer
  ...["CINEMA", "CINEMARK"].map((p) => ({ pattern: p, category: "Lazer", subcategory: "Passeios" })),
];
