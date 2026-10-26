import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({ label, value, hint, tone, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "up" | "down" | "neutral"; icon?: React.ReactNode }) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        {icon}
      </div>
      <div className="truncate text-xl font-semibold tabular-nums md:text-2xl">{value}</div>
      {hint && (
        <div
          className={cn(
            "text-xs text-muted-foreground",
            tone === "up" && "text-red-600 dark:text-red-400",
            tone === "down" && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {hint}
        </div>
      )}
    </Card>
  );
}
