"use client";

import * as React from "react";
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Tone = "danger" | "warning" | "info" | "success";

const toneConfig: Record<Tone, { icon: LucideIcon; bgClass: string; iconClass: string }> = {
  danger: {
    icon: Trash2,
    bgClass: "bg-danger-subtle ring-danger/20",
    iconClass: "text-danger",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-warning-subtle ring-warning/20",
    iconClass: "text-warning",
  },
  info: {
    icon: Info,
    bgClass: "bg-info-subtle ring-info/20",
    iconClass: "text-info",
  },
  success: {
    icon: CheckCircle2,
    bgClass: "bg-success-subtle ring-success/20",
    iconClass: "text-success",
  },
};

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  tone = "danger",
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  const config = toneConfig[tone];
  const Icon = config.icon;

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${config.bgClass}`}
            >
              <Icon className={`h-5 w-5 ${config.iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1.5">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Aguarde..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
