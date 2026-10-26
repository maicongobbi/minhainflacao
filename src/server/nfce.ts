import "server-only";
import * as cheerio from "cheerio";
import type { ParsedNfce } from "@/lib/types";
import { parseDecimal } from "@/lib/format";

/**
 * Aceita apenas URLs de portais da SEFAZ (*.gov.br). Isso evita que a API
 * seja usada para buscar endereços arbitrários a partir do servidor.
 */
export function validateNfceUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new NfceError("O QR code não contém um endereço válido.", 400);
  }
  if (!["http:", "https:"].includes(url.protocol) || !/(^|\.)gov\.br$/i.test(url.hostname)) {
    throw new NfceError("Esse QR code não é de uma NFC-e (o endereço precisa ser de uma SEFAZ .gov.br).", 400);
  }
  return url;
}

export class NfceError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

export async function fetchNfce(url: URL): Promise<ParsedNfce> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new NfceError("Não foi possível acessar o portal da SEFAZ. Tente novamente em instantes.", 502);
  }
  if (!res.ok) throw new NfceError(`O portal da SEFAZ respondeu com erro (${res.status}).`, 502);
  if (!/(^|\.)gov\.br$/i.test(new URL(res.url).hostname)) {
    throw new NfceError("O portal redirecionou para um endereço inesperado.", 502);
  }

  const parsed = parseNfceHtml(await res.text());
  if (!parsed.key) parsed.key = keyFromUrl(url);
  if (parsed.items.length === 0) {
    throw new NfceError(
      "Não encontramos os itens nesta nota. O portal deste estado pode usar outro formato, ou a nota ainda não foi processada.",
    );
  }
  return parsed;
}

/** A chave de acesso (44 dígitos) é o início do parâmetro `p` do QR code. */
export function keyFromUrl(url: URL): string | null {
  const p = url.searchParams.get("p") ?? url.searchParams.get("chNFe") ?? "";
  const m = p.match(/\d{44}/);
  return m ? m[0] : null;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
/** Remove o rótulo ("Qtde.:", "UN:") do texto de um campo. */
const afterLabel = (s: string) => clean(s.replace(/^[^:]*:/, ""));

/** Lê o layout padrão de consulta da NFC-e (usado por MS, RS e vários outros estados). */
export function parseNfceHtml(html: string): ParsedNfce {
  const $ = cheerio.load(html);

  const items: ParsedNfce["items"] = [];
  $("#tabResult tr").each((_, tr) => {
    const row = $(tr);
    const description = clean(row.find(".txtTit").first().text());
    if (!description) return;
    const codeText = clean(row.find(".RCod").text());
    const code = codeText.match(/[\w.-]+(?=\s*\)?\s*$)/)?.[0] ?? null;
    const quantity = parseDecimal(afterLabel(row.find(".Rqtd").text()));
    // Unidades vêm como "UND9", "KG9": o número final não faz parte da unidade.
    const unit = afterLabel(row.find(".RUN").text()).replace(/\d+$/, "") || null;
    const unitPrice = parseDecimal(afterLabel(row.find(".RvlUnit").text()));
    const total = parseDecimal(row.find(".valor").text());
    items.push({ description, code, quantity: quantity || 1, unit, unitPrice, total });
  });

  // Totais: cada linha tem um <label> e um <span class="totalNumb">
  const totals: { label: string; value: number }[] = [];
  $("#totalNota #linhaTotal, #totalNota [id=linhaTotal]").each((_, el) => {
    const label = clean($(el).find("label").text());
    const value = parseDecimal($(el).find(".totalNumb").last().text());
    if (label) totals.push({ label, value });
  });
  const find = (re: RegExp) => totals.find((t) => re.test(t.label));

  const itemsSum = items.reduce((s, i) => s + i.total, 0);
  const amount = find(/valor total/i)?.value ?? itemsSum;
  const discount = find(/desconto/i)?.value ?? 0;
  const total = find(/valor a pagar/i)?.value ?? amount - discount;
  const tax = find(/tributo/i)?.value ?? 0;

  // Formas de pagamento ficam depois de "Forma de pagamento", com label.tx
  const payments: ParsedNfce["payments"] = [];
  $("#totalNota [id=linhaTotal]").each((_, el) => {
    const label = $(el).find("label.tx");
    if (label.length) {
      payments.push({
        method: clean(label.text()),
        amount: parseDecimal($(el).find(".totalNumb").text()),
      });
    }
  });

  const store = clean($(".txtTopo").first().text());
  const headerTexts = $(".txtCenter .text")
    .map((_, el) => clean($(el).text()))
    .get();
  const cnpj = headerTexts.find((t) => /CNPJ/i.test(t))?.replace(/^.*?CNPJ:?\s*/i, "") ?? null;
  const address =
    headerTexts
      .find((t) => !/CNPJ/i.test(t))
      ?.split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .join(", ") ?? null;

  const info = clean($("#infos").text());
  const em = info.match(/Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/i);
  // Horário de Brasília (-03:00)
  const issuedAt = em ? `${em[3]}-${em[2]}-${em[1]}T${em[4]}:${em[5]}:${em[6] ?? "00"}-03:00` : null;
  const number = info.match(/N[úu]mero:\s*(\d+)/i)?.[1] ?? null;
  const series = info.match(/S[ée]rie:\s*(\d+)/i)?.[1] ?? null;
  const key = $(".chave").first().text().replace(/\D/g, "") || info.match(/(\d{4}\s?){11}/)?.[0].replace(/\D/g, "") || null;

  return {
    store: store || "Estabelecimento",
    cnpj,
    address,
    key: key && key.length === 44 ? key : null,
    number,
    series,
    issuedAt,
    amount,
    discount,
    total,
    tax,
    payments,
    items,
  };
}
