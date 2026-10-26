import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/" });

export const config = {
  // Só as páginas do app; login, /api e arquivos estáticos ficam livres.
  matcher: ["/painel/:path*", "/mes/:path*", "/lancamento/:path*", "/precos/:path*", "/categorias/:path*"],
};
