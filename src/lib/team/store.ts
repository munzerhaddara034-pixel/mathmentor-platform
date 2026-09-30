/** Team chat store facade: Postgres when DATABASE_URL is set, else data/team-chat.json. */
import { isPostgresEnabled } from "@/lib/db/pg";
import type { TeamRepo } from "./repo";
import { fileTeamRepo } from "./repoFile";
import { pgTeamRepo } from "./repoPg";

export function teamRepo(): TeamRepo {
  return isPostgresEnabled() ? pgTeamRepo : fileTeamRepo;
}
