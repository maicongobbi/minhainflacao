"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StepperNav({ label, onPrev, onNext, nextDisabled }: { label: React.ReactNode; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
      <Button variant="ghost" size="icon" className="size-8" onClick={onPrev} aria-label="Anterior">
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium tabular-nums">{label}</span>
      <Button variant="ghost" size="icon" className="size-8" onClick={onNext} disabled={nextDisabled} aria-label="Próximo">
        <ChevronRight />
      </Button>
    </div>
  );
}
