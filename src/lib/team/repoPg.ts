/** Postgres team-chat repository (mm_team_messages, mm_team_attachments, mm_team_proposals). */
import { dbQuery, withTransaction } from "@/lib/db/pg";
import type { TeamRepo } from "./repo";
import type { TeamAttachmentRef, TeamMessage, TeamProposal } from "./types";

type DataRow<T> = { data: T };

export const pgTeamRepo: TeamRepo = {
  kind: "postgres",
  async listMessages(channel, limit) {
    const rows = await dbQuery<DataRow<TeamMessage>>(
      `SELECT data FROM (
         SELECT data, created_at FROM mm_team_messages WHERE channel = $1 ORDER BY created_at DESC LIMIT $2
       ) recent ORDER BY created_at ASC`,
      [channel, limit],
    );
    return rows.map((row) => row.data);
  },
  async getMessage(id) {
    const rows = await dbQuery<DataRow<TeamMessage>>("SELECT data FROM mm_team_messages WHERE id = $1", [id]);
    return rows[0]?.data;
  },
  async addMessage(message) {
    await dbQuery(
      `INSERT INTO mm_team_messages (id, channel, author, created_at, data) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [message.id, message.channel, message.authorId, message.createdAt, JSON.stringify(message)],
    );
  },
  async saveAttachment(meta, bytes) {
    await dbQuery(
      `INSERT INTO mm_team_attachments (id, name, mime_type, size_bytes, bytes) VALUES ($1, $2, $3, $4, $5)`,
      [meta.id, meta.name, meta.mimeType, meta.sizeBytes, bytes],
    );
  },
  async getAttachment(id) {
    const rows = await dbQuery<{ id: string; name: string; mime_type: string; size_bytes: number; bytes: Buffer }>(
      "SELECT id, name, mime_type, size_bytes, bytes FROM mm_team_attachments WHERE id = $1",
      [id],
    );
    const row = rows[0];
    if (!row) return undefined;
    const meta: TeamAttachmentRef = {
      id: row.id,
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      origin: "upload",
    };
    return { meta, bytes: row.bytes };
  },
  async saveProposal(proposal) {
    await dbQuery(
      `INSERT INTO mm_team_proposals (id, status, created_at, updated_at, data) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
      [proposal.id, proposal.status, proposal.createdAt, proposal.updatedAt, JSON.stringify(proposal)],
    );
  },
  async getProposal(id) {
    const rows = await dbQuery<DataRow<TeamProposal>>("SELECT data FROM mm_team_proposals WHERE id = $1", [id]);
    return rows[0]?.data;
  },
  async listProposals(ids) {
    if (!ids.length) return [];
    const rows = await dbQuery<DataRow<TeamProposal>>("SELECT data FROM mm_team_proposals WHERE id = ANY($1::text[])", [
      ids,
    ]);
    return rows.map((row) => row.data);
  },
  async transitionProposal(id, from, patch) {
    return withTransaction(async (client) => {
      const found = await client.query<DataRow<TeamProposal>>(
        "SELECT data FROM mm_team_proposals WHERE id = $1 FOR UPDATE",
        [id],
      );
      const current = found.rows[0]?.data;
      if (!current || !from.includes(current.status)) return undefined;
      const next: TeamProposal = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await client.query("UPDATE mm_team_proposals SET status = $2, updated_at = $3, data = $4::jsonb WHERE id = $1", [
        id,
        next.status,
        next.updatedAt,
        JSON.stringify(next),
      ]);
      return next;
    });
  },
};
