"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ClipboardPaste, ImageIcon, Images, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import type { ParsedNfce } from "@/lib/types";
import { readQrFromImage } from "@/lib/qr-from-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// O leitor usa a câmera, então só carrega no navegador.
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />,
});

// Resolução alta e foco contínuo ajudam com o QR denso da NFC-e.
const CAMERA: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
};

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
  const [tab, setTab] = useState("camera");
  const [loading, setLoading] = useState(false);
  const [pasted, setPasted] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

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

  async function importPhoto(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    try {
      const value = await readQrFromImage(file);
      if (!value) {
        toast.error("Não encontramos o QR code na foto. Tente aproximar e enquadrar só o QR.");
        setLoading(false);
        return;
      }
      setLoading(false);
      await importUrl(value);
    } catch {
      toast.error("Não foi possível abrir a foto.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar nota fiscal</DialogTitle>
          <DialogDescription>Leia o QR code da NFC-e pela câmera, por uma foto ou colando o link.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="camera"><ScanLine /> Câmera</TabsTrigger>
            <TabsTrigger value="photo"><Camera /> Foto</TabsTrigger>
            <TabsTrigger value="link"><ClipboardPaste /> Link</TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="mt-3 space-y-2">
            <div className="relative overflow-hidden rounded-xl bg-black">
              {open && tab === "camera" && !cameraError && (
                <Scanner
                  formats={["qr_code"]}
                  paused={loading}
                  constraints={CAMERA}
                  scanDelay={100}
                  components={{ finder: true, torch: true, zoom: true }}
                  onScan={(codes) => codes[0]?.rawValue && importUrl(codes[0].rawValue)}
                  onError={(e) => setCameraError(e.message || "Não foi possível abrir a câmera.")}
                  classNames={{ container: "aspect-square w-full" }}
                />
              )}
              {cameraError && (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/80">
                  <Camera className="size-8" />
                  Não foi possível usar a câmera. Verifique a permissão do navegador ou use a aba Foto.
                </div>
              )}
              {loading && <LoadingOverlay />}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Difícil de ler? Use a lanterna e o zoom, ou{" "}
              <button type="button" className="font-medium text-primary underline" onClick={() => setTab("photo")}>
                tire uma foto da nota
              </button>
              .
            </p>
          </TabsContent>

          <TabsContent value="photo" className="mt-3 space-y-3">
            <div className="relative flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
              <ImageIcon className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Abre a câmera do celular, que costuma focar melhor. Enquadre o QR code e tire a foto.
              </p>
              <Button className="w-full" size="lg" disabled={loading} onClick={() => photoInput.current?.click()}>
                <Camera /> Tirar foto da nota
              </Button>
              <Button variant="outline" className="w-full" disabled={loading} onClick={() => galleryInput.current?.click()}>
                <Images /> Escolher da galeria
              </Button>
              {loading && <LoadingOverlay rounded />}
            </div>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                importPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                importPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
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

function LoadingOverlay({ rounded }: { rounded?: boolean }) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm text-white ${rounded ? "rounded-xl" : ""}`}>
      <Loader2 className="size-8 animate-spin" />
      Lendo a nota...
    </div>
  );
}
