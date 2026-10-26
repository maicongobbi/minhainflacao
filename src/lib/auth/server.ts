import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});

/** Usuário da sessão atual (ou null). */
export async function getSessionUser() {
  const { data } = await auth.getSession();
  const user = data?.user;
  return user ? { id: user.id, email: user.email ?? null } : null;
}
