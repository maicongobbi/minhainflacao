export type Payment = { method: string; amount: number };

/** Resposta da API /api/nfce */
export type ParsedNfce = {
  store: string;
  /** Descrição sugerida para o lançamento (ex.: "Conta de energia"). */
  description?: string;
  cnpj: string | null;
  address: string | null;
  key: string | null;
  number: string | null;
  series: string | null;
  issuedAt: string | null;
  amount: number;
  discount: number;
  total: number;
  tax: number;
  payments: Payment[];
  items: {
    description: string;
    code: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    total: number;
    /** Desconto já atribuído ao item (ex.: crédito de energia solar). */
    discount?: number;
  }[];
};

/** Item no formulário de lançamento. */
export type ItemDraft = {
  key: string;
  description: string;
  code: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  discount: number;
  tax: number;
};
