import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/server/store/tenants";
import { SignupForm } from "./form";
import NotFound from "./not-found";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cadastre-se no WhatsApp",
  description:
    "Cadastre seu nome e WhatsApp para receber mensagens e novidades direto no seu celular.",
};

interface PageProps {
  params: { slug: string };
}

export default function SignupPage({ params }: PageProps) {
  const tenant = getTenantBySlug(params.slug);
  if (!tenant || tenant.status !== "active") {
    return <NotFound slug={params.slug} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-md">
        <SignupForm tenantName={tenant.name} slug={params.slug} />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold">EvoSync</span>
        </p>
      </div>
    </div>
  );
}
