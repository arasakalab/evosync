import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <FileQuestion className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-1">404</h1>
          <p className="text-sm text-slate-500 mb-5">
            A página que você procura não existe ou foi movida.
          </p>
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar ao início
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
