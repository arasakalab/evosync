import { Suspense } from "react";
import InviteAcceptForm from "./form";

export const dynamic = "force-dynamic";

export default function InvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <div className="text-center text-sm text-slate-500">Carregando…</div>
          }
        >
          <InviteAcceptForm />
        </Suspense>
      </div>
    </div>
  );
}
