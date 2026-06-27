"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Eye, Info } from "lucide-react";

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
import { OPENCODE_IA_ENABLED } from "@/lib/feature-flags";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { mediaFileName, mediaPreviewUrl } from "@/lib/utils";

export default function MensagemPage() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const contacts = useAppStore((s) => s.contacts);
  const selectedIds = useAppStore((s) => s.selectedIds);

  const [template, setTemplate] = useState(settings.last_message || "");
  const [mediaPath, setMediaPath] = useState(settings.last_media_path || "");
  const [mediaType, setMediaType] = useState<MediaType>(
    (settings.last_media_type as MediaType) || "image"
  );
  const [previewText, setPreviewText] = useState("");
  const [previewContact, setPreviewContact] = useState("");

  const previewMediaUrl = mediaPreviewUrl(mediaPath);
  const previewMediaName = mediaFileName(mediaPath);

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
    let c = contacts.find((contact) => selectedIds.has(contact.id)) ?? null;
    if (!c && selectedIds.size > 0) {
      try {
        const r = await api.contacts.list({ mode: "selected", limit: 1 });
        c = r.contacts[0] ?? null;
      } catch {
        /* silencioso */
      }
    }
    if (!c) {
      setPreviewContact("");
      setPreviewText(
        template.trim()
          ? template
          : previewMediaUrl
            ? ""
            : "(sem contatos marcados — marque em Contatos ou importe um CSV)"
      );
      return;
    }
    const r = await api.message.preview(template, c);
    setPreviewContact(c.number);
    setPreviewText(r.rendered);
  };

  const onMediaPathChange = (path: string) => {
    setMediaPath(path);
    void persistSettings({ last_media_path: path });
  };

  const onMediaTypeChange = (type: MediaType) => {
    setMediaType(type);
    void persistSettings({ last_media_type: type });
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
          />

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="blue" onClick={onPreview}>
              <Eye className="h-4 w-4" /> Pré-visualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {(previewText || previewMediaUrl) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pré-visualização</CardTitle>
            {previewContact ? (
              <CardDescription>
                Como ficará para <span className="font-mono">{previewContact}</span>
                {previewMediaUrl ? " — texto + mídia anexada" : ""}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {previewMediaUrl ? (
              <div className="rounded-lg border border-border bg-surface-alt/40 p-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Mídia ({mediaType})
                </p>
                {mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewMediaUrl}
                    alt={previewMediaName || "Mídia anexada"}
                    className="max-h-72 w-auto max-w-full rounded-md border border-border object-contain"
                  />
                ) : mediaType === "video" ? (
                  <video
                    src={previewMediaUrl}
                    controls
                    className="max-h-72 w-full max-w-full rounded-md border border-border"
                  />
                ) : (
                  <a
                    href={previewMediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    {previewMediaName || "Documento anexado"}
                  </a>
                )}
              </div>
            ) : null}
            {previewText ? (
              <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-[#0a1310] p-4 text-sm text-text/95 font-mono">
                {previewText}
              </pre>
            ) : previewMediaUrl ? (
              <p className="text-sm text-muted italic">
                (sem texto — no Disparo será enviada apenas a mídia)
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-md border border-border bg-panel-alt/50 p-3 text-xs text-muted">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          A mídia selecionada aqui é usada automaticamente na aba{" "}
          <strong>Disparo</strong>.
          {OPENCODE_IA_ENABLED
            ? " O OpenCode IA gera texto a partir de imagens usando o modelo em Conexão."
            : null}
        </p>
      </div>
    </div>
  );
}
