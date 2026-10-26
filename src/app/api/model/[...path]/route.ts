import { NextRequestHandler } from "@zenstackhq/server/next";
import { RPCApiHandler } from "@zenstackhq/server/api";
import { getSessionUser } from "@/lib/auth/server";
import { dbFor } from "@/server/db";
import { schema } from "@zenstack/schema";

// API CRUD automática do ZenStack. Cada requisição usa o usuário da sessão,
// e as regras do schema garantem que ninguém veja dados de outra pessoa.
const handler = NextRequestHandler({
  apiHandler: new RPCApiHandler({ schema }),
  getClient: async () => dbFor(await getSessionUser()),
  useAppDir: true,
});

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
