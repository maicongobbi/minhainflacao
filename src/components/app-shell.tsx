"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { CalendarDays, LayoutDashboard, LogOut, Moon, Plus, Sun, Tags, TrendingUp } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { useDb } from "@/lib/db-client";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { DEFAULT_STORE_RULES, normalizeName } from "@/lib/store-rules";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

function currentMonthHref() {
  const d = new Date();
  return `/mes/${d.getFullYear()}/${d.getMonth() + 1}`;
}

const NAV = [
  { href: "/painel", match: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: currentMonthHref, match: "/mes", label: "Meses", icon: CalendarDays },
  { href: "/precos", match: "/precos", label: "Preços", icon: TrendingUp },
  { href: "/categorias", match: "/categorias", label: "Tipos", icon: Tags },
] as const;

const resolve = (h: string | (() => string)) => (typeof h === "function" ? h() : h);

/**
 * Na primeira vez que o usuário entra: cria os tipos de gasto padrão e, depois,
 * os vínculos automáticos de estabelecimentos (também para contas antigas).
 */
function useSeedDefaults(enabled: boolean) {
  const db = useDb();
  const categories = db.category.useFindMany({ select: { id: true, name: true } }, { enabled });
  const rules = db.storeRule.useCount({}, { enabled });
  const createCategories = db.category.useCreateMany();
  const createRules = db.storeRule.useCreateMany();
  const done = useRef({ categories: false, rules: false });

  useEffect(() => {
    if (!enabled || !categories.isSuccess) return;
    if (categories.data.length === 0) {
      if (done.current.categories) return;
      done.current.categories = true;
      createCategories.mutate({ data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i })), skipDuplicates: true });
      return;
    }
    if (!rules.isSuccess || rules.data !== 0 || done.current.rules) return;
    done.current.rules = true;
    const byName = new Map(categories.data.map((c) => [normalizeName(c.name), c.id]));
    const data = DEFAULT_STORE_RULES.flatMap((r) => {
      const categoryId = byName.get(normalizeName(r.category));
      return categoryId ? [{ pattern: r.pattern, match: "contains", categoryId, subcategory: r.subcategory }] : [];
    });
    if (data.length) createRules.mutate({ data, skipDuplicates: true });
  }, [enabled, categories.isSuccess, categories.data, rules.isSuccess, rules.data, createCategories, createRules]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const user = session?.user;

  useEffect(() => {
    if (!isPending && !user) router.replace("/");
  }, [isPending, user, router]);
  useSeedDefaults(!!user);

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/painel" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="size-4" />
            </span>
            <span>Minha Inflação</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={resolve(n.href)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  pathname.startsWith(n.match) && "bg-accent text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/lancamento/novo">
                <Plus /> Novo lançamento
              </Link>
            </Button>
            {isPending ? (
              <Skeleton className="size-8 rounded-full" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="size-8">
                    <AvatarImage src={user?.image ?? undefined} alt="" />
                    <AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="truncate text-sm font-medium">{user?.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                    {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                    Tema {resolvedTheme === "dark" ? "claro" : "escuro"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={signOut}>
                    <LogOut /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pt-8 md:pb-12">
        {user ? children : <PageSkeleton />}
      </main>

      {/* Barra inferior no celular */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-5 items-center">
          {NAV.slice(0, 2).map((n) => (
            <BottomItem key={n.label} {...n} href={resolve(n.href)} active={pathname.startsWith(n.match)} />
          ))}
          <div className="flex justify-center">
            <Link
              href="/lancamento/novo"
              aria-label="Novo lançamento"
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
            >
              <Plus className="size-6" />
            </Link>
          </div>
          {NAV.slice(2).map((n) => (
            <BottomItem key={n.label} {...n} href={resolve(n.href)} active={pathname.startsWith(n.match)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function BottomItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Plus; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 text-[11px] font-medium text-muted-foreground",
        active && "text-primary",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
