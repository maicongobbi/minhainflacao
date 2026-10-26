import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // O shell lê a URL e a sessão, que só existem no navegador/requisição.
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 pt-20"><PageSkeleton /></div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
