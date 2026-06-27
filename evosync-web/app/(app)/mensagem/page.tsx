"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Eye,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MediaAttachmentField,
  type MediaType,
} from "@/components/media-attachment-field";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

export default function MensagemPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const contacts = useAppStore((s) => s.contacts);

  const [template, setTemplate] = useState(settings.last_message || "");
  const [mediaPath, setMediaPath] = useState(settings.last_media_path || "");
  const [mediaType, setMediaType] = useState<MediaType>(
    (settings.last_media_type as MediaType) || "image"
  );
  const [previewText, setPreviewText] = useState("");
  const [generating, setGenerating] = useState(false);
  const lastFileRef = useRef<File | null>(null);

  useEffect(() => {
    setTemplate(settings.last_message || "");
    setMediaPath(settings.last_media_path || "");
    setMediaType((settings.last_media_type as MediaType) || "image");
  }, [
    settings.last_message,
    settings.last_media_path,
    settings.last_media_type,
  ]);

  const persistSettings = async (patch: {
    last_message?: string;
    last_media_path?: string;
    last_media_type?: string;
  }) => {
    try {
      const next = { ...settings, ...patch };
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

  const onMediaPathChange = (path: string) => {
    setMediaPath(path);
    if (!path) lastFileRef.current = null;
    void persistSettings({ last_media_path: path });
  };

  const onMediaTypeChange = (type: MediaType) => {
    setMediaType(type);
    void persistSettings({ last_media_type: type });
  };

  const onGenerateOpencode = async () => {
    if (!mediaPath) {
      toast.error("Selecione uma imagem ou PDF antes de gerar texto.");
      return;
    }
    setGenerating(true);
    try {
      const f = lastFileRef.current;
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
      await persistSettings({ last_message: res.text || "" });
      setPreviewText("");
      toast.success("Texto gerado pelo OpenCode. Revise antes de disparar.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar");
    } finally {
      setGenerating(false);
    }
  };

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
            onBlur={() => persistSettings({ last_message: template })}
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
            Imagem, vídeo ou PDF enviado junto com a mensagem no Disparo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <MediaAttachmentField
            mediaPath={mediaPath}
            mediaType={mediaType}
            onMediaPathChange={onMediaPathChange}
            onMediaTypeChange={onMediaTypeChange}
            onFileSelected={(file) => {
              lastFileRef.current = file;
            }}
          />

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
          A mídia selecionada aqui é usada automaticamente na aba{" "}
          <strong>Disparo</strong>. O OpenCode IA envia o arquivo para{" "}
          <code className="text-text/80">opencode run --file</code> e usa o
          modelo configurado em <strong>Conexão</strong>.
        </p>
      </div>
    </div>
  );
}
