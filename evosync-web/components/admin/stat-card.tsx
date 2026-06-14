import * as React from "react";
import { ArrowDown, ArrowUp, type LucideIcon, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, { bg: string; text: string; ring: string; gradient: string }> = {
  primary: {
    bg: "bg-primary-subtle",
    text: "text-primary",
    ring: "ring-primary/20",
    gradient: "from-primary to-primary-hover",
  },
  info: {
    bg: "bg-info-subtle",
    text: "text-info-foreground",
    ring: "ring-info/20",
    gradient: "from-info to-info/80",
  },
  success: {
    bg: "bg-success-subtle",
    text: "text-success-foreground",
    ring: "ring-success/20",
    gradient: "from-success to-success/80",
  },
  warning: {
    bg: "bg-warning-subtle",
    text: "text-warning-foreground",
    ring: "ring-warning/20",
    gradient: "from-warning to-warning/80",
  },
  danger: {
    bg: "bg-danger-subtle",
    text: "text-danger-foreground",
    ring: "ring-danger/20",
    gradient: "from-danger to-danger/80",
  },
  neutral: {
    bg: "bg-muted",
    text: "text-foreground",
    ring: "ring-border",
    gradient: "from-muted-foreground to-muted-foreground/80",
  },
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  trend?: { value: number; label?: string };
  /** Comma-separated series for sparkline (e.g. "10,20,30,40") */
  sparkline?: number[];
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  trend,
  sparkline,
  loading,
  className,
  onClick,
}: StatCardProps) {
  const styles = toneStyles[tone];
  const SparklineChart = sparkline && sparkline.length > 1 ? (
    <Sparkline data={sparkline} tone={tone} />
  ) : null;

  const TrendIndicator = trend ? (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold",
        trend.value > 0
          ? "bg-success-subtle text-success-foreground"
          : trend.value < 0
          ? "bg-danger-subtle text-danger-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {trend.value > 0 ? (
        <ArrowUp className="h-3 w-3" />
      ) : trend.value < 0 ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      <span>
        {Math.abs(trend.value).toFixed(1)}%
        {trend.label && <span className="ml-1 opacity-70">{trend.label}</span>}
      </span>
    </div>
  ) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-surface p-5",
        "shadow-elev-1 transition-all duration-300 ease-spring",
        onClick && "cursor-pointer hover:border-border/80 hover:shadow-elev-3 hover:-translate-y-0.5",
        className
      )}
    >
      {/* Decorative gradient orb */}
      <div
        className={cn(
          "absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.07] blur-2xl",
          "bg-gradient-to-br",
          styles.gradient,
          "transition-opacity duration-500 group-hover:opacity-[0.12]"
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-20 shimmer rounded-md" />
          ) : (
            <p className="mt-2 text-3xl font-bold font-display text-foreground tabular-nums">
              {value}
            </p>
          )}
          {(sub || TrendIndicator) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {sub && (
                <p className="text-xs text-muted-foreground">{sub}</p>
              )}
              {TrendIndicator}
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "ring-1",
              styles.bg,
              styles.ring
            )}
          >
            <Icon className={cn("h-5 w-5", styles.text)} />
          </div>
        )}
      </div>

      {SparklineChart && (
        <div className="relative mt-4 -mb-1 h-10">{SparklineChart}</div>
      )}
    </div>
  );
}

function Sparkline({ data, tone }: { data: number[]; tone: Tone }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const colorMap: Record<Tone, string> = {
    primary: "hsl(var(--primary))",
    info: "hsl(var(--info))",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    danger: "hsl(var(--danger))",
    neutral: "hsl(var(--muted-foreground))",
  };

  const stroke = colorMap[tone];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#spark-${tone})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
