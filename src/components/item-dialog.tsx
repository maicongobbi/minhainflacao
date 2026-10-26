"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ItemDraft } from "@/lib/types";
import { newId, round2 } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/decimal-input";

export const emptyItem = (): ItemDraft => ({
  key: newId(), description: "", code: null, quantity: 1, unit: "UN", unitPrice: 0, total: 0, discount: 0, tax: 0,
});

export function ItemDialog({
  item,
  onOpenChange,
  onSave,
  onDelete,
}: {
  item: ItemDraft | null;
  onOpenChange: (v: boolean) => void;
  onSave: (item: ItemDraft) => void;
  onDelete?: (key: string) => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {item && <ItemForm key={item.key} item={item} onSave={onSave} onDelete={onDelete} />}
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({ item, onSave, onDelete }: { item: ItemDraft; onSave: (item: ItemDraft) => void; onDelete?: (key: string) => void }) {
  const [draft, setDraft] = useState<ItemDraft>(item);
  // Enquanto o usuário não mexe no total, ele acompanha quantidade x preço.
  const [autoTotal, setAutoTotal] = useState(round2(item.quantity * item.unitPrice) === item.total);

  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) =>
    setDraft((d) => {
      const next = { ...d, [k]: v };
      if (autoTotal && (k === "quantity" || k === "unitPrice")) next.total = round2(next.quantity * next.unitPrice);
      return next;
    });

  const isNew = !item.description;

  return (
    <>
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo item" : "Editar item"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.description.trim()) return;
            onSave({ ...draft, description: draft.description.trim() });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="item-desc">Descrição</Label>
            <Input id="item-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Arroz 5kg" autoFocus required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Qtde.</Label>
              <DecimalInput value={draft.quantity} onValueChange={(v) => set("quantity", v)} digits={3} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-unit">Unidade</Label>
              <Input id="item-unit" value={draft.unit ?? ""} onChange={(e) => set("unit", e.target.value.toUpperCase())} placeholder="UN" />
            </div>
            <div className="grid gap-2">
              <Label>Preço unit.</Label>
              <DecimalInput value={draft.unitPrice} onValueChange={(v) => set("unitPrice", v)} digits={4} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Total</Label>
              <DecimalInput
                value={draft.total}
                onValueChange={(v) => {
                  setAutoTotal(false);
                  setDraft((d) => ({ ...d, total: v }));
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>Desconto</Label>
              <DecimalInput value={draft.discount} onValueChange={(v) => set("discount", v)} />
            </div>
            <div className="grid gap-2">
              <Label>Impostos</Label>
              <DecimalInput value={draft.tax} onValueChange={(v) => set("tax", v)} />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {onDelete && !isNew ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => onDelete(draft.key)}>
                <Trash2 /> Remover
              </Button>
            ) : <span />}
            <Button type="submit" className="flex-1 sm:flex-none">Salvar item</Button>
          </DialogFooter>
        </form>
    </>
  );
}
