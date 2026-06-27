"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

export type MediaType = "image" | "video" | "document";

interface MediaAttachmentFieldProps {
  mediaPath: string;
  mediaType: MediaType;
  onMediaPathChange: (path: string) => void;
  onMediaTypeChange: (type: MediaType) => void;
  onFileSelected?: (file: File) => void;
  disabled?: boolean;
}

export function MediaAttachmentField({
  mediaPath,
  mediaType,
  onMediaPathChange,
  onMediaTypeChange,
  onFileSelected,
  disabled,
}: MediaAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const mediaName = mediaPath ? mediaPath.split(/[\\/]/).pop() : null;

  const onPickMedia = (file: File) => {
    onFileSelected?.(file);
    setUploading(true);
    api.upload
      .media(file)
      .then((r) => {
        onMediaPathChange(r.path);
        toast.success(`Arquivo selecionado: ${r.name}`);
      })
      .catch((e) => toast.error(e?.message || "Falha no upload"))
      .finally(() => setUploading(false));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="sm:w-44">
          <Label>Tipo</Label>
          <Select
            value={mediaType}
            onValueChange={(v) => onMediaTypeChange(v as MediaType)}
            disabled={disabled || uploading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="document">Documento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,application/pdf"
            disabled={disabled || uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickMedia(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="neutral"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
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

      {mediaName ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt/50 px-3 py-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-mono truncate flex-1">{mediaName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 shrink-0"
            disabled={disabled || uploading}
            onClick={() => onMediaPathChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhum arquivo selecionado. Imagem, vídeo ou PDF serão enviados junto
          com a mensagem.
        </p>
      )}
    </div>
  );
}
