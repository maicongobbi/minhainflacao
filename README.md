# Minha Inflação

Controle de gastos mensais com importação de NFC-e pelo QR code e acompanhamento da sua inflação pessoal (variação de preço dos itens que você compra).

## Stack

- **Next.js 16** (App Router), React 19, Tailwind CSS 4, **shadcn/ui**, Recharts
- **ZenStack v3**: schema em `zenstack/schema.zmodel`, com regras de acesso por usuário (`@@allow`) e API CRUD automática em `/api/model`, consumida no front por hooks TanStack Query
- **Neon**: Postgres (região São Paulo) + **Neon Auth** (Better Auth gerenciado) com login Google
- Deploy na **Vercel**

## Como funciona

- `/`: login com Google
- `/painel`: total do ano, média mensal, gasto por mês e por tipo
- `/mes/[ano]/[mes]`: lançamentos do mês, agrupados por tipo
- `/lancamento/novo`: lançamento manual (só o valor, ou item a item) ou importação da nota pelo QR code
- `/precos`: variação de preço de cada item entre a primeira e a última compra, e a sua inflação ponderada
- `/categorias`: tipos de gasto e subtipos (ex.: Casa → Água, Luz, Telefone)

A importação da nota (`/api/nfce`) aceita só URLs `*.gov.br`, consulta o portal da SEFAZ no servidor e lê itens, descontos, tributos, CNPJ e data. Foi testada com o portal do MS, que usa o layout padrão adotado por vários estados. Portais com layout diferente (por exemplo, SP) podem precisar de um parser próprio em `src/server/nfce.ts`.

Segurança: todas as tabelas têm `userId` preenchido automaticamente com o usuário logado. As regras do ZenStack impedem ler ou alterar dados de outra pessoa, e também impedem usar o tipo de gasto de outro usuário.

## Rodando localmente

```bash
npm install
neon env pull                              # pasta ligada à branch dev do Neon
echo "NEON_AUTH_COOKIE_SECRET=$(openssl rand -base64 32)" >> .env.local
npm run dev
```

## Banco de dados

```bash
# depois de mudar zenstack/schema.zmodel:
npm run db:generate                 # gera zenstack/schema.ts e schema-lite.ts
npm run db:migrate -- --name <nome> # cria e aplica a migração (usa DATABASE_URL_UNPOOLED)
npm run db:deploy                   # aplica as migrações pendentes (produção)
```

## Ambientes e deploy

| Git | Vercel | Banco Neon |
| --- | --- | --- |
| `dev` (branch padrão, onde se trabalha) | Preview: https://minhainflacao-git-dev-maicongobbis-projects.vercel.app | branch `dev` |
| `prd` (publicação) | Produção: https://minhainflacao-mu.vercel.app | branch `production` |
| local (`npm run dev`) | — | branch `dev` (via `.env.local`) |

Para publicar, leve a `dev` para a `prd`:

```bash
git checkout prd && git merge --ff-only dev && git push && git checkout dev
```

- O script `vercel-build` roda `zen migrate deploy` antes do build, então cada ambiente aplica as próprias migrações pendentes no seu banco.
- As variáveis de Produção vêm da integração Neon ↔ Vercel, mais o `NEON_AUTH_COOKIE_SECRET`. As de Preview estão restritas à branch `dev` e apontam para o banco dev.
- Os domínios precisam estar liberados no Neon Auth de cada branch (`neon neon-auth domain add <url> --branch <dev|production>`).
- **Antes de abrir para outras pessoas:** o login Google usa credenciais compartilhadas do Neon, que servem só para desenvolvimento e mostram a marca do Neon na tela de consentimento. Crie um OAuth Client no Google Cloud com o redirect `{NEON_AUTH_BASE_URL}/callback/google` e cadastre-o com `neon neon-auth oauth-provider update --branch production`.
