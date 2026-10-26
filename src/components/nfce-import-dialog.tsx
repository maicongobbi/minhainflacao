"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ClipboardPaste, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ParsedNfce } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// O leitor usa a câmera, então só carrega no navegador.
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />,
});

export function NfceImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (nfce: ParsedNfce, url: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pasted, setPasted] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function importUrl(raw: string) {
    if (loading || !raw.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/nfce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw.trim() }),
      });
      const json = await res.json();
      if (res.status === 409 && json.existingId) {
        toast.info("Essa nota já foi importada.", {
          action: { label: "Abrir", onClick: () => router.push(`/lancamento/${json.existingId}`) },
        });
        onOpenChange(false);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Não foi possível ler a nota.");
      onImported(json.nfce as ParsedNfce, json.url as string);
      toast.success(`${json.nfce.items.length} itens importados de ${json.nfce.store}`);
      onOpenChange(false);
      setPasted("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a nota.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar nota fiscal</DialogTitle>
          <DialogDescription>Aponte a câmera para o QR code da NFC-e ou cole o link do QR code.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="camera">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera"><Camera /> Câmera</TabsTrigger>
            <TabsTrigger value="link"><ClipboardPaste /> Colar link</TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="mt-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              {open && !cameraError && (
                <Scanner
                  formats={["qr_code"]}
                  paused={loading}
                  constraints={{ facingMode: "environment" }}
                  onScan={(codes) => codes[0]?.rawValue && importUrl(codes[0].rawValue)}
                  onError={(e) => setCameraError(e.message || "Não foi possível abrir a câmera.")}
                  classNames={{ container: "aspect-square w-full" }}
                />
              )}
              {cameraError && (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/80">
                  <Camera className="size-8" />
                  Não foi possível usar a câmera. Verifique a permissão do navegador ou cole o link na outra aba.
                </div>
              )}
              {loading && <LoadingOverlay />}
            </div>
          </TabsContent>

          <TabsContent value="link" className="mt-3 space-y-3">
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://www.dfe.ms.gov.br/nfce/qrcode/?p=..."
              rows={4}
              className="font-mono text-xs"
            />
            <Button className="w-full" onClick={() => importUrl(pasted)} disabled={loading || !pasted.trim()}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? "Consultando a SEFAZ..." : "Importar nota"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm text-white">
      <Loader2 className="size-8 animate-spin" />
      Consultando a SEFAZ...
    </div>
  );
}
