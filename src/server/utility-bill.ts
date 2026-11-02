import "server-only";
import * as cheerio from "cheerio";
import type { ParsedNfce } from "@/lib/types";
import { parseDecimal } from "@/lib/format";
import { NfceError } from "@/server/nfce";

/**
 * Contas de consumo com nota fiscal eletrônica:
 * - NF3e (energia, modelo 66): QR com ?chNF3e=<chave>&tpAmb=1
 * - NFAg (água e saneamento, modelo 75): QR com ?chNFAg=<chave>&tpAmb=1
 * As duas consultas públicas usam o mesmo layout (XSLT da SVRS).
 */
type Kind = "energia" | "agua";

const KEY_PARAMS: Record<Kind, string> = { energia: "chNF3e", agua: "chNFAg" };

function param(url: URL, name: string) {
  for (const [k, v] of url.searchParams) if (k.toLowerCase() === name.toLowerCase()) return v;
  return null;
}

export function utilityBillKind(url: URL): Kind | null {
  if (param(url, "chNF3e") || /\/nf3e\//i.test(url.pathname)) return "energia";
  if (param(url, "chNFAg") || /\/nfag\//i.test(url.pathname)) return "agua";
  return null;
}

export function utilityBillKey(url: URL): string | null {
  const kind = utilityBillKind(url);
  return kind ? (param(url, KEY_PARAMS[kind]) ?? "").match(/\d{44}/)?.[0] ?? null : null;
}

/** Empresas conhecidas pelo CNPJ (a consulta da NF3e no MS não mostra o nome do emitente). */
const COMPANIES: Record<string, string> = {
  "15413826000150": "ENERGISA MATO GROSSO DO SUL",
  "04089570000150": "AGUAS GUARIROBA S.A.",
};

/**
 * A consulta pública esconde a descrição dos itens ("C...", "V..."), então o nome
 * vem do código de classificação (cClass) da NF3e, ou da unidade e da inicial na NFAg.
 * Na NF3e, o grupo 560 é energia injetada (crédito da geração solar).
 */
function itemName(kind: Kind, cClass: string, desc: string, unit: string): string {
  const initial = desc.replace(/\.{3}$/, "").trim();
  if (initial.length > 3) return initial; // descrição completa disponível
  if (kind === "energia") {
    if (cClass.startsWith("0601")) return "Consumo de energia";
    if (cClass.startsWith("0611")) return "Energia reativa excedente";
    if (cClass.startsWith("064")) return "Adicional de bandeira tarifária";
    if (cClass.startsWith("080")) return "Contribuição de iluminação pública";
    if (cClass.startsWith("560")) return "Energia injetada (compensação)";
  } else {
    const letter = initial.charAt(0).toUpperCase();
    if (unit === "M3" && letter === "V") return "Consumo de água";
    if (unit === "M3" && letter === "E") return "Esgoto";
    if (letter === "T") return "Tarifa fixa";
  }
  return `Item ${cClass}${initial ? ` (${initial}...)` : ""}`;
}
const isCredit = (kind: Kind, cClass: string) => kind === "energia" && cClass.startsWith("560");
const isConsumption = (cClass: string) => cClass.startsWith("06");

const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36";

async function get(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new NfceError(`O portal da SEFAZ respondeu com erro (${res.status}).`, 502);
  return res;
}

/** Busca o HTML com os dados da conta, conforme o portal. */
async function fetchHtml(url: URL, kind: Kind, key: string): Promise<string> {
  const tpAmb = param(url, "tpAmb") ?? "1";

  // MS (NF3e): a página é um app Angular; os dados vêm desta API pública, a mesma que a página usa.
  if (kind === "energia" && /(^|\.)dfe\.ms\.gov\.br$/i.test(url.hostname)) {
    const json = await (await get(`https://www.dfe.ms.gov.br/d0712/api/publica/${key}/${encodeURIComponent(tpAmb)}/2`, {
      headers: { Accept: "application/json" },
    })).json();
    const row = json?.data?.data?.[0];
    if (!row?.html) throw new NfceError(json?.data?.status?.message || "Conta não encontrada na SEFAZ.");
    return row.html;
  }

  // SVRS e outros: a página do QR devolve um formulário que se envia sozinho (POST). Repetimos esse envio.
  const html = await (await get(url.toString(), { headers: { Accept: "text/html" } })).text();
  const $ = cheerio.load(html);
  const form = $("form").first();
  if (!form.length || $("#produtos").length) return html;
  const action = new URL(form.attr("action") || url.pathname, url);
  if (!/(^|\.)gov\.br$/i.test(action.hostname)) throw new NfceError("O portal redirecionou para um endereço inesperado.", 502);
  const body = new URLSearchParams();
  form.find("input[name]").each((_, el) => {
    body.append($(el).attr("name")!, $(el).attr("value") ?? "");
  });
  return (await get(action.toString(), {
    method: (form.attr("method") || "post").toUpperCase(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body,
  })).text();
}

export async function fetchUtilityBill(url: URL): Promise<ParsedNfce> {
  const kind = utilityBillKind(url)!;
  const key = utilityBillKey(url);
  if (!key) throw new NfceError("O QR code da conta não tem a chave de acesso.", 400);

  let html: string;
  try {
    html = await fetchHtml(url, kind, key);
  } catch (e) {
    if (e instanceof NfceError) throw e;
    throw new NfceError("Não foi possível acessar o portal da SEFAZ. Tente novamente em instantes.", 502);
  }

  const parsed = parseUtilityBillHtml(html, kind, key);
  if (parsed.items.length === 0) {
    throw new NfceError("Não encontramos os itens desta conta. O portal deste estado pode usar outro formato.");
  }
  return parsed;
}

export function parseUtilityBillHtml(html: string, kind: Kind, key: string): ParsedNfce {
  const $ = cheerio.load(html);

  // Tabelas de cabeçalho: cada <th> com o <td> da mesma coluna (primeira ocorrência: dados da nota e emitente).
  const fields = new Map<string, string>();
  $("table").not("#produtos table").each((_, table) => {
    const heads = $(table).find("thead tr").first().find("th").map((_, th) => clean($(th).text())).get();
    const cells = $(table).find("tbody tr").first().find("td").map((_, td) => clean($(td).text())).get();
    heads.forEach((h, i) => {
      if (cells[i] !== undefined && !fields.has(h)) fields.set(h, cells[i]);
    });
  });

  const charges: ParsedNfce["items"] = [];
  let credit = 0;
  $("#produtos tbody tr").each((_, tr) => {
    const td = $(tr).find("td").map((_, el) => clean($(el).text())).get();
    if (td.length < 7) return;
    // NF3e: item, classificação, descrição, unidade, qtd, unitário, total
    // NFAg: item, classificação, código, descrição, unidade, qtd, unitário, total
    const [unitRaw, qty, unitPrice, total] = td.slice(-4);
    const cClass = td[1];
    const desc = td[td.length - 5];
    const code = td.length >= 8 ? td[2] : cClass;
    const value = parseDecimal(total);
    if (isCredit(kind, cClass)) {
      credit += value;
      return;
    }
    const unitName = unitRaw.replace(/^\d+\s*-\s*/, "").trim();
    const unit = /^kwh$/i.test(unitName) ? "KWH" : /^m3$/i.test(unitName) ? "M3" : /^[a-z]{1,4}$/i.test(unitName) ? unitName.toUpperCase() : "UND";
    charges.push({
      description: itemName(kind, cClass, desc, unit),
      code: kind === "agua" ? `${cClass}-${code}` : code,
      quantity: parseDecimal(qty) || 1,
      unit,
      unitPrice: parseDecimal(unitPrice) || value,
      total: value,
      discount: 0,
    });
  });

  // O crédito da energia injetada abate primeiro do consumo, depois dos demais itens.
  const order = [...charges.keys()].sort(
    (a, b) => Number(isConsumption(charges[b].code ?? "")) - Number(isConsumption(charges[a].code ?? "")),
  );
  let left = round2(credit);
  for (const i of order) {
    if (left <= 0) break;
    const d = round2(Math.min(left, charges[i].total));
    charges[i].discount = d;
    left = round2(left - d);
  }

  const em = (fields.get("Data/Hora da emissão") ?? "").match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:\d{2})?/,
  );
  // Sem fuso na página: horário de Mato Grosso do Sul (-04:00) quando a chave é do MS, senão Brasília.
  const tz = em?.[7] ?? (key.startsWith("50") ? "-04:00" : "-03:00");
  const issuedAt = em ? `${em[3]}-${em[2]}-${em[1]}T${em[4]}:${em[5]}:${em[6] ?? "00"}${tz}` : null;

  const cnpjDigits = key.slice(6, 20);
  const cnpj = fields.get("CNPJ") || cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const label = kind === "energia" ? "Energia elétrica" : "Água e esgoto";
  const store = fields.get("Razão Social") || COMPANIES[cnpjDigits] || `${label} (CNPJ ${cnpj})`;

  const amount = round2(charges.reduce((s, c) => s + c.total, 0));
  const discount = round2(Math.min(credit, amount));
  const city = fields.get("Município");

  return {
    store,
    description: kind === "energia" ? "Conta de energia" : "Conta de água",
    cnpj,
    address: city ? city.toUpperCase() : null,
    key,
    number: fields.get("Número") ?? null,
    series: fields.get("Série") ?? null,
    issuedAt,
    amount,
    discount,
    total: round2(amount - discount),
    tax: 0,
    payments: [],
    items: charges,
  };
}
