/** Production TaskDeps (env config + task store + audit). */
import { hamzaAudit } from "../audit";
import { hamzaConfig } from "../config";
import type { TaskDeps } from "./enqueue";
import { hamzaTaskRepo } from "./store";

export function taskDeps(): TaskDeps {
  return { tasks: hamzaTaskRepo(), config: hamzaConfig(), audit: hamzaAudit, now: () => new Date() };
}
