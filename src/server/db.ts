import "server-only";
import { ZenStackClient } from "@zenstackhq/orm";
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres";
import { PolicyPlugin } from "@zenstackhq/plugin-policy";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { schema } from "@zenstack/schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

// Um pool por instância; na Vercel (Fluid Compute) o pool é reaproveitado entre requisições.
const pool =
  globalForDb.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;
attachDatabasePool(pool);

/** Cliente sem regras de acesso. Use só em código de servidor confiável. */
export const rawDb = new ZenStackClient(schema, {
  dialect: new PostgresDialect({ pool }),
});

/** Cliente com as regras de acesso do schema (@@allow/@@deny). */
export const policyDb = rawDb.$use(new PolicyPlugin());

export function dbFor(user: { id: string; email?: string | null } | null) {
  return policyDb.$setAuth(user ?? undefined);
}
