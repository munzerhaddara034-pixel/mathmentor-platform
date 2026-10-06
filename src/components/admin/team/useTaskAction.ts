"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import { teamMessages } from "@/lib/i18n/ns/team";
import { taskAction, teamErrorText } from "./teamApi";

/** Cancel / continue a Hamza task with busy + translated error state. */
export function useTaskAction(taskId: string, onUpdated: (task: PublicHamzaTask) => void) {
  const { locale } = useI18n();
  const tm = teamMessages[locale];
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const run = useCallback(
    async (action: "cancel" | "continue") => {
      setBusy(true);
      setErrorText("");
      try {
        const result = await taskAction(taskId, action);
        if (!result.ok) setErrorText(teamErrorText(result, locale, tm));
        else onUpdated(result.data.task);
      } catch {
        setErrorText(tm.errors.network);
      } finally {
        setBusy(false);
      }
    },
    [taskId, onUpdated, locale, tm],
  );
  return { run, busy, errorText };
}
