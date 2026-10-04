"use client";

import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { taskStatusLabel, usd } from "./hamzaFormat";
import { useTaskAction } from "./useTaskAction";

type Props = { task: PublicHamzaTask; maxUsd?: number; onUpdated: (task: PublicHamzaTask) => void };

const ACTIVE = ["queued", "running", "budget_paused"];

/** Live status of one Hamza background task: progress, cost vs cap, cancel / «continue up to $5». */
export function TaskCard({ task, maxUsd = 5, onUpdated }: Props) {
  const t = useNs(teamMessages).hamza.task;
  const action = useTaskAction(task.id, onUpdated);
  const active = ACTIVE.includes(task.status);
  const canContinue = task.status === "budget_paused" && task.pauseReason === "task_budget" && task.capUsd < maxUsd;
  return (
    <section className={`team-task is-${task.status}`} aria-live="polite" aria-busy={task.status === "running"}>
      <header className="team-task-head">
        <span className={`team-task-pill is-${task.status}`}>{taskStatusLabel(task.status, t)}</span>
        <span className="team-task-cost">{fmt(t.spent, { usd: usd(task.cost.usd) })}</span>
        <span className="muted">{fmt(t.budget, { usd: usd(task.estimateUsd), cap: usd(task.capUsd) })}</span>
      </header>
      {task.status === "running" ? <div className="team-task-bar" role="progressbar" aria-label={t.running} /> : null}
      <p className="team-task-line muted">
        {fmt(t.steps, { steps: task.progress.steps, tools: task.progress.toolCalls })}
        {task.progress.model ? ` · ${task.progress.model}` : ""}
      </p>
      {task.progress.lastStep && active ? (
        <p className="team-task-line" dir="ltr">
          <span className="muted">{t.lastStep}: </span>
          {task.progress.lastStep}
        </p>
      ) : null}
      {task.status === "budget_paused" ? <p className="team-task-line">{fmt(t.budgetPaused, { usd: usd(task.capUsd) })}</p> : null}
      {task.cancelRequested && task.status === "running" ? <p className="team-task-line muted">{t.cancelling}</p> : null}
      <ApiErrorBanner error={action.errorText} errorAr={action.errorText} />
      {active ? (
        <div className="team-proposal-actions">
          {canContinue ? (
            <button type="button" className="btn team-approve" disabled={action.busy} onClick={() => void action.run("continue")}>
              {fmt(t.continue, { usd: usd(maxUsd) })}
            </button>
          ) : null}
          {!task.cancelRequested ? (
            <button type="button" className="btn ghost-btn team-reject" disabled={action.busy} onClick={() => void action.run("cancel")}>
              {t.cancel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
