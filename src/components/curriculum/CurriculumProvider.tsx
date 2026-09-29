"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRICULUM_LIST,
  getCurriculum,
  primaryExamTrackFor,
  primarySolverTrackFor,
} from "@/lib/curriculum/catalogs";
import { DEFAULT_CURRICULUM_ID, type CurriculumDefinition, type CurriculumId, type CurriculumTerminology } from "@/lib/curriculum/types";
import { persistCurriculumId, readStoredCurriculumId } from "@/lib/curriculum/persistence";
import { terminologyFor } from "@/lib/curriculum/terminology";

export type CurriculumContextValue = {
  curriculumId: CurriculumId;
  curriculum: CurriculumDefinition;
  terminology: CurriculumTerminology;
  setCurriculumId: (id: CurriculumId) => void;
  examTrack: string | undefined;
  solverTrack: string | undefined;
  catalog: CurriculumDefinition[];
  ready: boolean;
};

const CurriculumContext = createContext<CurriculumContextValue | null>(null);

export function CurriculumProvider({ children }: { children: ReactNode }) {
  const [curriculumId, setId] = useState<CurriculumId>(DEFAULT_CURRICULUM_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setId(readStoredCurriculumId());
    setReady(true);
  }, []);

  const setCurriculumId = useCallback((id: CurriculumId) => {
    setId(id);
    persistCurriculumId(id);
  }, []);

  const value = useMemo<CurriculumContextValue>(() => {
    const curriculum = getCurriculum(curriculumId);
    return {
      curriculumId,
      curriculum,
      terminology: terminologyFor(curriculumId),
      setCurriculumId,
      examTrack: primaryExamTrackFor(curriculumId),
      solverTrack: primarySolverTrackFor(curriculumId),
      catalog: CURRICULUM_LIST,
      ready,
    };
  }, [curriculumId, setCurriculumId, ready]);

  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>;
}

export function useCurriculum(): CurriculumContextValue {
  const ctx = useContext(CurriculumContext);
  if (!ctx) {
    throw new Error("useCurriculum must be used within CurriculumProvider");
  }
  return ctx;
}
