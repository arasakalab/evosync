"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Eye,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/utils";

export default function MensagemPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const contacts = useAppStore((s) => s.contacts);

  const [template, setTemplate] = useState(settings.last_message || "");
  const [mediaPath, setMediaPath] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [previewText, setPreviewText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // mantém settings.last_message sincronizado ao montar
  useEffect(() => {
    setTemplate(settings.last_message || "");
  }, [settings.last_message]);

  const persistMessage = async (text: string) => {
    try {
      const next = { ...settings, last_message: text };
      const saved = await api.settings.save(next);
      setSettings(saved);
    } catch {
      /* silencioso */
    }
  };

  const onPreview = async () => {
    if (!contacts.length) {
      setPreviewText("(sem contatos — adicione ou importe um CSV)");
      return;
    }
    const c = contacts[0];
    const r = await api.message.preview(template, c);
    setPreviewText(`Pré-visualização para ${c.number}:\n\n${r.rendered}`);
  };

  const onPickMedia = (file: File) => {
    setUploading(true);
    api.upload
      .media(file)
      .then((r) => {
        setMediaPath(r.path);
        toast.success(`Mídia selecionada: ${r.name}`);
      })
      .catch((e) => toast.error(e?.message || "Falha no upload"))
      .finally(() => setUploading(false));
  };

  const onGenerateOpencode = async () => {
    if (!mediaPath) {
      toast.error("Selecione uma imagem ou PDF antes de gerar texto.");
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch(mediaPath);
      if (!r.ok) {
        // servidor não serve o arquivo; tenta puxar via upload novamente
      }
      // Pega o arquivo via input file novamente
      const f = fileInputRef.current?.files?.[0];
      if (!f) {
        toast.error("Selecione o arquivo novamente para o OpenCode.");
        return;
      }
      const res = await api.opencode.generate(f);
      if (!res.ok) {
        toast.error(res.error || "Falha ao gerar texto");
        return;
      }
      setTemplate(res.text || "");
      await persistMessage(res.text || "");
      setPreviewText("");
      toast.success("Texto gerado pelo OpenCode. Revise antes de disparar.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const mediaName = mediaPath ? mediaPath.split(/[\\/]/).pop() : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          Mensagem
        </h1>
        <p className="section-subtitle">
          Monte o texto, use campos do CSV como placeholders e anexe uma mídia opcional.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Texto da mensagem</CardTitle>
          <CardDescription>
            Use placeholders do CSV: {"{nome}"}, {"{empresa}"}, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            onBlur={() => persistMessage(template)}
            placeholder="Escreva sua mensagem aqui. Use {nome}, {empresa}..."
            className="min-h-[230px] text-sm leading-relaxed"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Mídia opcional
            <Badge variant="muted" className="font-normal">opcional</Badge>
          </CardTitle>
          <CardDescription>
            Imagem, vídeo ou PDF enviado junto com a mensagem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="media-path">Caminho do arquivo</Label>
              <Input
                id="media-path"
                value={mediaPath}
                onChange={(e) => setMediaPath(e.target.value)}
                placeholder="/caminho/para/imagem.jpg"
                className="font-mono"
              />
            </div>
            <div className="md:w-44">
              <Label>Tipo</Label>
              <Select value={mediaType} onValueChange={setMediaType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">image</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="document">document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickMedia(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="neutral"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                Escolher arquivo
              </Button>
            </div>
          </div>
          {mediaName && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <FileText className="h-4 w-4" />
              <span className="font-mono">{mediaName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMediaPath("")}
                className="h-6 px-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="blue" onClick={onPreview}>
              <Eye className="h-4 w-4" /> Pré-visualizar
            </Button>
            <Button
              variant="default"
              onClick={onGenerateOpencode}
              disabled={!mediaPath || generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              OpenCode IA
            </Button>
          </div>
        </CardContent>
      </Card>

      {previewText && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-[#0a1310] p-4 text-sm text-text/95 font-mono">
              {previewText}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-md border border-border bg-panel-alt/50 p-3 text-xs text-muted">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          O OpenCode IA envia a mídia para{" "}
          <code className="text-text/80">opencode run --file</code> e usa o modelo
          configurado em <strong>Conexão</strong> (ou{" "}
          <code className="text-text/80">nvidia/meta/llama-3.2-90b-vision-instruct</code>{" "}
          por padrão). Sempre revise o texto gerado antes de iniciar o disparo.
        </p>
      </div>
    </div>
  );
}
