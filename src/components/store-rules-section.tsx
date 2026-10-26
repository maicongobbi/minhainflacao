"use client";

import { useMemo, useState } from "react";
import { Link2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDb } from "@/lib/db-client";
import { useCategories } from "@/lib/use-data";
import { CategoryIcon } from "@/lib/categories";
import { normalizeName } from "@/lib/store-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

export function StoreRulesSection() {
  const db = useDb();
  const { data: categories } = useCategories();
  const { data: rules } = db.storeRule.useFindMany({ orderBy: { pattern: "asc" } });
  const create = db.storeRule.useCreate();
  const remove = db.storeRule.useDelete();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<{ pattern: string; categoryId: string; subcategory: string } | null>(null);

  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const filtered = (rules ?? []).filter((r) => {
    if (!q) return true;
    const n = normalizeName(q);
    return normalizeName(r.pattern).includes(n) || normalizeName(catById.get(r.categoryId)?.name ?? "").includes(n);
  });
  const draftCategory = draft ? catById.get(draft.categoryId) : undefined;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft?.pattern.trim() || !draft.categoryId) return;
    try {
      await create.mutateAsync({
        data: {
          pattern: draft.pattern.trim().toUpperCase(),
          match: "contains",
          categoryId: draft.categoryId,
          subcategory: draft.subcategory && draft.subcategory !== NONE ? draft.subcategory : null,
        },
      });
      setDraft(null);
      toast.success("Vínculo criado");
    } catch {
      toast.error("Não foi possível salvar. Esse nome já tem vínculo?");
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Link2 className="size-5" /> Vínculos automáticos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ao importar uma nota, o tipo de gasto é escolhido pelo nome do estabelecimento. Uma palavra vale para
            qualquer nome que a contenha (ex.: <b>DROGA</b> vale para DROGARIA e DROGASIL). Quando você escolhe outro
            tipo para uma loja, o app aprende.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDraft({ pattern: "", categoryId: "", subcategory: NONE })}>
          <Plus /> Novo vínculo
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estabelecimento ou tipo..." className="pl-9" />
      </div>

      <Card className="gap-0 divide-y overflow-hidden py-0">
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum vínculo.</div>}
        {filtered.map((r) => {
          const c = catById.get(r.categoryId);
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm">{r.pattern}</span>
                  {r.match === "exact" && (
                    <Badge variant="secondary" className="shrink-0"><Sparkles /> aprendido</Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {c && <CategoryIcon icon={c.icon} color={c.color} className="size-3.5" />}
                  {c?.name ?? "—"}
                  {r.subcategory && ` · ${r.subcategory}`}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir vínculo"
                onClick={() => remove.mutate({ where: { id: r.id } })}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </Card>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo vínculo</DialogTitle>
            <DialogDescription>Notas de estabelecimentos com essa palavra no nome entram neste tipo.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form onSubmit={save} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rule-pattern">Nome ou palavra</Label>
                <Input
                  id="rule-pattern"
                  value={draft.pattern}
                  onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
                  placeholder="Ex.: DROGARIA, PIRES, ATACADAO"
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={draft.categoryId} onValueChange={(v) => setDraft({ ...draft, categoryId: v, subcategory: NONE })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Subtipo</Label>
                  <Select value={draft.subcategory} onValueChange={(v) => setDraft({ ...draft, subcategory: v })} disabled={!draftCategory}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {draftCategory?.subcategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending || !draft.categoryId}>Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
