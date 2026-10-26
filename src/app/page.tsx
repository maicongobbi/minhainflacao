"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, QrCode, TrendingUp, Wallet } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) router.replace("/painel");
  }, [session, router]);

  async function signIn() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/painel" });
    if (error) {
      setError(error.message ?? "Não foi possível entrar com o Google.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary/15 to-transparent" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <TrendingUp className="size-7" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Minha Inflação</h1>
          <p className="mt-2 text-muted-foreground">
            Lance seus gastos do mês, importe notas fiscais pelo QR code e veja quanto os seus preços sobem.
          </p>
        </div>

        <ul className="mb-8 space-y-3 text-sm">
          {[
            { icon: Wallet, text: "Gastos por tipo: alimentação, casa, automóvel, lazer..." },
            { icon: QrCode, text: "Leia o QR code da NFC-e e os itens entram sozinhos" },
            { icon: BarChart3, text: "Painel do ano, mês a mês, com descontos e impostos" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <Icon className="size-5 shrink-0 text-primary" />
              {text}
            </li>
          ))}
        </ul>

        <Button size="lg" className="h-12 w-full text-base" onClick={signIn} disabled={loading || isPending}>
          <GoogleIcon />
          {loading ? "Abrindo o Google..." : "Entrar com Google"}
        </Button>
        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M21.8 10.2H21V10h-9v4h5.7A6 6 0 1 1 16 7.4l2.8-2.8A10 10 0 1 0 22 12c0-.6 0-1.2-.2-1.8Z" />
      <path fill="#FF3D00" d="m3.2 7.3 3.3 2.4A6 6 0 0 1 16 7.4l2.8-2.8A10 10 0 0 0 3.2 7.3Z" />
      <path fill="#4CAF50" d="M12 22a10 10 0 0 0 6.7-2.6l-3.1-2.6A6 6 0 0 1 6.3 14l-3.3 2.5A10 10 0 0 0 12 22Z" />
      <path fill="#1976D2" d="M21.8 10.2H21V10h-9v4h5.7a6 6 0 0 1-2 2.8l3.1 2.6C18.6 19.6 22 17 22 12c0-.6 0-1.2-.2-1.8Z" />
    </svg>
  );
}
