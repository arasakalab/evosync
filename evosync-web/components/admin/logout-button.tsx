"use client";

import { signOut } from "next-auth/react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        setLoading(true);
        await signOut({ callbackUrl: "/admin/login" });
      }}
      disabled={loading}
      className="text-muted hover:text-text"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sair
    </Button>
  );
}
