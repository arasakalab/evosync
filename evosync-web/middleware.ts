/**
 * Middleware global.
 *
 * Responsabilidades:
 *  1. Auth: protege /admin/* (exceto /admin/login) via NextAuth
 *  2. Pathname: adiciona header `x-pathname` em todas as requests
 *     pra que server components (layouts) saibam a URL atual sem
 *     precisar de usePathname() (que é client-side).
 *
 * Edge runtime — NÃO importa better-sqlite3 nem nada que use node:*.
 * Lógica de checagem mais pesada (managed connection, license) fica
 * no (app)/layout.tsx que roda no Node runtime.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Adiciona x-pathname em todas as responses pra que layouts server
  // components possam saber a URL atual
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);

  // authorized() callback em authConfig já fez a lógica de /admin/*
  // Se chegou aqui e a request falhou no authorized, NextAuth redireciona
  // automaticamente. Caso contrário, só repassa com o header extra.
  return res;
});

export const config = {
  // Match tudo que NÃO é:
  //  - /api/* (rotas da API fazem seu próprio auth)
  //  - /_next/static, /_next/image (assets)
  //  - arquivos com extensão (.png, .ico, .css, .js, etc)
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
