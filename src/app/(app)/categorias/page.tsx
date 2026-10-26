"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDb } from "@/lib/db-client";
import { useCategories } from "@/lib/use-data";
import { CategoryBadge, CategoryIcon, COLORS, ICONS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { PageHeader, PageSkeleton } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = { id?: string; name: string; icon: string; color: string; subcategories: string };

export default function CategoriesPage() {
  const db = useDb();
  const { data: categories, isLoading } = useCategories();
  const create = db.category.useCreate();
  const update = db.category.useUpdate();
  const remove = db.category.useDelete();
  const [draft, setDraft] = useState<Draft | null>(null);

  if (isLoading) return <PageSkeleton />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft?.name.trim()) return;
    const data = {
      name: draft.name.trim(),
      icon: draft.icon,
      color: draft.color,
      subcategories: draft.subcategories.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (draft.id) await update.mutateAsync({ where: { id: draft.id }, data });
      else await create.mutateAsync({ data: { ...data, order: categories?.length ?? 0 } });
      setDraft(null);
      toast.success("Tipo salvo");
    } catch {
      toast.error("Não foi possível salvar. Já existe um tipo com esse nome?");
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Excluir o tipo "${name}"?`)) return;
    try {
      await remove.mutateAsync({ where: { id } });
      toast.success("Tipo excluído");
    } catch {
      toast.error("Esse tipo tem lançamentos. Mova ou exclua os lançamentos antes.");
    }
  }

  return (
    <>
      <PageHeader title="Tipos de gasto" description="Organize seus gastos em tipos e subtipos (ex.: Casa → água, luz, telefone).">
        <Button onClick={() => setDraft({ name: "", icon: "wallet", color: COLORS[0], subcategories: "" })}>
          <Plus /> Novo tipo
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories?.map((c) => (
          <Card key={c.id} className="flex-row items-start gap-3 p-4">
            <CategoryBadge icon={c.icon} color={c.color} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{c.name}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.subcategories.length === 0 && <span className="text-xs text-muted-foreground">Sem subtipos</span>}
                {c.subcategories.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setDraft({ ...c, subcategories: c.subcategories.join(", ") })}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => del(c.id, c.name)}>
                <Trash2 />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar tipo" : "Novo tipo"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form onSubmit={save} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cat-name">Nome</Label>
                <Input id="cat-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required autoFocus />
              </div>
              <div className="grid gap-2">
                <Label>Ícone</Label>
                <div className="grid grid-cols-9 gap-1">
                  {Object.keys(ICONS).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-label={k}
                      onClick={() => setDraft({ ...draft, icon: k })}
                      className={cn("flex aspect-square items-center justify-center rounded-md border hover:bg-accent", draft.icon === k && "border-primary bg-accent")}
                    >
                      <CategoryIcon icon={k} color={draft.icon === k ? draft.color : undefined} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => setDraft({ ...draft, color: c })}
                      className={cn("size-8 rounded-full ring-offset-2 ring-offset-background", draft.color === c && "ring-2")}
                      style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-subs">Subtipos</Label>
                <Input id="cat-subs" value={draft.subcategories} onChange={(e) => setDraft({ ...draft, subcategories: e.target.value })} placeholder="Água, Luz, Telefone" />
                <p className="text-xs text-muted-foreground">Separe por vírgula.</p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending || update.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
