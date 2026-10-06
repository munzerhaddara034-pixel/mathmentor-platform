/** Task store facade: Postgres when DATABASE_URL is set, else data/hamza-tasks.json. Tests may override. */
import { isPostgresEnabled } from "@/lib/db/pg";
import { fileTaskRepo } from "./repoFile";
import { pgTaskRepo } from "./repoPg";
import type { HamzaTaskRepo } from "./types";

const holder = globalThis as unknown as { mmHamzaTaskRepoOverride?: HamzaTaskRepo | null };

export function setHamzaTaskRepoOverride(repo: HamzaTaskRepo | null): void {
  holder.mmHamzaTaskRepoOverride = repo;
}

export function hamzaTaskRepo(): HamzaTaskRepo {
  return holder.mmHamzaTaskRepoOverride ?? (isPostgresEnabled() ? pgTaskRepo : fileTaskRepo);
}
