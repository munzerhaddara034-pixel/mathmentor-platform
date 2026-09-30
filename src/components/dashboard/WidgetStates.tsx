import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export function WidgetSkeleton({ lines = 3, tall = false }: { lines?: number; tall?: boolean }) {
  return (
    <div className="mm-widget-skeleton" aria-busy="true">
      <Skeleton height={tall ? 28 : 20} width="55%" label="جارٍ التحميل…" />
      {Array.from({ length: lines - 1 }, (_, index) => (
        <Skeleton key={index} height={14} width={index === lines - 2 ? "70%" : "100%"} label="" />
      ))}
    </div>
  );
}

export function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mm-widget-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="ghost-btn ink" onClick={onRetry}>
          إعادة المحاولة
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
