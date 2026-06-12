import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CircleDashed,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
  Ban,
} from "lucide-react";
import type { ScheduleStatus } from "@/lib/types";

const labels: Record<ScheduleStatus, string> = {
  pending: "Pendente",
  running: "Em execução",
  sent: "Enviado",
  failed: "Falhou",
  missed: "Perdido",
  cancelled: "Cancelado",
};

const styles: Record<
  ScheduleStatus,
  { variant: React.ComponentProps<typeof Badge>["variant"]; Icon: any }
> = {
  pending: { variant: "muted", Icon: CircleDashed },
  running: { variant: "blue", Icon: Loader2 },
  sent: { variant: "success", Icon: CheckCircle2 },
  failed: { variant: "danger", Icon: XCircle },
  missed: { variant: "warn", Icon: AlertTriangle },
  cancelled: { variant: "secondary", Icon: Ban },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ScheduleStatus | string;
  className?: string;
}) {
  const key = (labels as any)[status]
    ? (status as ScheduleStatus)
    : "pending";
  const { variant, Icon } = styles[key];
  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Icon
        className={cn(
          "h-3 w-3",
          key === "running" && "animate-spin"
        )}
      />
      {labels[key]}
    </Badge>
  );
}

export function SendStateBadge({
  state,
  className,
}: {
  state: string;
  className?: string;
}) {
  const map: Record<
    string,
    { label: string; variant: any; Icon: any }
  > = {
    idle: { label: "Ocioso", variant: "muted", Icon: PauseCircle },
    running: { label: "Rodando", variant: "success", Icon: Loader2 },
    paused: { label: "Pausado", variant: "warn", Icon: PauseCircle },
    stopped: { label: "Parado", variant: "danger", Icon: Ban },
  };
  const item = map[state] ?? map.idle;
  const { variant, Icon, label } = item;
  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Icon
        className={cn(
          "h-3 w-3",
          state === "running" && "animate-spin"
        )}
      />
      {label}
    </Badge>
  );
}
