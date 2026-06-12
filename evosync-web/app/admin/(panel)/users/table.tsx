"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, Shield, Mail } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.tenantName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="relative max-w-sm p-4 pb-0">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por email, nome ou tenant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto pt-2">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Usuário</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tenant</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Role</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Criado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-b last:border-0 border-slate-100 dark:border-slate-800"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                      {u.role === "super_admin" ? (
                        <Shield className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{u.name || "—"}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {u.tenantName ? (
                    <>
                      <div>{u.tenantName}</div>
                      <div className="text-xs text-slate-500">{u.tenantSlug}</div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={
                      u.role === "super_admin"
                        ? "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300"
                        : ""
                    }
                  >
                    {u.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      u.status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }
                  >
                    {u.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
