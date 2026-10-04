// In-memory TeamRepo (same contract as src/lib/team/repo.ts) for pipeline / worker tests.
export function createMemoryTeamRepo() {
  const messages = [];
  const proposals = new Map();
  return {
    kind: "file",
    messages,
    proposals,
    async listMessages(channel, limit) {
      return messages.filter((m) => m.channel === channel).slice(-limit);
    },
    async getMessage(id) {
      return messages.find((m) => m.id === id);
    },
    async addMessage(message) {
      messages.push(structuredClone(message));
    },
    async saveAttachment() {},
    async getAttachment() {
      return undefined;
    },
    async saveProposal(proposal) {
      proposals.set(proposal.id, structuredClone(proposal));
    },
    async getProposal(id) {
      const p = proposals.get(id);
      return p ? structuredClone(p) : undefined;
    },
    async listProposals(ids) {
      return ids.map((id) => proposals.get(id)).filter(Boolean).map((p) => structuredClone(p));
    },
    async transitionProposal(id, from, patch) {
      const current = proposals.get(id);
      if (!current || !from.includes(current.status)) return undefined;
      const next = { ...current, ...structuredClone(patch), updatedAt: new Date().toISOString() };
      proposals.set(id, next);
      return structuredClone(next);
    },
  };
}
