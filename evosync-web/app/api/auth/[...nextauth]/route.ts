/**
 * Handler do NextAuth — expõe os endpoints /api/auth/* gerados
 * automaticamente (signin, signout, callback, session, csrf, etc).
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
