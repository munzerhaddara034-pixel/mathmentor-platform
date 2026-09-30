import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export function WidgetSkeleton({ lines = 3, tall = false, label }: { lines?: number; tall?: boolean; label: string }) {
  return (
    <div className="mm-widget-skeleton" aria-busy="true">
      <Skeleton height={tall ? 28 : 20} width="55%" label={label} />
      {Array.from({ length: lines - 1 }, (_, index) => (
        <Skeleton key={index} height={14} width={index === lines - 2 ? "70%" : "100%"} label="" />
      ))}
    </div>
  );
}

export function WidgetError({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel: string }) {
  return (
    <div className="mm-widget-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="v2-btn v2-btn-glass v2-btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function WidgetEmpty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mm-widget-empty">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}
