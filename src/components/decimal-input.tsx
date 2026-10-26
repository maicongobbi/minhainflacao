"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { parseDecimal } from "@/lib/format";

/** Campo numérico que aceita vírgula (padrão brasileiro). */
export function DecimalInput({
  value,
  onValueChange,
  digits = 2,
  prefix,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number;
  onValueChange: (v: number) => void;
  digits?: number;
  prefix?: string;
}) {
  const fmt = (v: number) => (v ? v.toLocaleString("pt-BR", { maximumFractionDigits: digits }) : "");
  // Enquanto digita, mostra o texto livre; fora do foco, o valor formatado.
  const [text, setText] = useState<string | null>(null);

  const input = (
    <Input
      {...props}
      inputMode="decimal"
      value={text ?? fmt(value)}
      onFocus={(e) => {
        setText(fmt(value));
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setText(null);
        props.onBlur?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        onValueChange(parseDecimal(e.target.value));
      }}
      className={prefix ? `pl-9 ${props.className ?? ""}` : props.className}
    />
  );
  if (!prefix) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
      {input}
    </div>
  );
}
