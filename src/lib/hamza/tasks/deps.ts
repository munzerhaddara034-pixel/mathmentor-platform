/** Production TaskDeps (env config + task store + audit). */
import { hamzaAudit } from "../audit";
import { hamzaRuntimeConfig } from "../readiness";
import type { TaskDeps } from "./enqueue";
import { hamzaTaskRepo } from "./store";

export function taskDeps(): TaskDeps {
  return { tasks: hamzaTaskRepo(), config: hamzaRuntimeConfig(), audit: hamzaAudit, now: () => new Date() };
}
