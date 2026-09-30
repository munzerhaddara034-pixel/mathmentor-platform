"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useStudentOverview, type OverviewState } from "./useStudentOverview";

type OverviewValue = { state: OverviewState; retry: () => void };

const OverviewContext = createContext<OverviewValue | null>(null);

/** Fetches /api/me/overview once and shares it with every dashboard widget. */
export function OverviewProvider({ children }: { children: ReactNode }) {
  const value = useStudentOverview();
  return <OverviewContext.Provider value={value}>{children}</OverviewContext.Provider>;
}

export function useOverview(): OverviewValue {
  const value = useContext(OverviewContext);
  if (!value) throw new Error("useOverview must be used inside <OverviewProvider>");
  return value;
}
