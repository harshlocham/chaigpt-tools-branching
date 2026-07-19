/** TanStack Query key factory for conversations, branches, and messages caches. */
export const queryKeys = {
    conversations: {
      all: ["conversations"] as const,
      detail: (id: string) => ["conversations", id] as const,
    },
    branches: {
      byConversation: (conversationId: string) =>
        ["branches", conversationId] as const,
    },
    messages: {
      byConversation: (conversationId: string) =>
        ["messages", conversationId] as const,
      byBranch: (conversationId: string, branchId: string) =>
        ["messages", conversationId, branchId] as const,
    },
  };
  